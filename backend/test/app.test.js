import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import { createApp } from "../src/app.js";
import { ClassificationError } from "../src/classification.js";

const validInput = {
  originalNote: "Machine stopped on the line.",
  orderId: "order-1",
  stage: "Stitching",
  languageHint: "en",
};

const validResult = {
  detectedLanguage: "English",
  translatedNote: "Machine stopped on the line.",
  category: "MACHINE_BREAKDOWN",
  severity: "MEDIUM",
  explanation: "The note reports a machine stoppage.",
  confidence: 0.86,
  needsReview: false,
};

async function withServer(app, run) {
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  try {
    return await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

test("classify endpoint returns strict mocked result and does not echo the original note", async () => {
  let received;
  const app = createApp({
    classify: async (input) => {
      received = input;
      return validResult;
    },
  });
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/issues/classify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(validInput),
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), validResult);
    assert.equal(received.originalNote, validInput.originalNote);
  });
});

test("empty, invalid, and oversized notes are rejected before classification", async () => {
  let calls = 0;
  const app = createApp({
    classify: async () => {
      calls += 1;
      return validResult;
    },
  });
  await withServer(app, async (baseUrl) => {
    for (const body of [
      { ...validInput, originalNote: " " },
      { ...validInput, originalNote: "x".repeat(4001) },
      { ...validInput, languageHint: "fr" },
    ]) {
      const response = await fetch(`${baseUrl}/api/issues/classify`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      assert.equal(response.status, 400);
      assert.equal(typeof (await response.json()).error, "string");
    }
    assert.equal(calls, 0);
  });
});

test("API body size limit returns 413", async () => {
  const app = createApp();
  await withServer(app, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/issues/classify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...validInput, originalNote: "x".repeat(20_000) }),
    });
    assert.equal(response.status, 413);
    assert.match((await response.json()).error, /too large/i);
  });
});

test("provider errors and timeouts return safe messages", async () => {
  for (const error of [
    new ClassificationError("classification_timeout", 504),
    new ClassificationError("classification_provider_error", 502),
  ]) {
    const app = createApp({
      classify: async () => {
        throw error;
      },
    });
    await withServer(app, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/issues/classify`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(validInput),
      });
      assert.equal(response.status, error.status);
      const body = await response.json();
      assert.doesNotMatch(JSON.stringify(body), /provider internals|key-like/);
    });
  }
});

test("missing API credentials fail safely and do not fabricate results", async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  const previousModel = process.env.OPENAI_MODEL;
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_MODEL;
  try {
    await withServer(createApp(), async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/issues/classify`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(validInput),
      });
      assert.equal(response.status, 503);
      const body = await response.json();
      assert.match(body.error, /not configured/i);
      assert.equal(body.category, undefined);
    });
  } finally {
    if (previousKey !== undefined) process.env.OPENAI_API_KEY = previousKey;
    if (previousModel !== undefined) process.env.OPENAI_MODEL = previousModel;
  }
});

test("classification route is rate limited", async () => {
  const app = createApp({ classify: async () => validResult });
  await withServer(app, async (baseUrl) => {
    let response;
    for (let index = 0; index < 11; index += 1) {
      response = await fetch(`${baseUrl}/api/issues/classify`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(validInput),
      });
    }
    assert.equal(response.status, 429);
    assert.match((await response.json()).error, /too many/i);
  });
});

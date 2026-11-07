import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import { createApp } from "../src/app.js";
import { ClassificationError } from "../src/classification.js";
import { createDemoRepository } from "../src/demoRepository.js";

const JWT_SECRET = "test-secret-value-that-is-long-enough-for-hs256";
const DEMO_PASSWORD = "StitchFlowDemo2026!";
const validInput = {
  originalNote: "Machine stopped on the line.",
  orderId: "B-PO-88213",
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

async function withServer(run, options = {}) {
  const app = createApp({
    jwtSecret: JWT_SECRET,
    repository: createDemoRepository(),
    ...options,
  });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  try {
    return await run(`http://127.0.0.1:${address.port}`, app);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

async function login(baseUrl, email = "merchandiser@stitchflow.demo", password = DEMO_PASSWORD) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return { response, body: await response.json() };
}

async function asRole(baseUrl, email = "merchandiser@stitchflow.demo") {
  const { response, body } = await login(baseUrl, email);
  assert.equal(response.status, 200);
  return body.accessToken;
}

async function authorizedFetch(baseUrl, token, path, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set("authorization", `Bearer ${token}`);
  if (options.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  return fetch(`${baseUrl}${path}`, { ...options, headers });
}

test("classify endpoint returns strict mocked result to an authenticated user", async () => {
  let received;
  await withServer(async (baseUrl) => {
    const token = await asRole(baseUrl);
    const response = await authorizedFetch(baseUrl, token, "/api/issues/classify", {
      method: "POST",
      body: JSON.stringify(validInput),
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), validResult);
  }, {
    classify: async (input) => {
      received = input;
      return validResult;
    },
  });
  assert.equal(received.originalNote, validInput.originalNote);
});

test("empty, invalid, and oversized notes are rejected before classification", async () => {
  let calls = 0;
  await withServer(async (baseUrl) => {
    const token = await asRole(baseUrl);
    for (const body of [
      { ...validInput, originalNote: " " },
      { ...validInput, originalNote: "x".repeat(4001) },
      { ...validInput, languageHint: "fr" },
    ]) {
      const response = await authorizedFetch(baseUrl, token, "/api/issues/classify", {
        method: "POST",
        body: JSON.stringify(body),
      });
      assert.equal(response.status, 400);
      assert.equal(typeof (await response.json()).error, "string");
    }
    assert.equal(calls, 0);
  }, {
    classify: async () => {
      calls += 1;
      return validResult;
    },
  });
});

test("API body size limit returns 413", async () => {
  await withServer(async (baseUrl) => {
    const token = await asRole(baseUrl);
    const response = await authorizedFetch(baseUrl, token, "/api/issues/classify", {
      method: "POST",
      body: JSON.stringify({ ...validInput, originalNote: "x".repeat(20_000) }),
    });
    assert.equal(response.status, 413);
    assert.match((await response.json()).error, /too large/i);
  });
});

test("CORS accepts only the configured frontend origin", async () => {
  await withServer(async (baseUrl) => {
    const allowed = await fetch(`${baseUrl}/api/health`, {
      headers: { origin: "http://127.0.0.1:5173" },
    });
    assert.equal(allowed.status, 200);
    assert.equal(
      allowed.headers.get("access-control-allow-origin"),
      "http://127.0.0.1:5173",
    );

    const rejected = await fetch(`${baseUrl}/api/health`, {
      headers: { origin: "https://untrusted.example" },
    });
    assert.equal(rejected.status, 403);
    assert.equal(rejected.headers.get("access-control-allow-origin"), null);
    assert.deepEqual(await rejected.json(), {
      error: "This origin is not allowed.",
    });
  });
});

test("database readiness failures return 503 without accessing protected routes", async () => {
  const repository = createDemoRepository();
  repository.isPersistent = true;
  await withServer(async (baseUrl) => {
    const health = await fetch(`${baseUrl}/api/health`);
    const orders = await fetch(`${baseUrl}/api/orders`);
    assert.equal(health.status, 503);
    assert.deepEqual(await health.json(), {
      status: "unavailable",
      database: "disconnected",
    });
    assert.equal(orders.status, 503);
    assert.doesNotMatch(await orders.text(), /stack|mongoose|mongodb/i);
  }, { repository });
});

test("unexpected API failures return a generic message without internals", async () => {
  const repository = createDemoRepository();
  repository.findUserByEmail = async () => {
    throw new Error("private MongoDB host and credentials");
  };
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "merchandiser@stitchflow.demo",
        password: DEMO_PASSWORD,
      }),
    });
    assert.equal(response.status, 500);
    const body = await response.text();
    assert.match(body, /could not process this request/i);
    assert.doesNotMatch(body, /private MongoDB|stack|credentials/i);
  }, { repository });
});

test("provider errors and timeouts return safe messages", async () => {
  for (const error of [
    new ClassificationError("classification_timeout", 504),
    new ClassificationError("classification_provider_error", 502),
  ]) {
    await withServer(async (baseUrl) => {
      const token = await asRole(baseUrl);
      const response = await authorizedFetch(baseUrl, token, "/api/issues/classify", {
        method: "POST",
        body: JSON.stringify(validInput),
      });
      assert.equal(response.status, error.status);
      const body = await response.json();
      assert.doesNotMatch(JSON.stringify(body), /provider internals|key-like/);
    }, {
      classify: async () => {
        throw error;
      },
    });
  }
});

test("missing API credentials fail safely and do not fabricate results", async () => {
  const previousKey = process.env.OPENAI_API_KEY;
  const previousModel = process.env.OPENAI_MODEL;
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_MODEL;
  try {
    await withServer(async (baseUrl) => {
      const token = await asRole(baseUrl);
      const response = await authorizedFetch(baseUrl, token, "/api/issues/classify", {
        method: "POST",
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

test("classification route is rate limited for an authenticated account", async () => {
  await withServer(async (baseUrl) => {
    const token = await asRole(baseUrl);
    let response;
    for (let index = 0; index < 11; index += 1) {
      response = await authorizedFetch(baseUrl, token, "/api/issues/classify", {
        method: "POST",
        body: JSON.stringify(validInput),
      });
    }
    assert.equal(response.status, 429);
    assert.match((await response.json()).error, /too many/i);
  }, { classify: async () => validResult });
});

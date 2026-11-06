import assert from "node:assert/strict";
import test from "node:test";
import {
  ClassificationError,
  classifyIssue,
  validateClassificationInput,
  validateClassificationResult,
} from "../src/classification.js";

const tamilNote = "இன்று தையல் மெஷின் பழுதாக உள்ளது.";
const englishNote = "The sewing machine has stopped working today.";

function classification(overrides = {}) {
  return {
    detectedLanguage: "Tamil",
    translatedNote: "The sewing machine is not working today.",
    category: "MACHINE_BREAKDOWN",
    severity: "HIGH",
    explanation: "The note describes a sewing machine breakdown.",
    confidence: 0.92,
    needsReview: false,
    ...overrides,
  };
}

function createMockClient(output, onRequest = () => {}) {
  return {
    responses: {
      create: async (request) => {
        onRequest(request);
        return {
          output_text:
            typeof output === "string" ? output : JSON.stringify(output),
        };
      },
    },
  };
}

test("classifies a Tamil note and preserves the exact original in model input", async () => {
  let request;
  const result = await classifyIssue(
    {
      originalNote: ` ${tamilNote}\n`,
      orderId: "order-1",
      stage: "Stitching",
      languageHint: "ta",
    },
    {
      apiKey: "test-key",
      model: "test-model",
      client: createMockClient(classification(), (value) => {
        request = value;
      }),
    },
  );
  assert.equal(result.detectedLanguage, "Tamil");
  assert.equal(result.translatedNote, "The sewing machine is not working today.");
  assert.equal(result.category, "MACHINE_BREAKDOWN");
  assert.match(request.input[1].content[0].text, /"originalNote":" .*\\n"/);
  assert.equal(request.model, "test-model");
  assert.equal(request.text.format.type, "json_schema");
  assert.equal(request.text.format.strict, true);
});

test("classifies English notes without translating meaning", async () => {
  const result = await classifyIssue(
    {
      originalNote: englishNote,
      orderId: "order-2",
      stage: "Packing",
      languageHint: "en",
    },
    {
      apiKey: "test-key",
      model: "test-model",
      client: createMockClient(
        classification({
          detectedLanguage: "English",
          translatedNote: englishNote,
          category: "PACKING_ISSUE",
          severity: "MEDIUM",
          explanation: "The note reports a packing issue.",
          confidence: 0.8,
          needsReview: true,
        }),
      ),
    },
  );
  assert.equal(result.detectedLanguage, "English");
  assert.equal(result.translatedNote, englishNote);
  assert.equal(result.category, "PACKING_ISSUE");
  assert.equal(result.needsReview, true);
});

test("rejects empty and excessively long input", () => {
  assert.equal(
    validateClassificationInput({
      originalNote: " \n ",
      orderId: "order-1",
      stage: "Stitching",
    }).ok,
    false,
  );
  assert.equal(
    validateClassificationInput({
      originalNote: "x".repeat(4001),
      orderId: "order-1",
      stage: "Stitching",
    }).ok,
    false,
  );
});

test("rejects invalid AI categories and severities", () => {
  assert.equal(
    validateClassificationResult(
      classification({ category: "INVENTED_CATEGORY" }),
    ),
    false,
  );
  assert.equal(
    validateClassificationResult(classification({ severity: "URGENT" })),
    false,
  );
});

test("malformed provider JSON is a safe validation error", async () => {
  await assert.rejects(
    classifyIssue(
      {
        originalNote: englishNote,
        orderId: "order-2",
        stage: "Packing",
      },
      {
        apiKey: "test-key",
        model: "test-model",
        client: createMockClient("{not json"),
      },
    ),
    (error) =>
      error instanceof ClassificationError &&
      error.code === "classification_invalid_response",
  );
});

test("invalid category or severity in decoded AI output is rejected", async () => {
  for (const result of [
    classification({ category: "OTHER_THAN_ALLOWED" }),
    classification({ severity: "IMMEDIATE" }),
  ]) {
    await assert.rejects(
      classifyIssue(
        {
          originalNote: englishNote,
          orderId: "order-2",
          stage: "Packing",
        },
        {
          apiKey: "test-key",
          model: "test-model",
          client: createMockClient(result),
        },
      ),
      (error) => error.code === "classification_invalid_response",
    );
  }
});

test("provider timeouts and errors become safe error codes", async () => {
  for (const providerError of [
    Object.assign(new Error("secret-bearing-provider-message"), {
      name: "APIConnectionTimeoutError",
    }),
    new Error("secret-bearing-provider-message"),
  ]) {
    await assert.rejects(
      classifyIssue(
        {
          originalNote: englishNote,
          orderId: "order-2",
          stage: "Packing",
        },
        {
          apiKey: "test-key",
          model: "test-model",
          client: {
            responses: {
              create: async () => {
                throw providerError;
              },
            },
          },
        },
      ),
      (error) =>
        error instanceof ClassificationError &&
        !error.message.includes("secret-bearing"),
    );
  }
});

test("missing server configuration fails closed without calling OpenAI", async () => {
  let called = false;
  await assert.rejects(
    classifyIssue(
      {
        originalNote: englishNote,
        orderId: "order-2",
        stage: "Packing",
      },
      {
        apiKey: "",
        model: "test-model",
        client: {
          responses: {
            create: async () => {
              called = true;
            },
          },
        },
      },
    ),
    (error) => error.code === "classification_not_configured",
  );
  assert.equal(called, false);
});

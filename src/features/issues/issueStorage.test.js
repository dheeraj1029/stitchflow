import assert from "node:assert/strict";
import test from "node:test";
import { createIssueRecord } from "./issueModel.js";
import { loadIssueData, writeIssueData } from "./issueStorage.js";

function createMemoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

test("issue records persist and reload with immutable original note and audit", () => {
  const storage = createMemoryStorage();
  const issue = createIssueRecord({
    id: "issue-1",
    order: {
      id: "order-1",
      poNumber: "PO-1",
      buyer: "Buyer A",
      productionUnit: "North Mill",
    },
    stage: "Stitching",
    originalNote: "தமிழ் issue note",
    languageHint: "ta",
    createdAt: "2026-11-06T12:00:00.000Z",
  });
  writeIssueData([issue], storage);
  const loaded = loadIssueData(storage);
  assert.equal(loaded.error, "");
  assert.equal(loaded.issues[0].originalNote, "தமிழ் issue note");
  assert.equal(loaded.issues[0].auditHistory[0].event, "SUBMITTED");
});

test("corrupted issue storage is reported, not silently replaced", () => {
  const storage = createMemoryStorage();
  storage.setItem("stitchflow.production-issues.v1", "not-json");
  const loaded = loadIssueData(storage);
  assert.equal(loaded.issues.length, 0);
  assert.match(loaded.error, /unavailable/i);
  assert.equal(storage.getItem("stitchflow.production-issues.v1"), "not-json");
});

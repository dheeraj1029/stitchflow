import assert from "node:assert/strict";
import test from "node:test";
import {
  applyIssueClassification,
  confirmIssueReview,
  createIssueRecord,
  filterIssues,
  isBuyerWarningEligible,
  markIssueClassificationFailed,
  rejectIssueReview,
} from "./issueModel.js";

const originalNote = "இன்று தையல் மெஷின் பழுதாக உள்ளது.";
const order = {
  id: "order-1",
  poNumber: "PO-1",
  buyer: "Buyer A",
  productionUnit: "North Mill",
};
const result = {
  detectedLanguage: "Tamil",
  translatedNote: "The sewing machine is not working today.",
  category: "MACHINE_BREAKDOWN",
  severity: "HIGH",
  explanation: "The note describes a sewing machine breakdown.",
  confidence: 0.92,
  needsReview: true,
};

function newIssue(note = originalNote) {
  return createIssueRecord({
    id: "issue-1",
    order,
    stage: "Stitching",
    originalNote: note,
    languageHint: "ta",
    createdAt: "2026-11-06T12:00:00.000Z",
  });
}

function classifiedIssue(note) {
  const submitted = newIssue(note);
  const classified = applyIssueClassification(
    [submitted],
    submitted.id,
    result,
    "2026-11-06T12:01:00.000Z",
  );
  return classified.issues;
}

test("Tamil note is stored exactly as submitted and never changed by classification", () => {
  const submitted = newIssue(` ${originalNote}\n`);
  const classified = applyIssueClassification(
    [submitted],
    submitted.id,
    result,
    "2026-11-06T12:01:00.000Z",
  );
  assert.equal(classified.issue.originalNote, ` ${originalNote}\n`);
  assert.equal(classified.issue.suggestedTranslation, result.translatedNote);
  assert.equal(classified.issue.reviewStatus, "PENDING_REVIEW");
});

test("classification failures preserve issue note and permit retry", () => {
  const issue = newIssue();
  const failed = markIssueClassificationFailed(
    [issue],
    issue.id,
    "Service unavailable.",
    "2026-11-06T12:01:00.000Z",
  );
  assert.equal(failed.issue.originalNote, originalNote);
  assert.equal(failed.issue.reviewStatus, "CLASSIFICATION_FAILED");
  const retried = applyIssueClassification(
    failed.issues,
    issue.id,
    result,
    "2026-11-06T12:02:00.000Z",
  );
  assert.equal(retried.issue.originalNote, originalNote);
  assert.equal(retried.issue.reviewStatus, "PENDING_REVIEW");
  assert.equal(retried.issue.classificationAttempts, 2);
});

test("merchandiser corrections remain separate from the AI suggestions and are audited", () => {
  const issues = classifiedIssue();
  const confirmed = confirmIssueReview(
    issues,
    "issue-1",
    {
      translation: "The sewing machine has stopped today.",
      category: "PRODUCTION_DELAY",
      severity: "MEDIUM",
      reviewerNote: "Confirmed with the floor supervisor.",
    },
    "2026-11-06T12:02:00.000Z",
  );
  const issue = confirmed.issue;
  assert.equal(issue.originalNote, originalNote);
  assert.equal(issue.suggestedTranslation, result.translatedNote);
  assert.equal(issue.confirmedTranslation, "The sewing machine has stopped today.");
  assert.equal(issue.suggestedCategory, "MACHINE_BREAKDOWN");
  assert.equal(issue.confirmedCategory, "PRODUCTION_DELAY");
  assert.equal(issue.suggestedSeverity, "HIGH");
  assert.equal(issue.confirmedSeverity, "MEDIUM");
  assert.equal(issue.auditHistory.at(-1).event, "MERCHANDISER_CONFIRMED");
  assert.equal(issue.auditHistory.at(-1).categoryCorrected, true);
});

test("confirmation validates corrected category, severity and translation", () => {
  const issues = classifiedIssue();
  const invalid = confirmIssueReview(
    issues,
    "issue-1",
    {
      translation: "",
      category: "MADE_UP",
      severity: "URGENT",
    },
    "2026-11-06T12:02:00.000Z",
  );
  assert.equal(invalid.ok, false);
  assert.equal(issues[0].reviewStatus, "PENDING_REVIEW");
});

test("rejected issues have an audit event and cannot be buyer-warning eligible", () => {
  const rejected = rejectIssueReview(
    classifiedIssue(),
    "issue-1",
    "The category does not match the report.",
    "2026-11-06T12:03:00.000Z",
  );
  assert.equal(rejected.issue.reviewStatus, "REJECTED");
  assert.equal(rejected.issue.auditHistory.at(-1).event, "MERCHANDISER_REJECTED");
  assert.equal(isBuyerWarningEligible(rejected.issue), false);
});

test("buyer warning eligibility is granted only to confirmed classifications", () => {
  const issue = newIssue();
  const statuses = [
    "PENDING_REVIEW",
    "CLASSIFICATION_FAILED",
    "REJECTED",
    "CONFIRMED",
  ];
  assert.deepEqual(
    statuses.map((reviewStatus) =>
      isBuyerWarningEligible({ ...issue, reviewStatus }),
    ),
    [false, false, false, true],
  );
});

test("issue filters combine buyer, unit, status, category and severity", () => {
  const issues = classifiedIssue();
  const confirmed = confirmIssueReview(
    issues,
    "issue-1",
    {
      translation: result.translatedNote,
      category: result.category,
      severity: result.severity,
    },
    "2026-11-06T12:02:00.000Z",
  ).issue;
  const filters = filterIssues([confirmed], [order], {
    status: "CONFIRMED",
    category: "MACHINE_BREAKDOWN",
    severity: "HIGH",
    buyer: "Buyer A",
    unit: "North Mill",
  });
  assert.equal(filters.length, 1);
  assert.equal(
    filterIssues([confirmed], [order], { buyer: "Other Buyer" }).length,
    0,
  );
  assert.equal(filterIssues([], [order], {}).length, 0);
});

test("reclassification cannot overwrite a confirmed or rejected issue", () => {
  const issues = classifiedIssue();
  const rejected = rejectIssueReview(
    issues,
    "issue-1",
    "Rejected.",
    "2026-11-06T12:02:00.000Z",
  );
  assert.equal(
    applyIssueClassification(
      rejected.issues,
      "issue-1",
      result,
      "2026-11-06T12:03:00.000Z",
    ).ok,
    false,
  );
});

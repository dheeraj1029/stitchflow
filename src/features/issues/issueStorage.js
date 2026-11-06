import {
  ISSUE_CATEGORIES,
  ISSUE_SEVERITIES,
  REVIEW_STATUSES,
} from "./issueConstants.js";

const STORAGE_KEY = "stitchflow.production-issues.v1";

function isValidIssue(issue) {
  return Boolean(
    issue &&
      typeof issue === "object" &&
      typeof issue.id === "string" &&
      typeof issue.orderId === "string" &&
      typeof issue.orderNumber === "string" &&
      typeof issue.stage === "string" &&
      typeof issue.originalNote === "string" &&
      issue.originalNote.length > 0 &&
      REVIEW_STATUSES.includes(issue.reviewStatus) &&
      Array.isArray(issue.auditHistory) &&
      typeof issue.createdAt === "string" &&
      !Number.isNaN(Date.parse(issue.createdAt)) &&
      (issue.suggestedCategory === null ||
        ISSUE_CATEGORIES.includes(issue.suggestedCategory)) &&
      (issue.confirmedCategory === null ||
        ISSUE_CATEGORIES.includes(issue.confirmedCategory)) &&
      (issue.suggestedSeverity === null ||
        ISSUE_SEVERITIES.includes(issue.suggestedSeverity)) &&
      (issue.confirmedSeverity === null ||
        ISSUE_SEVERITIES.includes(issue.confirmedSeverity)) &&
      (issue.confidence === null ||
        (Number.isFinite(issue.confidence) &&
          issue.confidence >= 0 &&
          issue.confidence <= 1))
  );
}

export function loadIssueData(storage = window.localStorage) {
  try {
    const stored = storage.getItem(STORAGE_KEY);
    if (stored === null) {
      return { issues: [], error: "" };
    }
    const parsed = JSON.parse(stored);
    if (
      !parsed ||
      parsed.version !== 1 ||
      !Array.isArray(parsed.issues) ||
      !parsed.issues.every(isValidIssue) ||
      new Set(parsed.issues.map((issue) => issue.id)).size !==
        parsed.issues.length
    ) {
      return {
        issues: [],
        error:
          "Saved production issue data could not be read. Existing issue notes have not been overwritten; check browser storage before saving.",
      };
    }
    return { issues: parsed.issues, error: "" };
  } catch {
    return {
      issues: [],
      error:
        "Saved production issues are unavailable. Check browser storage before saving new changes.",
    };
  }
}

export function writeIssueData(issues, storage = window.localStorage) {
  storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, issues }));
}

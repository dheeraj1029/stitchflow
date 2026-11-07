import {
  ISSUE_CATEGORIES,
  ISSUE_SEVERITIES,
} from "./issueConstants.js";
import { apiRequest } from "../auth/authApi.js";

export async function listIssues() {
  const result = await apiRequest("/api/issues");
  if (!Array.isArray(result.issues)) {
    throw new Error("The issue service returned invalid data.");
  }
  return result.issues;
}

export async function saveIssueForReview(issue) {
  const result = await apiRequest("/api/issues", {
    method: "POST",
    body: JSON.stringify({
      id: issue.id,
      orderId: issue.orderId,
      stage: issue.stage,
      originalNote: issue.originalNote,
      languageHint: issue.languageHint || "auto",
    }),
  });
  if (!result.issue || typeof result.issue.id !== "string") {
    throw new Error("The issue service returned an invalid record.");
  }
  return result.issue;
}

export async function classifySavedIssue(issue, { signal } = {}) {
  try {
    const result = await apiRequest("/api/issues/classify", {
      method: "POST",
      signal,
      body: JSON.stringify({
        issueId: issue.id,
        originalNote: issue.originalNote,
        orderId: issue.orderId,
        stage: issue.stage,
        languageHint: issue.languageHint || "auto",
      }),
    });
    if (
      !result ||
      !["Tamil", "English", "Other"].includes(result.detectedLanguage) ||
      typeof result.translatedNote !== "string" ||
      !result.translatedNote.trim() ||
      !ISSUE_CATEGORIES.includes(result.category) ||
      !ISSUE_SEVERITIES.includes(result.severity) ||
      typeof result.explanation !== "string" ||
      !Number.isFinite(result.confidence) ||
      result.confidence < 0 ||
      result.confidence > 1 ||
      typeof result.needsReview !== "boolean"
    ) {
      throw new Error(
        "The classification service returned an invalid result. Your issue is saved; retry.",
      );
    }
    return result;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("Classification timed out. Your issue is saved; retry when ready.");
    }
    throw error;
  }
}

export function reviewSavedIssue(issueId, review) {
  return apiRequest(`/api/issues/${encodeURIComponent(issueId)}/review`, {
    method: "PATCH",
    body: JSON.stringify(review),
  });
}

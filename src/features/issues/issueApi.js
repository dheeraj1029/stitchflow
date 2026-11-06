import {
  ISSUE_CATEGORIES,
  ISSUE_SEVERITIES,
} from "./issueConstants.js";

export async function classifySavedIssue(issue, { signal } = {}) {
  let response;
  try {
    response = await fetch("/api/issues/classify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal,
      body: JSON.stringify({
        originalNote: issue.originalNote,
        orderId: issue.orderId,
        stage: issue.stage,
        languageHint: issue.languageHint || "auto",
      }),
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("Classification timed out. Your issue is saved; retry when ready.");
    }
    throw new Error(
      "The classification service is unavailable. Your issue is saved; start the issue API and retry.",
    );
  }

  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error(
      "The classification service returned an unreadable response. Your issue is saved; retry.",
    );
  }
  if (!response.ok) {
    throw new Error(
      typeof result.error === "string"
        ? result.error
        : "Classification failed. Your issue is saved; retry.",
    );
  }
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
}

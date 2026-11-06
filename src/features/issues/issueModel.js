import {
  ISSUE_CATEGORIES,
  ISSUE_SEVERITIES,
  REVIEW_STATUSES,
} from "./issueConstants.js";

function isValidClassification(result) {
  return Boolean(
    result &&
      ["Tamil", "English", "Other"].includes(result.detectedLanguage) &&
      typeof result.translatedNote === "string" &&
      result.translatedNote.trim() &&
      ISSUE_CATEGORIES.includes(result.category) &&
      ISSUE_SEVERITIES.includes(result.severity) &&
      typeof result.explanation === "string" &&
      Number.isFinite(result.confidence) &&
      result.confidence >= 0 &&
      result.confidence <= 1 &&
      typeof result.needsReview === "boolean",
  );
}

function appendAudit(issue, event, timestamp, details = {}) {
  return [
    ...issue.auditHistory,
    {
      id: `${issue.id}:${issue.auditHistory.length + 1}`,
      event,
      timestamp,
      ...details,
    },
  ];
}

export function createIssueRecord({
  id,
  order,
  stage,
  originalNote,
  languageHint,
  attachment = null,
  createdAt = new Date().toISOString(),
}) {
  const issue = {
    id,
    orderId: order.id,
    orderNumber: order.poNumber,
    buyer: order.buyer,
    productionUnit: order.productionUnit,
    stage,
    originalNote,
    languageHint,
    detectedLanguage: null,
    suggestedTranslation: null,
    reviewerTranslation: null,
    confirmedTranslation: null,
    suggestedCategory: null,
    confirmedCategory: null,
    suggestedSeverity: null,
    confirmedSeverity: null,
    aiExplanation: null,
    confidence: null,
    needsReview: true,
    reviewStatus: "PENDING_REVIEW",
    classificationError: null,
    classificationAttempts: 0,
    reviewerNote: "",
    attachment,
    createdAt,
    updatedAt: createdAt,
    reviewedAt: null,
    auditHistory: [],
  };
  return {
    ...issue,
    auditHistory: appendAudit(issue, "SUBMITTED", createdAt, {
      orderNumber: order.poNumber,
      stage,
    }),
  };
}

export function applyIssueClassification(issues, issueId, result, timestamp) {
  if (!isValidClassification(result)) {
    return { ok: false, error: "The classification result is invalid." };
  }
  const index = issues.findIndex((issue) => issue.id === issueId);
  if (index < 0) {
    return { ok: false, error: "The issue could not be found." };
  }
  const issue = issues[index];
  if (issue.reviewStatus === "CONFIRMED" || issue.reviewStatus === "REJECTED") {
    return { ok: false, error: "A reviewed issue cannot be reclassified." };
  }
  const updated = {
    ...issue,
    detectedLanguage: result.detectedLanguage,
    suggestedTranslation: result.translatedNote,
    suggestedCategory: result.category,
    suggestedSeverity: result.severity,
    aiExplanation: result.explanation,
    confidence: result.confidence,
    needsReview: result.needsReview,
    classificationError: null,
    classificationAttempts: issue.classificationAttempts + 1,
    reviewStatus: "PENDING_REVIEW",
    updatedAt: timestamp,
    auditHistory: appendAudit(issue, "AI_CLASSIFIED", timestamp, {
      detectedLanguage: result.detectedLanguage,
      suggestedTranslation: result.translatedNote,
      suggestedCategory: result.category,
      suggestedSeverity: result.severity,
      aiExplanation: result.explanation,
      confidence: result.confidence,
      needsReview: result.needsReview,
    }),
  };
  const next = [...issues];
  next[index] = updated;
  return { ok: true, issues: next, issue: updated };
}

export function markIssueClassificationFailed(issues, issueId, message, timestamp) {
  const index = issues.findIndex((issue) => issue.id === issueId);
  if (index < 0) {
    return { ok: false, error: "The issue could not be found." };
  }
  const issue = issues[index];
  if (issue.reviewStatus === "CONFIRMED" || issue.reviewStatus === "REJECTED") {
    return { ok: false, error: "A reviewed issue cannot be reclassified." };
  }
  const safeMessage =
    typeof message === "string" && message.trim()
      ? message.trim().slice(0, 300)
      : "Classification is unavailable. Retry when the service is available.";
  const updated = {
    ...issue,
    reviewStatus: "CLASSIFICATION_FAILED",
    classificationError: safeMessage,
    classificationAttempts: issue.classificationAttempts + 1,
    updatedAt: timestamp,
    auditHistory: appendAudit(issue, "CLASSIFICATION_FAILED", timestamp, {
      attempt: issue.classificationAttempts + 1,
      message: safeMessage,
    }),
  };
  const next = [...issues];
  next[index] = updated;
  return { ok: true, issues: next, issue: updated };
}

export function confirmIssueReview(
  issues,
  issueId,
  { translation, category, severity, reviewerNote = "" },
  timestamp,
) {
  const index = issues.findIndex((issue) => issue.id === issueId);
  if (index < 0) {
    return { ok: false, error: "The issue could not be found." };
  }
  const issue = issues[index];
  if (issue.reviewStatus !== "PENDING_REVIEW") {
    return { ok: false, error: "Only pending issues can be confirmed." };
  }
  if (
    typeof translation !== "string" ||
    !translation.trim() ||
    !ISSUE_CATEGORIES.includes(category) ||
    !ISSUE_SEVERITIES.includes(severity)
  ) {
    return { ok: false, error: "Provide a valid translation, category, and severity." };
  }
  const updated = {
    ...issue,
    reviewerTranslation:
      translation.trim() === issue.suggestedTranslation
        ? null
        : translation,
    confirmedTranslation: translation,
    confirmedCategory: category,
    confirmedSeverity: severity,
    reviewerNote: reviewerNote.trim(),
    reviewStatus: "CONFIRMED",
    reviewedAt: timestamp,
    updatedAt: timestamp,
    auditHistory: appendAudit(issue, "MERCHANDISER_CONFIRMED", timestamp, {
      confirmedCategory: category,
      confirmedSeverity: severity,
      translationCorrected: translation !== issue.suggestedTranslation,
      categoryCorrected: category !== issue.suggestedCategory,
      severityCorrected: severity !== issue.suggestedSeverity,
      reviewerNote: reviewerNote.trim(),
    }),
  };
  const next = [...issues];
  next[index] = updated;
  return { ok: true, issues: next, issue: updated };
}

export function rejectIssueReview(issues, issueId, reviewerNote, timestamp) {
  const index = issues.findIndex((issue) => issue.id === issueId);
  if (index < 0) {
    return { ok: false, error: "The issue could not be found." };
  }
  const issue = issues[index];
  if (issue.reviewStatus !== "PENDING_REVIEW") {
    return { ok: false, error: "Only pending issues can be rejected." };
  }
  const note = typeof reviewerNote === "string" ? reviewerNote.trim() : "";
  const updated = {
    ...issue,
    confirmedTranslation: null,
    confirmedCategory: null,
    confirmedSeverity: null,
    reviewerNote: note,
    reviewStatus: "REJECTED",
    reviewedAt: timestamp,
    updatedAt: timestamp,
    auditHistory: appendAudit(issue, "MERCHANDISER_REJECTED", timestamp, {
      reviewerNote: note,
    }),
  };
  const next = [...issues];
  next[index] = updated;
  return { ok: true, issues: next, issue: updated };
}

export function isBuyerWarningEligible(issue) {
  return issue?.reviewStatus === "CONFIRMED";
}

export function filterIssues(issues, orders, filters = {}) {
  const orderById = new Map(orders.map((order) => [order.id, order]));
  return issues.filter((issue) => {
    const order = orderById.get(issue.orderId);
    return (
      (!filters.status || issue.reviewStatus === filters.status) &&
      (!filters.category ||
        (issue.confirmedCategory || issue.suggestedCategory) ===
          filters.category) &&
      (!filters.severity ||
        (issue.confirmedSeverity || issue.suggestedSeverity) ===
          filters.severity) &&
      (!filters.buyer || (order?.buyer || issue.buyer) === filters.buyer) &&
      (!filters.unit ||
        (order?.productionUnit || issue.productionUnit) === filters.unit)
    );
  });
}

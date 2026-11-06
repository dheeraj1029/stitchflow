import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { X } from "lucide-react";
import Button from "../../components/Button.jsx";
import {
  CATEGORY_LABELS,
  ISSUE_CATEGORIES,
  ISSUE_SEVERITIES,
  REVIEW_STATUS_LABELS,
  SEVERITY_LABELS,
} from "./issueConstants.js";
import { isBuyerWarningEligible } from "./issueModel.js";
import {
  classifySavedIssue,
  reviewSavedIssue,
  saveIssueForReview,
} from "./issueApi.js";
import { useIssues } from "./IssuesContext.js";
import { useAuth } from "../auth/AuthContext.js";

function formatTimestamp(value) {
  if (!value || Number.isNaN(Date.parse(value))) {
    return "Date unavailable";
  }
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function eventLabel(event) {
  const labels = {
    SUBMITTED: "Issue submitted",
    AI_CLASSIFIED: "AI suggestion received",
    CLASSIFICATION_FAILED: "Classification failed",
    MERCHANDISER_CONFIRMED: "Confirmed by merchandiser",
    MERCHANDISER_REJECTED: "Rejected by merchandiser",
  };
  return labels[event] || "Issue updated";
}

export default function IssueReviewPanel({ issue, onClose }) {
  const {
    applyClassification,
    confirmIssue,
    markClassificationFailed,
    rejectIssue,
  } = useIssues();
  const { user } = useAuth();
  const [translation, setTranslation] = useState("");
  const [category, setCategory] = useState("");
  const [severity, setSeverity] = useState("");
  const [reviewerNote, setReviewerNote] = useState("");
  const [isRetrying, setIsRetrying] = useState(false);
  const [isSavingReview, setIsSavingReview] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  useEffect(() => {
    setTranslation(issue?.reviewerTranslation || issue?.suggestedTranslation || "");
    setCategory(issue?.suggestedCategory || "");
    setSeverity(issue?.suggestedSeverity || "");
    setReviewerNote(issue?.reviewerNote || "");
    setActionError("");
    setActionSuccess("");
  }, [issue]);

  useEffect(() => {
    if (!issue) {
      return undefined;
    }
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [issue, onClose]);

  if (!issue) {
    return null;
  }
  const isPending = issue.reviewStatus === "PENDING_REVIEW";
  const canReview = user?.role === "MERCHANDISER";
  const canRetry = canReview && (
    issue.reviewStatus === "CLASSIFICATION_FAILED" ||
    issue.reviewStatus === "PENDING_REVIEW");

  async function retryClassification() {
    setIsRetrying(true);
    setActionError("");
    setActionSuccess("");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20_000);
    try {
      await saveIssueForReview(issue);
      const classification = await classifySavedIssue(issue, {
        signal: controller.signal,
      });
      const result = applyClassification(issue.id, classification);
      if (!result.ok) {
        throw new Error(result.error);
      }
      setActionSuccess("A fresh AI suggestion is ready for review.");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Classification failed. The original issue remains saved.";
      markClassificationFailed(issue.id, message);
      setActionError(message);
    } finally {
      window.clearTimeout(timeout);
      setIsRetrying(false);
    }
  }

  async function handleConfirm(event) {
    event.preventDefault();
    setActionError("");
    setIsSavingReview(true);
    try {
      await saveIssueForReview(issue);
      await reviewSavedIssue(issue.id, {
        decision: "CONFIRMED",
        translation,
        category,
        severity,
        reviewerNote,
      });
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "The review could not be saved.",
      );
      setIsSavingReview(false);
      return;
    }
    const result = confirmIssue(issue.id, {
      translation,
      category,
      severity,
      reviewerNote,
    });
    if (!result.ok) {
      setActionError(result.error);
      setIsSavingReview(false);
      return;
    }
    setActionSuccess("Classification confirmed by merchandiser.");
    setIsSavingReview(false);
  }

  async function handleReject() {
    setActionError("");
    setIsSavingReview(true);
    try {
      await saveIssueForReview(issue);
      await reviewSavedIssue(issue.id, {
        decision: "REJECTED",
        reviewerNote,
      });
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "The review could not be saved.",
      );
      setIsSavingReview(false);
      return;
    }
    const result = rejectIssue(issue.id, reviewerNote);
    if (!result.ok) {
      setActionError(result.error);
      setIsSavingReview(false);
      return;
    }
    setActionSuccess("AI suggestion rejected. This issue is not buyer-warning eligible.");
    setIsSavingReview(false);
  }

  return (
    <div
      className="issue-dialog-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        aria-labelledby="issue-review-title"
        aria-modal="true"
        className="issue-review-panel"
        role="dialog"
      >
        <header className="issue-review-panel__header">
          <div>
            <span className={`issue-status-badge issue-status-badge--${issue.reviewStatus.toLowerCase()}`}>
              {REVIEW_STATUS_LABELS[issue.reviewStatus]}
            </span>
            <h2 id="issue-review-title">{issue.orderNumber} · {issue.stage}</h2>
            <p>{issue.buyer} · {issue.productionUnit || "Unit not set"}</p>
          </div>
          <button
            aria-label="Close issue details"
            className="issue-review-panel__close"
            onClick={onClose}
            type="button"
          >
            <X aria-hidden="true" size={19} />
          </button>
        </header>

        <div className="issue-review-panel__content">
          <section className="issue-original-preview" lang={issue.detectedLanguage === "Tamil" ? "ta" : "en"}>
            <h3>Original supervisor note · immutable</h3>
            <p>{issue.originalNote}</p>
            <small>
              Submitted {formatTimestamp(issue.createdAt)} ·{" "}
              {issue.detectedLanguage || "Language not detected"}
            </small>
          </section>

          {issue.reviewStatus === "CLASSIFICATION_FAILED" && (
            <div className="issue-api-error" role="alert">
              <strong>Classification failed</strong>
              <p>{issue.classificationError}</p>
              <p>The original note remains saved and unchanged.</p>
            </div>
          )}

          {issue.suggestedCategory && (
            <section className="issue-ai-suggestion">
              <h3>AI suggestion</h3>
              <p>{issue.aiExplanation}</p>
              <div className="issue-ai-suggestion__facts">
                <span>Category: <strong>{CATEGORY_LABELS[issue.suggestedCategory]}</strong></span>
                <span>Severity: <strong>{SEVERITY_LABELS[issue.suggestedSeverity]}</strong></span>
                <span>Confidence: <strong>{Math.round(issue.confidence * 100)}%</strong></span>
                <span>{issue.needsReview ? "AI marked for careful review" : "Manual confirmation still required"}</span>
              </div>
            </section>
          )}

          {issue.attachment && (
            <p className="issue-attachment">
              Photo metadata: {issue.attachment.fileName} ·{" "}
              {(issue.attachment.size / (1024 * 1024)).toFixed(2)} MB. Image
              content was not uploaded or sent to AI.
            </p>
          )}

          {isPending && canReview && (
            <form className="issue-review-form" onSubmit={handleConfirm}>
              <label>
                <span>English translation</span>
                <textarea
                  lang="en"
                  onChange={(event) => setTranslation(event.target.value)}
                  rows={3}
                  value={translation}
                />
              </label>
              <div className="issue-review-form__grid">
                <label>
                  <span>Category</span>
                  <select onChange={(event) => setCategory(event.target.value)} value={category}>
                    <option value="">Select category</option>
                    {ISSUE_CATEGORIES.map((item) => (
                      <option key={item} value={item}>{CATEGORY_LABELS[item]}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Severity</span>
                  <select onChange={(event) => setSeverity(event.target.value)} value={severity}>
                    <option value="">Select severity</option>
                    {ISSUE_SEVERITIES.map((item) => (
                      <option key={item} value={item}>{SEVERITY_LABELS[item]}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                <span>Correction or review note (optional)</span>
                <textarea
                  onChange={(event) => setReviewerNote(event.target.value)}
                  rows={2}
                  value={reviewerNote}
                />
              </label>
              <div className="issue-review-actions">
                <Button disabled={isSavingReview} type="submit" variant="primary">Confirm classification</Button>
                <Button disabled={isSavingReview} onClick={handleReject} variant="secondary">Reject AI suggestion</Button>
              </div>
            </form>
          )}
          {isPending && !canReview && (
            <p className="issue-review-status issue-review-status--pending">
              Only a merchandiser can confirm or reject this classification.
            </p>
          )}

          {canRetry && (
            <Button
              disabled={isRetrying || isSavingReview}
              onClick={retryClassification}
              variant="secondary"
            >
              {isRetrying ? "Retrying classification…" : "Retry classification"}
            </Button>
          )}

          {issue.reviewStatus === "CONFIRMED" && (
            <section className="buyer-warning-eligible">
              <strong>Eligible for buyer warning</strong>
              <p>
                The merchandiser confirmed this issue. Sending buyer warnings
                is not implemented and no message has been sent.
              </p>
              <p>
                Confirmed: {CATEGORY_LABELS[issue.confirmedCategory]} ·{" "}
                {SEVERITY_LABELS[issue.confirmedSeverity]}
              </p>
            </section>
          )}
          {issue.reviewStatus === "REJECTED" && (
            <p className="issue-review-status issue-review-status--rejected">
              Rejected by merchandiser. Not eligible for buyer warning.
            </p>
          )}
          {issue.reviewerNote && (
            <section className="issue-review-note">
              <h3>Merchandiser note</h3>
              <p>{issue.reviewerNote}</p>
            </section>
          )}
          {actionError && <p className="form-alert form-alert--error" role="alert">{actionError}</p>}
          {actionSuccess && <p className="form-alert form-alert--success" role="status">{actionSuccess}</p>}

          <section className="issue-audit-history">
            <h3>Audit history</h3>
            <ol>
              {issue.auditHistory.map((event) => (
                <li key={event.id}>
                  <strong>{eventLabel(event.event)}</strong>
                  <span>{formatTimestamp(event.timestamp)}</span>
                  {event.event === "AI_CLASSIFIED" && (
                    <small>
                      {CATEGORY_LABELS[event.suggestedCategory]} ·{" "}
                      {SEVERITY_LABELS[event.suggestedSeverity]} ·{" "}
                      {Math.round(event.confidence * 100)}% confidence
                    </small>
                  )}
                  {event.event === "MERCHANDISER_CONFIRMED" && (
                    <small>
                      Confirmed {CATEGORY_LABELS[event.confirmedCategory]} ·{" "}
                      {SEVERITY_LABELS[event.confirmedSeverity]}
                    </small>
                  )}
                </li>
              ))}
            </ol>
          </section>
          <Link className="issue-review-panel__order-link" to={`/orders/${encodeURIComponent(issue.orderNumber)}`}>
            View production order
          </Link>
        </div>
      </section>
    </div>
  );
}

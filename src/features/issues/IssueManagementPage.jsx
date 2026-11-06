import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Plus, SearchX } from "lucide-react";
import Button from "../../components/Button.jsx";
import PageHeader from "../../components/PageHeader.jsx";
import { useOrders } from "../../state/OrdersContext.js";
import { useIssues } from "./IssuesContext.js";
import {
  CATEGORY_LABELS,
  ISSUE_CATEGORIES,
  ISSUE_SEVERITIES,
  REVIEW_STATUS_LABELS,
  REVIEW_STATUSES,
  SEVERITY_LABELS,
} from "./issueConstants.js";
import { filterIssues } from "./issueModel.js";
import IssueReviewPanel from "./IssueReviewPanel.jsx";

function preview(value, limit = 105) {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length > limit ? `${compact.slice(0, limit)}…` : compact;
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(date);
}

function IssueTable({ issues, onOpen }) {
  if (!issues.length) {
    return (
      <div className="issues-empty-state">
        <SearchX aria-hidden="true" size={23} />
        <h3>No matching production issues</h3>
        <p>Try clearing one or more filters.</p>
      </div>
    );
  }
  return (
    <div className="issues-table-scroll">
      <table className="issues-table">
        <thead>
          <tr>
            <th scope="col">Issue / PO</th>
            <th scope="col">Production stage</th>
            <th scope="col">Original note / English</th>
            <th scope="col">Category</th>
            <th scope="col">Severity</th>
            <th scope="col">Review status</th>
            <th scope="col">Submitted</th>
            <th scope="col"><span className="visually-hidden">Review</span></th>
          </tr>
        </thead>
        <tbody>
          {issues.map((issue) => (
            <tr key={issue.id}>
              <td data-label="Issue / PO">
                <strong>{issue.id.slice(0, 12)}</strong>
                <span>{issue.orderNumber} · {issue.buyer}</span>
                <small>{issue.productionUnit || "Unit not set"}</small>
              </td>
              <td data-label="Production stage">{issue.stage}</td>
              <td data-label="Original note / English">
                <span lang={issue.detectedLanguage === "Tamil" ? "ta" : "en"}>
                  {preview(issue.originalNote)}
                </span>
                <small>
                  English:{" "}
                  {preview(
                    issue.confirmedTranslation ||
                      issue.reviewerTranslation ||
                      issue.suggestedTranslation ||
                      "Not available",
                  )}
                </small>
              </td>
              <td data-label="Category">
                {CATEGORY_LABELS[
                  issue.confirmedCategory || issue.suggestedCategory
                ] || "Not classified"}
              </td>
              <td data-label="Severity">
                {SEVERITY_LABELS[
                  issue.confirmedSeverity || issue.suggestedSeverity
                ] || "Not classified"}
              </td>
              <td data-label="Review status">
                <span className={`issue-status-badge issue-status-badge--${issue.reviewStatus.toLowerCase()}`}>
                  {REVIEW_STATUS_LABELS[issue.reviewStatus]}
                </span>
              </td>
              <td data-label="Submitted">{formatDate(issue.createdAt)}</td>
              <td data-label="Review">
                <button
                  aria-label={`Review issue for ${issue.orderNumber}`}
                  className="issue-row-action"
                  onClick={() => onOpen(issue.id)}
                  type="button"
                >
                  {issue.reviewStatus === "PENDING_REVIEW" ||
                  issue.reviewStatus === "CLASSIFICATION_FAILED"
                    ? "Review"
                    : "Details"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function IssueManagementPage() {
  const { orders } = useOrders();
  const { issues, storageError } = useIssues();
  const [searchParams, setSearchParams] = useSearchParams();
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [severity, setSeverity] = useState("");
  const [buyer, setBuyer] = useState("");
  const [unit, setUnit] = useState("");
  const selectedIssueId = searchParams.get("issue") || "";
  const buyers = useMemo(
    () => [...new Set(issues.map((issue) => issue.buyer).filter(Boolean))].sort(),
    [issues],
  );
  const units = useMemo(
    () =>
      [...new Set(issues.map((issue) => issue.productionUnit).filter(Boolean))].sort(),
    [issues],
  );
  const filteredIssues = useMemo(
    () => filterIssues(issues, orders, { status, category, severity, buyer, unit })
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [issues, orders, status, category, severity, buyer, unit],
  );
  const selectedIssue = issues.find((issue) => issue.id === selectedIssueId);
  const hasFilters = Boolean(status || category || severity || buyer || unit);

  useEffect(() => {
    if (selectedIssueId && !selectedIssue) {
      setSearchParams({}, { replace: true });
    }
  }, [selectedIssue, selectedIssueId, setSearchParams]);

  function openIssue(issueId) {
    setSearchParams({ issue: issueId });
  }

  function closeIssue() {
    setSearchParams({});
  }

  function resetFilters() {
    setStatus("");
    setCategory("");
    setSeverity("");
    setBuyer("");
    setUnit("");
  }

  return (
    <div className="issue-management-page">
      <header className="issue-management-header">
        <PageHeader
          description="Review AI suggestions, preserve the supervisor's original report, and confirm any future buyer-warning eligibility."
          title="Production Issues"
        />
        <Button as={Link} to="/issues/new" variant="primary">
          <Plus aria-hidden="true" size={17} />
          Report issue
        </Button>
      </header>
      <p className="issue-demo-notice">
        Issue records are saved in this browser&apos;s localStorage for this
        phase. This is demo persistence, not shared or production-grade storage.
        No buyer warnings are sent.
      </p>
      {storageError && <p className="storage-warning" role="alert">{storageError}</p>}
      {issues.length === 0 ? (
        <section className="issues-empty-state issues-empty-state--first">
          <SearchX aria-hidden="true" size={25} />
          <h2>No production issues yet</h2>
          <p>Submitted supervisor reports will be saved here for review.</p>
          <Button as={Link} to="/issues/new" variant="primary">Report production issue</Button>
        </section>
      ) : (
        <section aria-label="Production issues" className="issues-card">
          <div className="issues-card__header">
            <div>
              <h2>Issue history</h2>
              <p>{filteredIssues.length} of {issues.length} issue records</p>
            </div>
            {hasFilters && (
              <button className="issues-reset" onClick={resetFilters} type="button">
                Reset filters
              </button>
            )}
          </div>
          <div aria-label="Filter production issues" className="issues-filters">
            <label>
              <span>Review status</span>
              <select onChange={(event) => setStatus(event.target.value)} value={status}>
                <option value="">All statuses</option>
                {REVIEW_STATUSES.map((value) => (
                  <option key={value} value={value}>{REVIEW_STATUS_LABELS[value]}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Category</span>
              <select onChange={(event) => setCategory(event.target.value)} value={category}>
                <option value="">All categories</option>
                {ISSUE_CATEGORIES.map((value) => (
                  <option key={value} value={value}>{CATEGORY_LABELS[value]}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Severity</span>
              <select onChange={(event) => setSeverity(event.target.value)} value={severity}>
                <option value="">All severities</option>
                {ISSUE_SEVERITIES.map((value) => (
                  <option key={value} value={value}>{SEVERITY_LABELS[value]}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Buyer</span>
              <select onChange={(event) => setBuyer(event.target.value)} value={buyer}>
                <option value="">All buyers</option>
                {buyers.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
            <label>
              <span>Production unit</span>
              <select onChange={(event) => setUnit(event.target.value)} value={unit}>
                <option value="">All units</option>
                {units.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
          </div>
          <IssueTable issues={filteredIssues} onOpen={openIssue} />
        </section>
      )}
      <IssueReviewPanel issue={selectedIssue} onClose={closeIssue} />
    </div>
  );
}

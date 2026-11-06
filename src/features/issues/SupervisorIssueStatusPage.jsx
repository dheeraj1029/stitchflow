import { Link } from "react-router-dom";
import { MessageSquareWarning, Plus } from "lucide-react";
import Button from "../../components/Button.jsx";
import PageHeader from "../../components/PageHeader.jsx";
import { REVIEW_STATUS_LABELS } from "./issueConstants.js";
import { useIssues } from "./IssuesContext.js";
import { useAuth } from "../auth/AuthContext.js";

export default function SupervisorIssueStatusPage() {
  const { issues } = useIssues();
  const { user } = useAuth();
  const visibleIssues = issues
    .filter((issue) => issue.productionUnit === user?.productionUnitName)
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="supervisor-issues-page">
      <header className="supervisor-issues-page__header">
        <PageHeader
          description="Check the review status of reports from your production unit. AI suggestions and internal review notes are not shown here."
          title="Issue Reports"
        />
        <Button as={Link} to="/issues/new" variant="primary">
          <Plus aria-hidden="true" size={17} />
          Report issue
        </Button>
      </header>
      <p className="issue-demo-notice">
        These browser-saved reports are local demo data. Only issue status and
        the submitted note are shown in this workspace.
      </p>
      {visibleIssues.length ? (
        <section aria-label="Issue report status" className="supervisor-issues-list">
          {visibleIssues.map((issue) => (
            <article className="supervisor-issue-card" key={issue.id}>
              <div className="supervisor-issue-card__heading">
                <div>
                  <p>{issue.orderNumber} · {issue.stage}</p>
                  <h2>{REVIEW_STATUS_LABELS[issue.reviewStatus]}</h2>
                </div>
                <span aria-hidden="true" className="supervisor-issue-card__icon">
                  <MessageSquareWarning size={18} />
                </span>
              </div>
              <p className="supervisor-issue-card__note">{issue.originalNote}</p>
              <p className="supervisor-issue-card__meta">
                {issue.classificationError
                  ? "Classification could not be completed; a merchandiser will review the report."
                  : issue.reviewStatus === "PENDING_REVIEW"
                    ? "Waiting for merchandiser review."
                    : issue.reviewStatus === "CONFIRMED"
                      ? "Reviewed by a merchandiser."
                      : issue.reviewStatus === "REJECTED"
                        ? "Reviewed and closed."
                        : "Submitted for review."}
              </p>
            </article>
          ))}
        </section>
      ) : (
        <section className="issues-empty-state issues-empty-state--first">
          <MessageSquareWarning aria-hidden="true" size={24} />
          <h2>No issue reports for this unit</h2>
          <p>Reports submitted by your production unit will appear here.</p>
        </section>
      )}
    </div>
  );
}

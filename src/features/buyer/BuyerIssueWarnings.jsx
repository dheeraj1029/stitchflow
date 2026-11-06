import { AlertTriangle } from "lucide-react";

const severityLabels = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical",
};

export default function BuyerIssueWarnings({ warnings, compact = false }) {
  if (!warnings.length) {
    return (
      <div className="buyer-empty-inline">
        No confirmed production warnings for this order.
      </div>
    );
  }
  return (
    <div className={`buyer-warnings${compact ? " buyer-warnings--compact" : ""}`}>
      {warnings.map((warning) => (
        <article className="buyer-warning" key={warning.id}>
          <span aria-hidden="true" className="buyer-warning__icon">
            <AlertTriangle size={17} />
          </span>
          <div>
            <div className="buyer-warning__title">
              <strong>{warning.category.replaceAll("_", " ")}</strong>
              <span className={`buyer-severity buyer-severity--${warning.severity.toLowerCase()}`}>
                {severityLabels[warning.severity] || warning.severity}
              </span>
            </div>
            <p>{warning.translation}</p>
            <small>Confirmed {formatDate(warning.confirmedAt)}</small>
          </div>
        </article>
      ))}
    </div>
  );
}

function formatDate(value) {
  if (!value || Number.isNaN(Date.parse(value))) return "recently";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(
    new Date(value),
  );
}

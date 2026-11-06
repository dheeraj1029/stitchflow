import { ArrowRight, TriangleAlert } from "lucide-react";
import { Link } from "react-router-dom";
import Card from "../../components/Card.jsx";
import { RISK_LABELS, RISK_LEVELS } from "./riskConstants.js";
import { summarizeOrderRisks } from "./riskEngine.js";

const riskOrder = {
  [RISK_LEVELS.RED]: 0,
  [RISK_LEVELS.AMBER]: 1,
  [RISK_LEVELS.UNKNOWN]: 2,
  [RISK_LEVELS.GREEN]: 3,
};

export default function RiskDashboardSummary({ assessments }) {
  const summary = summarizeOrderRisks(assessments);
  const attention = assessments
    .filter(
      ({ riskLevel }) =>
        riskLevel === RISK_LEVELS.RED || riskLevel === RISK_LEVELS.AMBER,
    )
    .sort(
      (a, b) =>
        riskOrder[a.riskLevel] - riskOrder[b.riskLevel] ||
        (a.milestoneDate || "").localeCompare(b.milestoneDate || ""),
    )
    .slice(0, 3);

  return (
    <Card className="dashboard-risk-summary" title="Calculated production risk">
      <div className="dashboard-risk-summary__totals">
        <span><strong>{summary.highRisk}</strong> high risk</span>
        <span><strong>{summary.needsAttention}</strong> need attention</span>
        <span><strong>{summary.insufficientData}</strong> insufficient data</span>
      </div>
      {attention.length ? (
        <ul className="dashboard-risk-summary__list">
          {attention.map((item) => (
            <li key={`${item.orderId}:${item.stage}`}>
              <span aria-hidden="true" className={`risk-summary-dot risk-summary-dot--${item.riskLevel}`}>
                <TriangleAlert size={15} />
              </span>
              <span className="dashboard-risk-summary__item">
                <strong>{item.poNumber} · {item.stage}</strong>
                <small>
                  {item.remainingQuantity === null
                    ? "Remaining quantity unavailable"
                    : `${item.remainingQuantity.toLocaleString("en")} pcs remain`}
                  {" · "}{RISK_LABELS[item.riskLevel]}
                </small>
              </span>
              <Link
                aria-label={`View ${item.poNumber} risk details`}
                to={`/orders/${encodeURIComponent(item.poNumber)}`}
              >
                <ArrowRight aria-hidden="true" size={16} />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="dashboard-risk-summary__empty">
          No stage is currently classified as high risk or needing attention.
        </p>
      )}
      <Link className="dashboard-risk-summary__link" to="/delay-warnings">
        View risk monitor <ArrowRight aria-hidden="true" size={15} />
      </Link>
      <small className="dashboard-risk-summary__disclaimer">
        Calculated signals only; manually stored order statuses are unchanged.
      </small>
    </Card>
  );
}

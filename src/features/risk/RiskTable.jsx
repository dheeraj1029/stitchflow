import { ArrowUpRight, SearchX } from "lucide-react";
import { formatDate } from "./riskHelpers.js";
import { RISK_LABELS } from "./riskConstants.js";

const numberFormatter = new Intl.NumberFormat("en");
const rateFormatter = new Intl.NumberFormat("en", {
  maximumFractionDigits: 1,
});

function formatRate(value, hasHistory = true) {
  if (!hasHistory) {
    return "Insufficient history";
  }
  return value === null || !Number.isFinite(value)
    ? "Unavailable"
    : `${rateFormatter.format(value)} pcs/day`;
}

export default function RiskTable({ assessments, onSelect }) {
  if (!assessments.length) {
    return (
      <div className="risk-empty-state">
        <SearchX aria-hidden="true" size={22} />
        <h3>No matching risk assessments</h3>
        <p>Try changing or clearing the selected filters.</p>
      </div>
    );
  }

  return (
    <div className="risk-table-scroll">
      <table className="risk-table">
        <thead>
          <tr>
            <th scope="col">Order</th>
            <th scope="col">Production stage</th>
            <th scope="col">Stage output</th>
            <th scope="col">Remaining</th>
            <th scope="col">Required / actual daily</th>
            <th scope="col">Milestone / projected</th>
            <th scope="col">Risk</th>
            <th scope="col"><span className="visually-hidden">Details</span></th>
          </tr>
        </thead>
        <tbody>
          {assessments.map((item) => (
            <tr key={`${item.orderId}:${item.stage}`}>
              <td data-label="Order">
                <strong>{item.poNumber}</strong>
                <span>{item.buyer}</span>
                <span>{item.style}</span>
                <small>{item.productionUnit || "Unit not set"}</small>
              </td>
              <td data-label="Production stage">{item.stage}</td>
              <td data-label="Stage output">
                {numberFormatter.format(item.output)} /{" "}
                {item.target === null
                  ? "Target unavailable"
                  : numberFormatter.format(item.target)}{" "}
                pcs
              </td>
              <td data-label="Remaining">
                {item.remainingQuantity === null
                  ? "Unavailable"
                  : `${numberFormatter.format(item.remainingQuantity)} pcs`}
              </td>
              <td data-label="Required / actual daily">
                <span>Required: {formatRate(item.requiredDailyRate)}</span>
                <span>
                  Actual:{" "}
                  {formatRate(item.actualDailyRate, item.hasSufficientHistory)}
                </span>
              </td>
              <td data-label="Milestone / projected">
                <span>
                  {item.plannedMilestone}:{" "}
                  {item.milestoneDate
                    ? formatDate(item.milestoneDate)
                    : "Date unavailable"}
                </span>
                <span>
                  Projected:{" "}
                  {item.projectedCompletionDate
                    ? formatDate(item.projectedCompletionDate)
                    : "Unavailable"}
                </span>
              </td>
              <td data-label="Risk">
                <span className={`risk-badge risk-badge--${item.riskLevel}`}>
                  {RISK_LABELS[item.riskLevel]}
                </span>
              </td>
              <td data-label="Details">
                <button
                  aria-label={`View risk details for ${item.poNumber}, ${item.stage}`}
                  className="risk-table__details"
                  onClick={() => onSelect(item)}
                  type="button"
                >
                  Details <ArrowUpRight aria-hidden="true" size={14} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

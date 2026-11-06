import { useEffect } from "react";
import { X } from "lucide-react";
import { formatDate } from "./riskHelpers.js";
import { RISK_LABELS } from "./riskConstants.js";

const numberFormatter = new Intl.NumberFormat("en");
const rateFormatter = new Intl.NumberFormat("en", {
  maximumFractionDigits: 1,
});

function formatRate(value) {
  return value === null || !Number.isFinite(value)
    ? "Unavailable"
    : `${rateFormatter.format(value)} pcs / working day`;
}

export default function RiskDetailsPanel({ assessment, onClose }) {
  useEffect(() => {
    if (!assessment) {
      return undefined;
    }
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [assessment, onClose]);

  if (!assessment) {
    return null;
  }
  const observationStart =
    assessment.observedDates[0] || "unavailable";
  const observationEnd =
    assessment.observedDates[assessment.observedDates.length - 1] ||
    "unavailable";
  const { riskLevel } = assessment;

  return (
    <div
      className="risk-dialog-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        aria-labelledby="risk-details-title"
        aria-modal="true"
        className="risk-details-panel"
        role="dialog"
      >
        <header className="risk-details-panel__header">
          <div>
            <span className={`risk-badge risk-badge--${riskLevel}`}>
              {RISK_LABELS[riskLevel]}
            </span>
            <h2 id="risk-details-title">
              {assessment.poNumber} · {assessment.stage}
            </h2>
            <p>{assessment.buyer} · {assessment.style}</p>
          </div>
          <button
            aria-label="Close risk details"
            className="risk-details-panel__close"
            onClick={onClose}
            type="button"
          >
            <X aria-hidden="true" size={19} />
          </button>
        </header>

        <div className="risk-details-panel__content">
          <section
            aria-label="Production stage progress"
            className="risk-detail-progress"
          >
            <div className="risk-detail-progress__heading">
              <span>Stage-specific output</span>
              <strong>
                {numberFormatter.format(assessment.output)} /{" "}
                {assessment.target === null
                  ? "Target unavailable"
                  : `${numberFormatter.format(assessment.target)} pcs`}
              </strong>
            </div>
            {assessment.progressPercent !== null && (
              <>
                <div
                  aria-label={`${assessment.stage} stage progress`}
                  aria-valuemax="100"
                  aria-valuemin="0"
                  aria-valuenow={Math.round(assessment.progressPercent)}
                  className="risk-detail-progress__track"
                  role="progressbar"
                >
                  <span style={{ width: `${assessment.progressPercent}%` }} />
                </div>
                <small>
                  {assessment.progressPercent.toFixed(1)}% of this stage target
                </small>
              </>
            )}
          </section>

          <dl className="risk-detail-grid">
            <div>
              <dt>Production unit</dt>
              <dd>{assessment.productionUnit || "Not set"}</dd>
            </div>
            <div>
              <dt>Remaining quantity</dt>
              <dd>
                {assessment.remainingQuantity === null
                  ? "Unavailable"
                  : `${numberFormatter.format(assessment.remainingQuantity)} pcs`}
              </dd>
            </div>
            <div>
              <dt>Required daily rate</dt>
              <dd>{formatRate(assessment.requiredDailyRate)}</dd>
            </div>
            <div>
              <dt>Actual daily rate</dt>
              <dd>
                {assessment.hasSufficientHistory
                  ? formatRate(assessment.actualDailyRate)
                  : "Insufficient production history"}
              </dd>
            </div>
            <div>
              <dt>Planned milestone</dt>
              <dd>{assessment.plannedMilestone}</dd>
            </div>
            <div>
              <dt>Milestone date</dt>
              <dd>
                {assessment.milestoneDate
                  ? formatDate(assessment.milestoneDate)
                  : "Date unavailable"}
              </dd>
            </div>
            <div>
              <dt>Projected completion</dt>
              <dd>
                {assessment.projectedCompletionDate
                  ? formatDate(assessment.projectedCompletionDate)
                  : "Cannot be calculated reliably"}
              </dd>
            </div>
            <div>
              <dt>Working days to milestone</dt>
              <dd>
                {assessment.remainingWorkingDays === null
                  ? "Unavailable"
                  : assessment.remainingWorkingDays}
              </dd>
            </div>
          </dl>

          <p className="risk-observation-note">
            Actual rate uses {assessment.observationWorkingDays} working days
            (
            {observationStart !== "unavailable"
              ? formatDate(observationStart)
              : observationStart}
            –
            {observationEnd !== "unavailable"
              ? formatDate(observationEnd)
              : observationEnd}
            ), including days without a recorded update.{" "}
            {assessment.recordedUpdateCount} matching update
            {assessment.recordedUpdateCount === 1 ? "" : "s"} counted.
          </p>

          <section className={`risk-explanation risk-explanation--${riskLevel}`}>
            <h3>Why this risk level?</h3>
            <p>{assessment.explanation}</p>
          </section>
          <section className="risk-recommendation">
            <h3>Recommended next action</h3>
            <p>{assessment.recommendedAction}</p>
            <small>Suggested action only; confirm with the production team.</small>
          </section>
        </div>
      </section>
    </div>
  );
}

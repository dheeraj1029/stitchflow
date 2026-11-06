import { useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";
import PageHeader from "../../components/PageHeader.jsx";
import { useOrders } from "../../state/OrdersContext.js";
import { useProductionUpdates } from "../../state/ProductionUpdatesContext.js";
import { RISK_LEVELS } from "./riskConstants.js";
import RiskDetailsPanel from "./RiskDetailsPanel.jsx";
import { predictProductionRisks, summarizeOrderRisks } from "./riskEngine.js";
import RiskSummaryCards from "./RiskSummaryCards.jsx";
import RiskTable from "./RiskTable.jsx";

const riskOrder = {
  [RISK_LEVELS.RED]: 0,
  [RISK_LEVELS.AMBER]: 1,
  [RISK_LEVELS.UNKNOWN]: 2,
  [RISK_LEVELS.GREEN]: 3,
};

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );
}

export default function RiskMonitorPage() {
  const { orders } = useOrders();
  const { updates } = useProductionUpdates();
  const [selectedBuyer, setSelectedBuyer] = useState("");
  const [selectedUnit, setSelectedUnit] = useState("");
  const [selectedRisk, setSelectedRisk] = useState("");
  const [selectedStage, setSelectedStage] = useState("");
  const [selectedAssessmentKey, setSelectedAssessmentKey] = useState("");
  const assessments = useMemo(
    () => predictProductionRisks(orders, updates, new Date()),
    [orders, updates],
  );
  const summary = useMemo(
    () => summarizeOrderRisks(assessments),
    [assessments],
  );
  const selectedAssessment = assessments.find(
    (assessment) =>
      `${assessment.orderId}:${assessment.stage}` === selectedAssessmentKey,
  );
  const buyers = useMemo(
    () => uniqueSorted(assessments.map(({ buyer }) => buyer)),
    [assessments],
  );
  const units = useMemo(
    () => uniqueSorted(assessments.map(({ productionUnit }) => productionUnit)),
    [assessments],
  );
  const stages = useMemo(
    () => uniqueSorted(assessments.map(({ stage }) => stage)),
    [assessments],
  );
  const filteredAssessments = useMemo(
    () =>
      assessments
        .filter(
          (assessment) =>
            (!selectedBuyer || assessment.buyer === selectedBuyer) &&
            (!selectedUnit || assessment.productionUnit === selectedUnit) &&
            (!selectedRisk || assessment.riskLevel === selectedRisk) &&
            (!selectedStage || assessment.stage === selectedStage),
        )
        .sort(
          (a, b) =>
            riskOrder[a.riskLevel] - riskOrder[b.riskLevel] ||
            (a.milestoneDate || "").localeCompare(b.milestoneDate || "") ||
            a.poNumber.localeCompare(b.poNumber),
        ),
    [assessments, selectedBuyer, selectedRisk, selectedStage, selectedUnit],
  );
  const hasFilters = Boolean(
    selectedBuyer || selectedUnit || selectedRisk || selectedStage,
  );
  const resetFilters = () => {
    setSelectedBuyer("");
    setSelectedUnit("");
    setSelectedRisk("");
    setSelectedStage("");
  };

  return (
    <div className="risk-monitor">
      <PageHeader
        description="Transparent, rule-based estimates from stage output, milestones, and recent supervisor updates."
        title="Delay Warnings"
      />
      <p className="risk-monitor__note">
        Risk is calculated independently for each workflow stage and does not
        change the order&apos;s manually maintained status. Stage dates use the
        matching T&A milestone; stages without a mapped milestone are marked
        insufficient data. Status summary categories may overlap when an
        order has different signals across its stages.
      </p>
      <RiskSummaryCards summary={summary} />

      <section
        aria-label="Production risk assessments"
        className="risk-assessments"
      >
        <div className="risk-assessments__heading">
          <div>
            <h2>Stage risk overview</h2>
            <p>
              {filteredAssessments.length} of {assessments.length} stage
              assessment{assessments.length === 1 ? "" : "s"}
            </p>
          </div>
          {hasFilters && (
            <button
              className="risk-filter-reset"
              onClick={resetFilters}
              type="button"
            >
              <RotateCcw aria-hidden="true" size={14} />
              Reset filters
            </button>
          )}
        </div>
        <div aria-label="Filter risk assessments" className="risk-filters">
          <label>
            <span>Buyer</span>
            <select
              onChange={(event) => setSelectedBuyer(event.target.value)}
              value={selectedBuyer}
            >
              <option value="">All buyers</option>
              {buyers.map((buyer) => (
                <option key={buyer} value={buyer}>{buyer}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Production unit</span>
            <select
              onChange={(event) => setSelectedUnit(event.target.value)}
              value={selectedUnit}
            >
              <option value="">All units</option>
              {units.map((unit) => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Risk level</span>
            <select
              onChange={(event) => setSelectedRisk(event.target.value)}
              value={selectedRisk}
            >
              <option value="">All risk levels</option>
              <option value={RISK_LEVELS.RED}>High risk</option>
              <option value={RISK_LEVELS.AMBER}>Needs attention</option>
              <option value={RISK_LEVELS.GREEN}>On track</option>
              <option value={RISK_LEVELS.UNKNOWN}>Insufficient data</option>
            </select>
          </label>
          <label>
            <span>Production stage</span>
            <select
              onChange={(event) => setSelectedStage(event.target.value)}
              value={selectedStage}
            >
              <option value="">All stages</option>
              {stages.map((stage) => (
                <option key={stage} value={stage}>{stage}</option>
              ))}
            </select>
          </label>
        </div>
        <RiskTable
          assessments={filteredAssessments}
          onSelect={(assessment) =>
            setSelectedAssessmentKey(
              `${assessment.orderId}:${assessment.stage}`,
            )
          }
        />
      </section>
      <RiskDetailsPanel
        assessment={selectedAssessment}
        onClose={() => setSelectedAssessmentKey("")}
      />
    </div>
  );
}

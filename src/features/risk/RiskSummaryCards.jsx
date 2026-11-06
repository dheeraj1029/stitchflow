import {
  AlertTriangle,
  CircleCheck,
  CircleHelp,
  ClipboardList,
  Siren,
} from "lucide-react";
import Card from "../../components/Card.jsx";
import { RISK_LABELS, RISK_LEVELS } from "./riskConstants.js";

const cards = [
  {
    key: "totalOrders",
    label: "Orders monitored",
    icon: ClipboardList,
    tone: "navy",
  },
  {
    key: "highRisk",
    label: RISK_LABELS[RISK_LEVELS.RED],
    icon: Siren,
    tone: "red",
  },
  {
    key: "needsAttention",
    label: RISK_LABELS[RISK_LEVELS.AMBER],
    icon: AlertTriangle,
    tone: "amber",
  },
  {
    key: "onTrack",
    label: RISK_LABELS[RISK_LEVELS.GREEN],
    icon: CircleCheck,
    tone: "green",
  },
  {
    key: "insufficientData",
    label: RISK_LABELS[RISK_LEVELS.UNKNOWN],
    icon: CircleHelp,
    tone: "muted",
  },
];

export default function RiskSummaryCards({ summary }) {
  return (
    <section aria-label="Production risk summary" className="risk-summary-grid">
      {cards.map(({ key, label, icon: Icon, tone }) => (
        <Card className={`risk-summary-card risk-summary-card--${tone}`} key={key}>
          <span aria-hidden="true" className="risk-summary-card__icon">
            <Icon size={18} />
          </span>
          <span className="risk-summary-card__label">{label}</span>
          <strong>{summary[key]}</strong>
          <span className="risk-summary-card__caption">
            {key === "totalOrders"
              ? "Unique production orders"
              : key === "onTrack"
                ? "All workflow stages on track"
                : "At least one matching stage"}
          </span>
        </Card>
      ))}
    </section>
  );
}

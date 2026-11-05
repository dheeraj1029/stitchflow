import Card from "./Card.jsx";

export default function KpiCard({ description, icon: Icon, label, tone, value }) {
  return (
    <Card className={`kpi-card kpi-card--${tone}`} title={label}>
      <div aria-hidden="true" className="kpi-card__icon">
        <Icon size={18} strokeWidth={1.9} />
      </div>
      <p className="kpi-card__value">{value}</p>
      <p className="kpi-card__description">{description}</p>
    </Card>
  );
}

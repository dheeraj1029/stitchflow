import { ArrowUpRight, Image } from "lucide-react";
import { Link } from "react-router-dom";
import Card from "./Card.jsx";

const dateFormatter = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  year: "numeric",
});
const submittedFormatter = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});
const numberFormatter = new Intl.NumberFormat("en");

function formatDate(value, formatter = dateFormatter) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : formatter.format(date);
}

export default function ProductionUpdateCard({ order, update }) {
  return (
    <Card className="production-update-card">
      <div className="production-update-card__topline">
        <div>
          <p className="production-update-card__po">{update.poNumber}</p>
          <p className="production-update-card__style">
            {order?.style || "Order style unavailable"}
          </p>
        </div>
        <Link
          aria-label={`View update for ${update.poNumber} on ${formatDate(update.productionDate)}`}
          className="production-update-card__open"
          to={`/production-updates/${encodeURIComponent(update.id)}`}
        >
          <ArrowUpRight aria-hidden="true" size={17} />
        </Link>
      </div>
      <div className="production-update-card__meta">
        <span>{update.stage}</span>
        <span>{formatDate(`${update.productionDate}T12:00:00`)}</span>
        <strong>+{numberFormatter.format(update.completedQuantity)} pcs</strong>
      </div>
      {update.issueNote && (
        <p className="production-update-card__issue">{update.issueNote}</p>
      )}
      {update.attachment && (
        <p className="production-update-card__attachment">
          <Image aria-hidden="true" size={14} />
          {update.attachment.fileName}
          <span>· preview not saved</span>
        </p>
      )}
      <p className="production-update-card__submitted">
        Submitted {formatDate(update.submittedAt, submittedFormatter)} by{" "}
        {update.supervisor}
      </p>
    </Card>
  );
}

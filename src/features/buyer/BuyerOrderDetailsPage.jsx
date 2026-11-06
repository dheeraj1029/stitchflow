import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, CalendarDays, CheckCircle2, Circle, Clock3 } from "lucide-react";
import { apiRequest } from "../auth/authApi.js";
import BuyerIssueWarnings from "./BuyerIssueWarnings.jsx";
import { useBuyerPortal } from "./BuyerPortalContext.js";

const numberFormatter = new Intl.NumberFormat("en");

export default function BuyerOrderDetailsPage() {
  const { orderId } = useParams();
  const { issues } = useBuyerPortal();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    apiRequest(`/api/orders/${encodeURIComponent(orderId)}`)
      .then((result) => {
        if (!result.order) throw new Error("Order details are unavailable.");
        if (active) setOrder(result.order);
      })
      .catch((requestError) => {
        if (active) {
          setOrder(null);
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Order details could not be loaded.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [orderId]);

  if (loading) {
    return <p aria-live="polite" className="buyer-load-state">Loading order details…</p>;
  }
  if (error || !order) {
    return (
      <section className="buyer-error-state" role="alert">
        <h1>Order unavailable</h1>
        <p>{error || "This order is not available to your organization."}</p>
        <Link className="buyer-outline-link" to="/buyer/orders">
          <ArrowLeft aria-hidden="true" size={15} /> Back to my orders
        </Link>
      </section>
    );
  }

  const orderWarnings = issues.filter((issue) => issue.orderId === order.id);
  return (
    <div className="buyer-order-details">
      <Link className="buyer-back-link" to="/buyer/orders">
        <ArrowLeft aria-hidden="true" size={15} /> My orders
      </Link>
      <header className="buyer-page-heading buyer-order-details__heading">
        <div>
          <p className="buyer-eyebrow">{order.poNumber}</p>
          <h1>{order.style}</h1>
          <p>{order.colour} · {numberFormatter.format(order.quantity)} pcs</p>
        </div>
        <div className="buyer-delivery-date">
          <CalendarDays aria-hidden="true" size={18} />
          <span><small>Ex-factory date</small><strong>{formatDate(order.exFactoryDate)}</strong></span>
        </div>
      </header>

      <section aria-labelledby="buyer-progress-title" className="buyer-section">
        <div className="buyer-section__heading">
          <div>
            <h2 id="buyer-progress-title">Production progress</h2>
            <p>Stage-level progress. Current stage output is shown against its target.</p>
          </div>
          <span className="buyer-current-stage">{order.stage}</span>
        </div>
        <ol className="buyer-stage-list">
          {order.progressByStage.map((stage) => (
            <li className={`buyer-stage buyer-stage--${stage.status.toLowerCase()}`} key={stage.stage}>
              <span aria-hidden="true" className="buyer-stage__state">
                {stage.status === "COMPLETED"
                  ? <CheckCircle2 size={17} />
                  : stage.status === "IN_PROGRESS"
                    ? <Clock3 size={17} />
                    : <Circle size={17} />}
              </span>
              <span className="buyer-stage__name">{stage.stage}</span>
              <span className="buyer-stage__bar"><span style={{ width: `${stage.percentage}%` }} /></span>
              <strong>{stage.percentage}%</strong>
              {stage.status === "IN_PROGRESS" && (
                <small>{numberFormatter.format(stage.output)} / {numberFormatter.format(stage.target)} pcs</small>
              )}
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="buyer-milestones-title" className="buyer-section">
        <div className="buyer-section__heading">
          <div>
            <h2 id="buyer-milestones-title">Milestones</h2>
            <p>Planned dates and completion status for this order.</p>
          </div>
        </div>
        <ol className="buyer-milestone-list">
          {order.milestones.map((milestone) => (
            <li className={`buyer-milestone${milestone.completed ? " buyer-milestone--completed" : ""}`} key={milestone.id}>
              <span aria-hidden="true">{milestone.completed ? <CheckCircle2 size={17} /> : <Circle size={17} />}</span>
              <strong>{milestone.name}</strong>
              <span>{formatDate(milestone.plannedDate)}</span>
              <small>{milestone.completed ? `Completed ${formatDate(milestone.completedDate)}` : "Planned"}</small>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="buyer-order-warnings-title" className="buyer-section">
        <div className="buyer-section__heading">
          <div>
            <h2 id="buyer-order-warnings-title">Confirmed production warnings</h2>
            <p>Only confirmed, buyer-facing information is included.</p>
          </div>
        </div>
        <BuyerIssueWarnings warnings={orderWarnings} />
      </section>
    </div>
  );
}

function formatDate(value) {
  if (!value || Number.isNaN(Date.parse(`${value}T12:00:00`))) return "Not set";
  return new Intl.DateTimeFormat("en", { dateStyle: "long" }).format(
    new Date(`${value}T12:00:00`),
  );
}

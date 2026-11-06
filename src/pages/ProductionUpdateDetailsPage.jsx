import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Image } from "lucide-react";
import Button from "../components/Button.jsx";
import Card from "../components/Card.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { useOrders } from "../state/OrdersContext.js";
import { useProductionUpdates } from "../state/ProductionUpdatesContext.js";

const numberFormatter = new Intl.NumberFormat("en");
const dateFormatter = new Intl.DateTimeFormat("en", {
  dateStyle: "long",
});
const submittedFormatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
});

export default function ProductionUpdateDetailsPage() {
  const { updateId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { orders } = useOrders();
  const { updates } = useProductionUpdates();
  const orderById = new Map(orders.map((item) => [item.id, item]));
  const update = updates.find(
    (item) => item.id === updateId && orderById.has(item.orderId),
  );
  const order = update && orderById.get(update.orderId);

  if (!update) {
    return (
      <div className="order-not-found">
        <PageHeader title="Production update not found" />
        <p>
          This record may be unavailable in the current browser&apos;s saved
          production history.
        </p>
        <Button
          onClick={() => navigate("/production-updates")}
          variant="secondary"
        >
          <ArrowLeft aria-hidden="true" size={16} />
          Back to Production Updates
        </Button>
      </div>
    );
  }

  return (
    <div className="production-update-details">
      {location.state?.message && (
        <p className="form-alert form-alert--success" role="status">
          {location.state.message}
        </p>
      )}
      <div className="production-update-details__header">
        <PageHeader
          description={`${order?.buyer || "Order"} · ${order?.style || update.poNumber}`}
          title={update.poNumber}
        />
        <Button
          onClick={() => navigate("/production-updates")}
          variant="secondary"
        >
          <ArrowLeft aria-hidden="true" size={16} />
          Production Updates
        </Button>
      </div>
      <Card className="details-card" title="Production update">
        <dl className="order-summary order-summary--update">
          <div className="order-summary__item">
            <dt>Production order</dt>
            <dd>{update.poNumber}</dd>
          </div>
          <div className="order-summary__item">
            <dt>Production stage</dt>
            <dd>{update.stage}</dd>
          </div>
          <div className="order-summary__item">
            <dt>Production date</dt>
            <dd>
              {dateFormatter.format(new Date(`${update.productionDate}T12:00:00`))}
            </dd>
          </div>
          <div className="order-summary__item">
            <dt>Completed quantity</dt>
            <dd>{numberFormatter.format(update.completedQuantity)} pcs</dd>
          </div>
          <div className="order-summary__item">
            <dt>Supervisor</dt>
            <dd>{update.supervisor || "Demo Supervisor"}</dd>
          </div>
          <div className="order-summary__item">
            <dt>Submitted</dt>
            <dd>{submittedFormatter.format(new Date(update.submittedAt))}</dd>
          </div>
          {update.issueCategory && (
            <div className="order-summary__item">
              <dt>Issue category</dt>
              <dd>{update.issueCategory}</dd>
            </div>
          )}
        </dl>
        {update.issueNote ? (
          <div className="order-summary__optional">
            <h3>Issue note</h3>
            <p className="production-update-details__note">{update.issueNote}</p>
          </div>
        ) : (
          <p className="details-empty">
            No issue note was recorded for this update.
          </p>
        )}
        {update.attachment ? (
          <div className="production-update-details__attachment">
            <Image aria-hidden="true" size={18} />
            <div>
              <strong>{update.attachment.fileName}</strong>
              <span>
                {update.attachment.mimeType} ·{" "}
                {(update.attachment.size / (1024 * 1024)).toFixed(2)} MB
              </span>
            </div>
            <p>Photo preview is temporary and is not stored in this browser.</p>
          </div>
        ) : (
          <p className="details-empty">No production photo was attached.</p>
        )}
      </Card>
      <Card className="details-card" title="Related order">
        {order ? (
          <div className="related-order">
            <div>
              <strong>{order.poNumber}</strong>
              <span>
                {order.buyer} · {order.style}
              </span>
            </div>
            <Button
              onClick={() =>
                navigate(`/orders/${encodeURIComponent(order.poNumber)}`)
              }
              variant="secondary"
            >
              View order
            </Button>
          </div>
        ) : (
          <p className="details-empty">
            The associated order is no longer available.
          </p>
        )}
      </Card>
    </div>
  );
}

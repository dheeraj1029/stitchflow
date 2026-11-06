import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Pencil } from "lucide-react";
import Button from "../components/Button.jsx";
import Card from "../components/Card.jsx";
import PageHeader from "../components/PageHeader.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import TnaTimeline from "../components/TnaTimeline.jsx";
import { useOrders } from "../state/OrdersContext.js";
import { useProductionUpdates } from "../state/ProductionUpdatesContext.js";
import ProductionUpdateHistory from "../components/ProductionUpdateHistory.jsx";
import {
  getCumulativeStageOutput,
  getOrderWorkflow,
  getStageTarget,
} from "../data/productionOrders.js";

const numberFormatter = new Intl.NumberFormat("en");
const dateFormatter = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

function formatDate(date) {
  if (!date) {
    return "Not set";
  }
  return dateFormatter.format(new Date(`${date}T12:00:00`));
}

function Detail({ label, value }) {
  return (
    <div className="order-summary__item">
      <dt>{label}</dt>
      <dd>{value || <span className="details-empty-inline">Not provided</span>}</dd>
    </div>
  );
}

export default function OrderDetailsPage() {
  const { poNumber } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { orders } = useOrders();
  const { updates } = useProductionUpdates();
  const order = orders.find((item) => item.poNumber === poNumber);

  if (!order) {
    return (
      <div className="order-not-found">
        <PageHeader title="Order not found" />
        <p>This order may have been removed or its PO number has changed.</p>
        <Button onClick={() => navigate("/orders")} variant="secondary">
          <ArrowLeft aria-hidden="true" size={16} />
          Back to Orders
        </Button>
      </div>
    );
  }

  return (
    <div className="order-details-page">
      {location.state?.message && (
        <p className="form-alert form-alert--success" role="status">
          {location.state.message}
        </p>
      )}
      <div className="order-details-page__header">
        <PageHeader
          description={`${order.buyer} · ${order.style}`}
          title={order.poNumber}
        />
        <div className="order-details-page__actions">
          <Button
            onClick={() => navigate("/orders")}
            variant="secondary"
          >
            <ArrowLeft aria-hidden="true" size={16} />
            Back to Orders
          </Button>
          <Button
            onClick={() =>
              navigate(`/orders/${encodeURIComponent(order.poNumber)}/edit`)
            }
            variant="primary"
          >
            <Pencil aria-hidden="true" size={16} />
            Edit Order
          </Button>
        </div>
      </div>

      <Card className="details-card" title="Order summary">
        <dl className="order-summary">
          <Detail label="PO number" value={order.poNumber} />
          <Detail label="Buyer" value={order.buyer} />
          <Detail label="Buyer country" value={order.buyerCountry} />
          <Detail label="Buyer reference" value={order.buyerReference} />
          <Detail label="Style" value={order.style} />
          <Detail label="Style number" value={order.styleNumber} />
          <Detail label="Category" value={order.productCategory} />
          <Detail label="Colour" value={order.colour} />
          <Detail
            label="Total quantity"
            value={`${numberFormatter.format(order.quantity)} pcs`}
          />
          <Detail label="Production unit" value={order.productionUnit} />
          <Detail label="Current stage" value={order.stage} />
          <Detail label="Order date" value={formatDate(order.orderDate)} />
          <Detail
            label="Ex-factory date"
            value={formatDate(order.exFactoryDate)}
          />
          <div className="order-summary__item">
            <dt>Current status</dt>
            <dd>
              <StatusBadge status={order.status} />
            </dd>
          </div>
          <Detail
            label="Production target"
            value={`${numberFormatter.format(order.productionTarget ?? order.quantity)} pcs`}
          />
        </dl>
        {order.fabricDescription && (
          <div className="order-summary__optional">
            <h3>Fabric description</h3>
            <p>{order.fabricDescription}</p>
          </div>
        )}
        {order.notes && (
          <div className="order-summary__optional">
            <h3>Additional notes</h3>
            <p>{order.notes}</p>
          </div>
        )}
        {order.productionNotes && (
          <div className="order-summary__optional">
            <h3>Production notes</h3>
            <p>{order.productionNotes}</p>
          </div>
        )}
      </Card>

      <Card className="details-card" title="Quantity breakdown">
        {order.sizeBreakdown?.length ? (
          <>
            <div className="quantity-breakdown">
              {order.sizeBreakdown.map((row) => (
                <div className="quantity-breakdown__item" key={row.size}>
                  <span>{row.size}</span>
                  <strong>{numberFormatter.format(row.quantity)} pcs</strong>
                </div>
              ))}
            </div>
            <p className="quantity-breakdown__total">
              Total order quantity{" "}
              <strong>{numberFormatter.format(order.quantity)} pcs</strong>
            </p>
          </>
        ) : (
          <p className="details-empty">
            A size-wise breakdown was not provided for this imported sample
            order. Total order quantity:{" "}
            <strong>{numberFormatter.format(order.quantity)} pcs</strong>.
          </p>
        )}
      </Card>

      <Card className="details-card" title="Time and action timeline">
        <p className="details-card__caption">
          Milestone status is set manually. Overdue dates remain pending until
          marked complete.
        </p>
        <TnaTimeline milestones={order.milestones} />
      </Card>

      <Card className="details-card" title="Stage-wise production output">
        <p className="details-card__caption">
          Output combines the original baseline with valid updates for the same
          order and stage.
        </p>
        <div className="stage-output-list">
          {getOrderWorkflow(order).map((stage) => {
            const output = getCumulativeStageOutput(
              order,
              stage.name,
              updates,
            );
            const target = getStageTarget(order, stage.name);
            return (
              <div className="stage-output-list__item" key={stage.name}>
                <span>{stage.name}</span>
                <strong>
                  {numberFormatter.format(output)} /{" "}
                  {target
                    ? `${numberFormatter.format(target)} pcs`
                    : "Target unavailable"}
                </strong>
                {stage.name === order.stage && (
                  <span className="stage-output-list__current">
                    Current stage
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <ProductionUpdateHistory
        orderId={order.id}
        orders={orders}
        title="Production update history"
        updates={updates}
      />
    </div>
  );
}

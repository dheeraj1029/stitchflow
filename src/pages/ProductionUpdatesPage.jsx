import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ClipboardList,
  Clock3,
  MessageSquareWarning,
  Plus,
} from "lucide-react";
import Button from "../components/Button.jsx";
import Card from "../components/Card.jsx";
import ProductionProgress from "../components/ProductionProgress.jsx";
import ProductionUpdateHistory from "../components/ProductionUpdateHistory.jsx";
import { getCumulativeStageOutput, getStageTarget } from "../data/productionOrders.js";
import { useOrders } from "../state/OrdersContext.js";
import { useProductionUpdates } from "../state/ProductionUpdatesContext.js";
import { useAuth } from "../features/auth/AuthContext.js";

function localDate(date = new Date()) {
  const timezoneOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 10);
}

const numberFormatter = new Intl.NumberFormat("en");

export default function ProductionUpdatesPage() {
  const { orders } = useOrders();
  const { updates } = useProductionUpdates();
  const { user } = useAuth();
  const canSubmitUpdates = user?.role === "SUPERVISOR";
  const today = localDate();
  const todaysUpdates = updates.filter(
    (update) =>
      update.productionDate === today &&
      orders.some((order) => order.id === update.orderId),
  );
  const recentOrders = useMemo(
    () => orders.slice().sort((a, b) => a.poNumber.localeCompare(b.poNumber)),
    [orders],
  );

  return (
    <div className="supervisor-dashboard">
      <header className="supervisor-dashboard__header">
        <div>
          <p className="supervisor-dashboard__eyebrow">Supervisor workspace</p>
          <h1 className="page-header__title">Production Workspace</h1>
          <p className="page-header__description">
            Record today&apos;s output and keep each stage&apos;s progress
            visible.
          </p>
        </div>
        <div className="supervisor-dashboard__actions">
          {canSubmitUpdates && <Button
            as={Link}
            className="supervisor-dashboard__action"
            to="/issues/new"
            variant="secondary"
          >
            <MessageSquareWarning aria-hidden="true" size={17} />
            Report Issue
          </Button>}
          {canSubmitUpdates && <Button
            as={Link}
            className="supervisor-dashboard__action"
            to="/production-updates/new"
            variant="primary"
          >
            <Plus aria-hidden="true" size={18} />
            Submit Production Update
          </Button>}
        </div>
      </header>

      <section
        aria-label="Production update summary"
        className="supervisor-summary"
      >
        <Card className="supervisor-summary__card">
          <span aria-hidden="true" className="supervisor-summary__icon">
            <Clock3 size={18} />
          </span>
          <span className="supervisor-summary__label">Today&apos;s updates</span>
          <strong>{todaysUpdates.length}</strong>
          <span className="supervisor-summary__caption">
            For {new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(
              new Date(`${today}T12:00:00`),
            )}
          </span>
        </Card>
        <Card className="supervisor-summary__card">
          <span aria-hidden="true" className="supervisor-summary__icon">
            <ClipboardList size={18} />
          </span>
          <span className="supervisor-summary__label">
            Orders requiring updates
          </span>
          <strong>{orders.length}</strong>
          <span className="supervisor-summary__caption">
            Available for production reporting
          </span>
        </Card>
      </section>

      <Card className="supervisor-orders" title="Orders requiring production updates">
        <p className="supervisor-orders__caption">
          Seeded demo orders use illustrative stage targets. Output includes
          each order&apos;s baseline plus saved updates for the same stage only.
        </p>
        {recentOrders.length === 0 ? (
          <p className="details-empty">
            No production orders are available. Create an order before
            submitting an update.
          </p>
        ) : (
          <div className="supervisor-order-list">
            {recentOrders.map((order) => {
              const target = getStageTarget(order, order.stage);
              const output = getCumulativeStageOutput(
                order,
                order.stage,
                updates,
              );
              const remaining =
                target === null ? null : Math.max(target - output, 0);
              const orderWithOutput = { ...order, stageOutput: output };

              return (
                <article className="supervisor-order" key={order.id}>
                  <div className="supervisor-order__main">
                    <div className="supervisor-order__title">
                      <div>
                        <h3>{order.poNumber}</h3>
                        <p>
                          {order.buyer} · {order.style}
                        </p>
                      </div>
                      <Button
                        aria-label={`Submit update for ${order.poNumber}`}
                        as={Link}
                        className="supervisor-order__quick-action"
                        to={`/production-updates/new?order=${encodeURIComponent(order.id)}`}
                        variant="secondary"
                      >
                        <Plus aria-hidden="true" size={15} />
                        Update
                      </Button>
                    </div>
                    <div className="supervisor-order__stats">
                      <span>
                        <small>Unit</small>
                        <strong>{order.productionUnit}</strong>
                      </span>
                      <span>
                        <small>Current stage</small>
                        <strong>{order.stage || "Not set"}</strong>
                      </span>
                      <span>
                        <small>Stage output</small>
                        <strong>
                          {numberFormatter.format(output)} /{" "}
                          {target === null
                            ? "Target unavailable"
                            : `${numberFormatter.format(target)} pcs`}
                        </strong>
                      </span>
                      <span>
                        <small>Remaining</small>
                        <strong>
                          {remaining === null
                            ? "Unavailable"
                            : `${numberFormatter.format(remaining)} pcs`}
                        </strong>
                      </span>
                    </div>
                    {target !== null && (
                      <div className="supervisor-order__progress">
                        <ProductionProgress order={orderWithOutput} />
                      </div>
                    )}
                  </div>
                  <Link
                    aria-label={`View order ${order.poNumber}`}
                    className="supervisor-order__details"
                    to={`/orders/${encodeURIComponent(order.poNumber)}`}
                  >
                    Order details <ArrowRight aria-hidden="true" size={15} />
                  </Link>
                </article>
              );
            })}
          </div>
        )}
      </Card>

      <ProductionUpdateHistory
        orders={orders}
        title="Recent production activity"
        updates={updates}
      />
    </div>
  );
}

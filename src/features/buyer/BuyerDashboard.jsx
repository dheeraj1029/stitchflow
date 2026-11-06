import { Link } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  PackageCheck,
  PackageOpen,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext.js";
import { useBuyerPortal } from "./BuyerPortalContext.js";
import { getBuyerDashboardStats } from "./buyerModel.js";
import BuyerIssueWarnings from "./BuyerIssueWarnings.jsx";

const cards = [
  { key: "activeOrders", label: "Active orders", icon: ClipboardList, detail: "Orders not yet completed" },
  { key: "inProduction", label: "In production", icon: PackageOpen, detail: "Orders with a current production stage" },
  { key: "shipped", label: "Shipped", icon: PackageCheck, detail: "No shipped records in this demo" },
  { key: "attention", label: "Needs attention", icon: AlertTriangle, detail: "At-risk, delayed, or confirmed warning" },
];

export default function BuyerDashboard() {
  const { user } = useAuth();
  const { orders, issues } = useBuyerPortal();
  const stats = getBuyerDashboardStats(orders, issues);

  return (
    <div className="buyer-dashboard">
      <header className="buyer-page-heading">
        <div>
          <p className="buyer-eyebrow">{user?.buyerOrganizationName}</p>
          <h1>Production overview</h1>
          <p>Track your orders, upcoming milestones, and confirmed production updates.</p>
        </div>
        <Link className="buyer-outline-link" to="/buyer/orders">
          View all orders
        </Link>
      </header>

      <section aria-label="Order summary" className="buyer-kpis">
        {cards.map(({ key, label, icon: Icon, detail }) => (
          <article className={`buyer-kpi buyer-kpi--${key}`} key={key}>
            <span aria-hidden="true" className="buyer-kpi__icon"><Icon size={18} /></span>
            <span className="buyer-kpi__label">{label}</span>
            <strong>{stats[key]}</strong>
            <small>{detail}</small>
          </article>
        ))}
      </section>

      <section aria-labelledby="buyer-orders-title" className="buyer-section">
        <div className="buyer-section__heading">
          <div>
            <h2 id="buyer-orders-title">Your orders</h2>
            <p>{orders.length} order{orders.length === 1 ? "" : "s"} available to this organization</p>
          </div>
          <Link to="/buyer/orders">Browse orders</Link>
        </div>
        {orders.length ? (
          <div className="buyer-order-list">
            {orders.slice(0, 4).map((order) => (
              <Link
                className="buyer-order-row"
                key={order.id}
                to={`/buyer/orders/${encodeURIComponent(order.id)}`}
              >
                <span className="buyer-order-row__po">{order.poNumber}</span>
                <span className="buyer-order-row__style">{order.style}<small>{order.colour}</small></span>
                <span className="buyer-order-row__stage">{order.stage}<small>Current stage</small></span>
                <span className="buyer-order-row__progress">
                  <span className="buyer-progress-track"><span style={{ width: `${order.productionProgress}%` }} /></span>
                  <small>{order.productionProgress}% stage progress</small>
                </span>
                {order.hasConfirmedWarnings && (
                  <span className="buyer-warning-indicator">
                    <AlertTriangle aria-hidden="true" size={14} /> Confirmed warning
                  </span>
                )}
              </Link>
            ))}
          </div>
        ) : (
          <div className="buyer-empty-state">
            <ClipboardList aria-hidden="true" size={22} />
            <h3>No orders available</h3>
            <p>There are no demo orders assigned to this buyer organization.</p>
          </div>
        )}
      </section>

      <section aria-labelledby="buyer-warnings-title" className="buyer-section">
        <div className="buyer-section__heading">
          <div>
            <h2 id="buyer-warnings-title">Confirmed production warnings</h2>
            <p>Only issues confirmed by a merchandiser are shown.</p>
          </div>
          <span className="buyer-warning-count">
            <CheckCircle2 aria-hidden="true" size={15} /> {issues.length} confirmed
          </span>
        </div>
        {issues.length ? (
          <BuyerIssueWarnings warnings={issues} compact />
        ) : (
          <p className="buyer-empty-inline">No confirmed production warnings for your orders.</p>
        )}
      </section>
    </div>
  );
}

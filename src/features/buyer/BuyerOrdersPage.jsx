import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { SearchX } from "lucide-react";
import StatusBadge from "../../components/StatusBadge.jsx";
import { filterBuyerOrders } from "./buyerModel.js";
import { useBuyerPortal } from "./BuyerPortalContext.js";

const numberFormatter = new Intl.NumberFormat("en");

export default function BuyerOrdersPage() {
  const { orders } = useBuyerPortal();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const filtered = useMemo(
    () => filterBuyerOrders(orders, { search, status }),
    [orders, search, status],
  );

  return (
    <div className="buyer-orders-page">
      <header className="buyer-page-heading">
        <div>
          <p className="buyer-eyebrow">Buyer portal</p>
          <h1>My orders</h1>
          <p>Production information for your organization&apos;s orders.</p>
        </div>
      </header>
      <section aria-label="Filter my orders" className="buyer-order-filters">
        <label>
          <span>Search orders</span>
          <input
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search PO, style, or colour"
            type="search"
            value={search}
          />
        </label>
        <label>
          <span>Order status</span>
          <select onChange={(event) => setStatus(event.target.value)} value={status}>
            <option value="">All statuses</option>
            <option value="on-track">On track</option>
            <option value="at-risk">At risk</option>
            <option value="delayed">Delayed</option>
            <option value="completed">Completed</option>
          </select>
        </label>
        {(search || status) && (
          <button
            className="buyer-filter-reset"
            onClick={() => {
              setSearch("");
              setStatus("");
            }}
            type="button"
          >
            Clear filters
          </button>
        )}
      </section>
      <p aria-live="polite" className="buyer-results-count">
        Showing {filtered.length} of {orders.length} orders
      </p>
      {filtered.length ? (
        <div className="buyer-order-table-wrap">
          <table className="buyer-order-table">
            <thead>
              <tr>
                <th scope="col">PO number</th>
                <th scope="col">Style / Colour</th>
                <th scope="col">Quantity</th>
                <th scope="col">Stage progress</th>
                <th scope="col">Current stage</th>
                <th scope="col">Ex-factory</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((order) => (
                <tr key={order.id}>
                  <td data-label="PO number">
                    <Link to={`/buyer/orders/${encodeURIComponent(order.id)}`}>{order.poNumber}</Link>
                  </td>
                  <td data-label="Style / Colour">{order.style}<small>{order.colour}</small></td>
                  <td data-label="Quantity">{numberFormatter.format(order.quantity)} pcs</td>
                  <td data-label="Stage progress">
                    <div className="buyer-table-progress">
                      <span className="buyer-progress-track"><span style={{ width: `${order.productionProgress}%` }} /></span>
                      <small>{order.productionProgress}%</small>
                    </div>
                  </td>
                  <td data-label="Current stage">{order.stage}</td>
                  <td data-label="Ex-factory">{formatDate(order.exFactoryDate)}</td>
                  <td data-label="Status">
                    <StatusBadge status={order.status} />
                    {order.hasConfirmedWarnings && <small className="buyer-table-warning">Confirmed warning</small>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="buyer-empty-state">
          <SearchX aria-hidden="true" size={22} />
          <h2>{orders.length ? "No orders match your filters" : "No orders available"}</h2>
          <p>{orders.length ? "Try a different search or clear the selected status." : "No demo orders are assigned to your organization."}</p>
          {orders.length > 0 && (search || status) && (
            <button className="buyer-clear-button" onClick={() => { setSearch(""); setStatus(""); }} type="button">
              Clear filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function formatDate(value) {
  if (!value || Number.isNaN(Date.parse(`${value}T12:00:00`))) return "Not set";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(
    new Date(`${value}T12:00:00`),
  );
}

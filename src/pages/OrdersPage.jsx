import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Plus } from "lucide-react";
import Button from "../components/Button.jsx";
import Card from "../components/Card.jsx";
import EmptyState from "../components/EmptyState.jsx";
import OrderFilters from "../components/OrderFilters.jsx";
import PageHeader from "../components/PageHeader.jsx";
import StatusBadge from "../components/StatusBadge.jsx";
import { filterProductionOrders, getOrderFilterOptions } from "../data/filterOrders.js";
import { useOrders } from "../state/OrdersContext.js";
import { useAuth } from "../features/auth/AuthContext.js";

const numberFormatter = new Intl.NumberFormat("en");
const dateFormatter = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function formatDate(date) {
  if (!date) {
    return "Not set";
  }
  return dateFormatter.format(new Date(`${date}T12:00:00`));
}

export default function OrdersPage() {
  const { orders } = useOrders();
  const { user } = useAuth();
  const canManageOrders = user?.role === "MERCHANDISER";
  const [search, setSearch] = useState("");
  const [selectedBuyer, setSelectedBuyer] = useState("");
  const [selectedUnit, setSelectedUnit] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const { buyers, units } = useMemo(() => getOrderFilterOptions(orders), [orders]);
  const filters = { search, selectedBuyer, selectedUnit, selectedStatus };
  const filteredOrders = filterProductionOrders(orders, filters);
  const hasActiveFilters = Object.values(filters).some(Boolean);
  const resetFilters = () => {
    setSearch("");
    setSelectedBuyer("");
    setSelectedUnit("");
    setSelectedStatus("");
  };

  return (
    <div className="orders-page">
      <div className="orders-page__header">
        <PageHeader
          description={canManageOrders ? "Manage production orders, quantities and delivery dates." : "View production orders available to your role."}
          title="Orders"
        />
        {canManageOrders && (
          <Button
            as={Link}
            className="dashboard-header__create"
            to="/orders/new"
            variant="primary"
          >
            <Plus aria-hidden="true" size={18} />
            Create Order
          </Button>
        )}
      </div>

      <Card className="order-list-card" title="All production orders">
        <p className="order-list-card__caption">
          Search and filter your orders. Changes are saved in this browser.
        </p>
        <OrderFilters
          buyers={buyers}
          hasActiveFilters={hasActiveFilters}
          onBuyerChange={setSelectedBuyer}
          onReset={resetFilters}
          onSearchChange={setSearch}
          onStatusChange={setSelectedStatus}
          onUnitChange={setSelectedUnit}
          search={search}
          selectedBuyer={selectedBuyer}
          selectedStatus={selectedStatus}
          selectedUnit={selectedUnit}
          units={units}
        />
        <p className="demo-data-note">
          Sample orders and production-unit names are illustrative. New and
          edited orders are stored locally in this browser.
        </p>
        <div className="table-card__summary">
          <p aria-live="polite">
            Showing <strong>{filteredOrders.length}</strong> of{" "}
            <strong>{orders.length}</strong> orders
          </p>
          <p>{orders.length} total orders</p>
        </div>
        {filteredOrders.length === 0 ? (
          <EmptyState onReset={resetFilters} />
        ) : (
          <div
            aria-label="Orders table, scroll horizontally to view all columns"
            className="table-scroll"
            role="region"
            tabIndex={0}
          >
            <table className="orders-table orders-table--management">
              <thead>
                <tr>
                  <th scope="col">PO Number</th>
                  <th scope="col">Buyer</th>
                  <th scope="col">Style</th>
                  <th scope="col">Unit</th>
                  <th scope="col">Total Quantity</th>
                  <th scope="col">Current Stage</th>
                  <th scope="col">Ex-Factory Date</th>
                  <th scope="col">Order Status</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => (
                  <tr key={order.id}>
                    <td className="orders-table__po">{order.poNumber}</td>
                    <td>{order.buyer}</td>
                    <td>
                      <span className="orders-table__style">{order.style}</span>
                      <span className="orders-table__colour">
                        {order.colour || "Colour not specified"}
                      </span>
                    </td>
                    <td>{order.productionUnit}</td>
                    <td>{numberFormatter.format(order.quantity)} pcs</td>
                    <td>{order.stage || "Not set"}</td>
                    <td className="orders-table__date">
                      {formatDate(order.exFactoryDate)}
                    </td>
                    <td>
                      <StatusBadge status={order.status} />
                    </td>
                    <td>
                      <div className="orders-table__actions">
                        <Button
                          aria-label={`View ${order.poNumber}`}
                          as={Link}
                          className="view-details-button"
                          to={`/orders/${encodeURIComponent(order.poNumber)}`}
                          variant="quiet"
                        >
                          <ArrowUpRight aria-hidden="true" size={15} />
                          <span>View</span>
                        </Button>
                        {canManageOrders && (
                          <Button
                            as={Link}
                            className="view-details-button"
                            to={`/orders/${encodeURIComponent(order.poNumber)}/edit`}
                            variant="quiet"
                          >
                            Edit
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

import { Eye } from "lucide-react";
import { useState } from "react";
import Button from "./Button.jsx";
import EmptyState from "./EmptyState.jsx";
import ModalDialog from "./ModalDialog.jsx";
import ProductionProgress from "./ProductionProgress.jsx";
import StatusBadge from "./StatusBadge.jsx";

const numberFormatter = new Intl.NumberFormat("en");
const dateFormatter = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function formatDate(date) {
  return dateFormatter.format(new Date(`${date}T12:00:00`));
}

function OrderDetails({ order }) {
  return (
    <>
      <p className="modal-dialog__eyebrow">{order.poNumber}</p>
      {order.isDemo && (
        <p className="modal-dialog__note">
          Seeded demonstration order. This record is not real company data.
        </p>
      )}
      <dl className="order-details">
        <div>
          <dt>Buyer</dt>
          <dd>{order.buyer}</dd>
        </div>
        <div>
          <dt>Style</dt>
          <dd>{order.style}</dd>
        </div>
        <div>
          <dt>Colour</dt>
          <dd>{order.colour}</dd>
        </div>
        <div>
          <dt>Order quantity</dt>
          <dd>{numberFormatter.format(order.quantity)} pcs</dd>
        </div>
        <div>
          <dt>Production unit</dt>
          <dd>{order.productionUnit}</dd>
        </div>
        <div>
          <dt>Production stage</dt>
          <dd>{order.stage}</dd>
        </div>
        <div>
          <dt>Current stage output</dt>
          <dd>{numberFormatter.format(order.stageOutput)} pcs</dd>
        </div>
        <div>
          <dt>Ex-factory date</dt>
          <dd>{formatDate(order.exFactoryDate)}</dd>
        </div>
        <div>
          <dt>{order.isDemo ? "Demo status" : "Order status"}</dt>
          <dd>
            <StatusBadge status={order.status} />
          </dd>
        </div>
      </dl>
      <div className="order-details__progress">
        <h3>Current stage progress</h3>
        <ProductionProgress order={order} />
        <p>
          Progress compares current-stage output with its stage target; it is
          not overall finished-goods progress.
        </p>
      </div>
    </>
  );
}

export default function ProductionOrdersTable({
  orders,
  onReset,
  resultCount,
  totalCount,
}) {
  const [selectedOrder, setSelectedOrder] = useState(null);

  return (
    <>
      <div className="table-card__summary">
        <p aria-live="polite">
          Showing <strong>{resultCount}</strong> of{" "}
          <strong>{totalCount}</strong> orders
        </p>
        <p>Stage output only · not finished-goods progress</p>
      </div>

      {resultCount === 0 ? (
        <EmptyState onReset={onReset} />
      ) : (
        <div
          aria-label="Production orders table, scroll horizontally to view all columns"
          className="table-scroll"
          role="region"
          tabIndex={0}
        >
          <table className="orders-table">
            <thead>
              <tr>
                <th scope="col">PO Number</th>
                <th scope="col">Buyer</th>
                <th scope="col">Style</th>
                <th scope="col">Production Stage</th>
                <th scope="col">Stage Progress</th>
                <th scope="col">Ex-Factory Date</th>
                <th scope="col">Status</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.poNumber}>
                  <td className="orders-table__po">
                    {order.poNumber}
                    {order.isDemo && (
                      <span className="orders-table__demo">Demo</span>
                    )}
                  </td>
                  <td>{order.buyer}</td>
                  <td>
                    <span className="orders-table__style">{order.style}</span>
                    <span className="orders-table__colour">
                      {order.colour}
                    </span>
                  </td>
                  <td>{order.stage}</td>
                  <td className="orders-table__progress">
                    <ProductionProgress order={order} />
                  </td>
                  <td className="orders-table__date">
                    {formatDate(order.exFactoryDate)}
                  </td>
                  <td>
                    <StatusBadge status={order.status} />
                  </td>
                  <td>
                    <Button
                      aria-label={`View details for ${order.poNumber}`}
                      className="view-details-button"
                      onClick={() => setSelectedOrder(order)}
                      variant="quiet"
                    >
                      <Eye aria-hidden="true" size={16} />
                      <span>View</span>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ModalDialog
        onClose={() => setSelectedOrder(null)}
        open={Boolean(selectedOrder)}
        title={
          selectedOrder
            ? `Order details · ${selectedOrder.poNumber}`
            : "Order details"
        }
      >
        {selectedOrder && <OrderDetails order={selectedOrder} />}
      </ModalDialog>
    </>
  );
}

import Card from "./Card.jsx";
import OrderFilters from "./OrderFilters.jsx";

export default function OrderFiltersPanel(props) {
  return (
    <Card className="order-list-card" title="Production orders">
      <p className="order-list-card__caption">
        Track current-stage output and follow up on production orders.
      </p>
      <OrderFilters {...props} />
      {props.hasDemoOrders && (
        <p className="demo-data-note">
          Seeded demo orders are marked Demo. Their saved statuses are separate
          from the calculated production-risk signals.
        </p>
      )}
      <div className="production-orders">
        {props.children}
      </div>
    </Card>
  );
}

import Card from "./Card.jsx";
import OrderFilters from "./OrderFilters.jsx";

export default function OrderFiltersPanel(props) {
  return (
    <Card className="order-list-card" title="Production orders">
      <p className="order-list-card__caption">
        Track current-stage output and follow up on sample orders.
      </p>
      <OrderFilters {...props} />
      <p className="demo-data-note">
        Demo data · production units and example statuses are illustrative and
        are not calculated or live.
      </p>
      <div className="production-orders">
        {props.children}
      </div>
    </Card>
  );
}

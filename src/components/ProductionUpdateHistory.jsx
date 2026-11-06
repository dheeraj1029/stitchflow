import { useMemo } from "react";
import Card from "./Card.jsx";
import EmptyState from "./EmptyState.jsx";
import ProductionUpdateCard from "./ProductionUpdateCard.jsx";

export default function ProductionUpdateHistory({
  orders,
  orderId,
  title = "Recent production activity",
  updates,
}) {
  const orderById = useMemo(
    () => new Map(orders.map((order) => [order.id, order])),
    [orders],
  );
  const history = useMemo(
    () =>
      updates
        .filter(
          (update) =>
            orderById.has(update.orderId) &&
            (!orderId || update.orderId === orderId),
        )
        .slice()
        .sort(
          (a, b) =>
            b.productionDate.localeCompare(a.productionDate) ||
            b.submittedAt.localeCompare(a.submittedAt),
        ),
    [orderById, orderId, updates],
  );

  return (
    <Card className="production-history" title={title}>
      {history.length === 0 ? (
        <EmptyState
          description="Submitted production reports will appear here."
          title="No production updates yet"
        />
      ) : (
        <div className="production-history__list">
          {history.map((update) => (
            <ProductionUpdateCard
              key={update.id}
              order={orderById.get(update.orderId)}
              update={update}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

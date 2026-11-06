import { useMemo, useState } from "react";
import { getBaselineStageOutput } from "../data/productionOrders.js";
import { loadOrderData, writeOrderData } from "../data/orderStorage.js";
import { useProductionUpdates } from "./ProductionUpdatesContext.js";
import { OrdersContext } from "./OrdersContext.js";
import { useAuth } from "../features/auth/AuthContext.js";

export function OrdersProvider({ children }) {
  const [initialData] = useState(loadOrderData);
  const [storedOrders, setStoredOrders] = useState(initialData.orders);
  const [storageError, setStorageError] = useState(initialData.error);
  const { updates } = useProductionUpdates();
  const { user } = useAuth();
  const orders = useMemo(
    () =>
      storedOrders
        .filter(
          (order) =>
            user?.role !== "SUPERVISOR" ||
            order.productionUnit === user.productionUnitName,
        )
        .map((order) => {
        const baselineStageOutput = getBaselineStageOutput(order);
        const stageOutput =
          baselineStageOutput +
          updates.reduce(
            (total, update) =>
              update.orderId === order.id && update.stage === order.stage
                ? total + update.completedQuantity
                : total,
            0,
          );
        return { ...order, baselineStageOutput, stageOutput };
      }),
    [storedOrders, updates, user],
  );

  function saveOrder(order, existingId = null) {
    const duplicate = orders.some(
      (savedOrder) =>
        savedOrder.poNumber.trim().toLocaleLowerCase() ===
          order.poNumber.trim().toLocaleLowerCase() &&
        savedOrder.id !== existingId,
    );

    if (duplicate) {
      return { ok: false, error: "That PO number is already in use." };
    }

    const updatedOrders = existingId
      ? storedOrders.map((savedOrder) =>
          savedOrder.id === existingId
            ? persistableOrder(order, existingId, savedOrder.stageOutput)
            : savedOrder,
        )
      : [...storedOrders, persistableOrder(order, order.poNumber, 0)];

    try {
      writeOrderData(updatedOrders);
      setStoredOrders(updatedOrders);
      setStorageError("");
      return {
        ok: true,
        order: existingId ? { ...order, id: existingId } : order,
      };
    } catch {
      const error =
        "Your changes could not be saved to this browser. Check storage availability and try again.";
      setStorageError(error);
      return { ok: false, error };
    }
  }

  const value = { orders, saveOrder, storageError };

  return (
    <OrdersContext.Provider value={value}>{children}</OrdersContext.Provider>
  );
}

function persistableOrder(order, id, fallbackBaseline) {
  const { baselineStageOutput, ...savedOrder } = order;
  return {
    ...savedOrder,
    id,
    stageOutput: baselineStageOutput ?? fallbackBaseline,
  };
}

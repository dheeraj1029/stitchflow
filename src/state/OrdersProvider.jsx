import { useState } from "react";
import { loadOrderData, writeOrderData } from "../data/orderStorage.js";
import { OrdersContext } from "./OrdersContext.js";

export function OrdersProvider({ children }) {
  const [initialData] = useState(loadOrderData);
  const [orders, setOrders] = useState(initialData.orders);
  const [storageError, setStorageError] = useState(initialData.error);

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
      ? orders.map((savedOrder) =>
          savedOrder.id === existingId ? { ...order, id: existingId } : savedOrder,
        )
      : [...orders, { ...order, id: order.poNumber }];

    try {
      writeOrderData(updatedOrders);
      setOrders(updatedOrders);
      setStorageError("");
      return { ok: true, order: existingId ? { ...order, id: existingId } : order };
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

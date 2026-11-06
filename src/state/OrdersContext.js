import { createContext, useContext } from "react";

export const OrdersContext = createContext(null);

export function useOrders() {
  const context = useContext(OrdersContext);
  if (!context) {
    throw new Error("useOrders must be used within OrdersProvider.");
  }
  return context;
}

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../features/auth/AuthContext.js";
import { listOrders, saveOrder as saveOrderRequest } from "../features/orders/ordersApi.js";
import { OrdersContext } from "./OrdersContext.js";

export function OrdersProvider({ children }) {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const requestId = useRef(0);

  const reload = useCallback(async () => {
    const activeRequest = ++requestId.current;
    setLoading(true);
    setError("");
    try {
      const savedOrders = await listOrders();
      if (requestId.current === activeRequest) setOrders(savedOrders);
      return savedOrders;
    } catch (loadError) {
      const message =
        loadError instanceof Error
          ? loadError.message
          : "Orders could not be loaded.";
      if (requestId.current === activeRequest) setError(message);
      throw loadError;
    } finally {
      if (requestId.current === activeRequest) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    reload().catch(() => {
      if (!active) return;
    });
    return () => {
      active = false;
      requestId.current += 1;
    };
  }, [reload, user?.id]);

  const saveOrder = useCallback(
    async (order, existingId = null) => {
      try {
        const savedOrder = await saveOrderRequest(order, existingId);
        await reload();
        return { ok: true, order: savedOrder };
      } catch (saveError) {
        const message =
          saveError instanceof Error
            ? saveError.message
            : "The order could not be saved.";
        setError(message);
        return { ok: false, error: message };
      }
    },
    [reload],
  );

  return (
    <OrdersContext.Provider
      value={{ orders, saveOrder, loading, error, reload }}
    >
      {children}
    </OrdersContext.Provider>
  );
}

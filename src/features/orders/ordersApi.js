import { apiRequest } from "../auth/authApi.js";

export async function listOrders() {
  const result = await apiRequest("/api/orders");
  if (!Array.isArray(result.orders)) {
    throw new Error("The orders service returned invalid data.");
  }
  return result.orders;
}

export async function getOrderOptions() {
  const result = await apiRequest("/api/order-options");
  if (
    !Array.isArray(result.organizations) ||
    !Array.isArray(result.productionUnits)
  ) {
    throw new Error("The order options service returned invalid data.");
  }
  return {
    buyers: result.organizations,
    productionUnits: result.productionUnits,
  };
}

export async function saveOrder(order, existingId = null) {
  const result = await apiRequest(
    existingId
      ? `/api/orders/${encodeURIComponent(existingId)}`
      : "/api/orders",
    {
      method: existingId ? "PATCH" : "POST",
      body: JSON.stringify(order),
    },
  );
  if (!result.order || typeof result.order.id !== "string") {
    throw new Error("The orders service returned an invalid record.");
  }
  return result.order;
}

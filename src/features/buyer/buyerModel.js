export function getBuyerDashboardStats(orders, issues) {
  const activeOrders = orders.filter((order) => order.status !== "completed");
  return {
    activeOrders: activeOrders.length,
    inProduction: orders.filter((order) => order.progressByStage?.some(
      (stage) => stage.status === "IN_PROGRESS",
    )).length,
    shipped: orders.filter((order) => order.status === "shipped").length,
    attention: orders.filter(
      (order) =>
        order.hasConfirmedWarnings ||
        order.status === "at-risk" ||
        order.status === "delayed",
    ).length,
    confirmedWarnings: issues.length,
  };
}

export function filterBuyerOrders(orders, { search = "", status = "" } = {}) {
  const query = search.trim().toLocaleLowerCase();
  return orders.filter((order) => {
    const searchable = [order.poNumber, order.style, order.colour]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase();
    const matchesSearch =
      !query || query.split(/\s+/).every((term) => searchable.includes(term));
    const matchesStatus = !status || order.status === status;
    return matchesSearch && matchesStatus;
  });
}

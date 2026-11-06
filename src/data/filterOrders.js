export function getOrderFilterOptions(orders) {
  return {
    buyers: [...new Set(orders.map((order) => order.buyer))].sort(),
    units: [...new Set(orders.map((order) => order.productionUnit))].sort(),
  };
}

export function filterProductionOrders(
  orders,
  { search, selectedBuyer, selectedUnit, selectedStatus },
) {
  const normalizedSearch = search.trim().toLocaleLowerCase();

  return orders.filter((order) => {
    const matchesSearch =
      !normalizedSearch ||
      [order.poNumber, order.buyer, order.style].some((value) =>
        value.toLocaleLowerCase().includes(normalizedSearch),
      );

    return (
      matchesSearch &&
      (!selectedBuyer || order.buyer === selectedBuyer) &&
      (!selectedUnit || order.productionUnit === selectedUnit) &&
      (!selectedStatus || order.status === selectedStatus)
    );
  });
}

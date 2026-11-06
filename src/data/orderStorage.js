import {
  normalizeOrder,
  orderStatuses,
  productionOrders,
  requiredMilestones,
} from "./productionOrders.js";

const STORAGE_KEY = "stitchflow.production-orders.v1";

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) {
    return false;
  }
  const date = new Date(`${value}T12:00:00`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isValidSizeBreakdown(breakdown, totalQuantity) {
  if (breakdown === undefined) {
    return true;
  }
  if (
    !Array.isArray(breakdown) ||
    !breakdown.every(
      (row) =>
        row &&
        typeof row.size === "string" &&
        Number.isInteger(row.quantity) &&
        row.quantity >= 0,
    )
  ) {
    return false;
  }

  const sizes = breakdown.map((row) => row.size.trim().toLocaleLowerCase());
  return (
    new Set(sizes).size === sizes.length &&
    (breakdown.length === 0 ||
      breakdown.reduce((sum, row) => sum + row.quantity, 0) === totalQuantity)
  );
}

function isValidMilestones(order) {
  if (order.milestones === undefined) {
    return true;
  }
  if (
    !Array.isArray(order.milestones) ||
    !order.milestones.every(
      (milestone) =>
        milestone &&
        typeof milestone.id === "string" &&
        typeof milestone.name === "string" &&
        typeof milestone.plannedDate === "string" &&
        (!milestone.plannedDate || isValidDate(milestone.plannedDate)) &&
        typeof milestone.completed === "boolean" &&
        (milestone.completedDate === undefined ||
          milestone.completedDate === "" ||
          isValidDate(milestone.completedDate)) &&
        (milestone.required === undefined ||
          typeof milestone.required === "boolean") &&
        (milestone.updatedAt === undefined ||
          !Number.isNaN(Date.parse(milestone.updatedAt))),
    )
  ) {
    return false;
  }

  const milestoneIds = order.milestones.map((milestone) => milestone.id);
  return (
    new Set(milestoneIds).size === milestoneIds.length &&
    requiredMilestones.every((required) =>
      order.milestones.some((milestone) => milestone.key === required.key),
    ) &&
    order.milestones
      .filter((milestone) => milestone.key === "ex-factory")
      .every((milestone) => milestone.plannedDate === order.exFactoryDate)
  );
}

function isValidStoredOrder(order) {
  return (
    order &&
    typeof order === "object" &&
    typeof order.poNumber === "string" &&
    Boolean(order.poNumber.trim()) &&
    typeof order.buyer === "string" &&
    Boolean(order.buyer.trim()) &&
    typeof order.style === "string" &&
    Boolean(order.style.trim()) &&
    typeof order.productionUnit === "string" &&
    Boolean(order.productionUnit.trim()) &&
    Number.isInteger(order.quantity) &&
    order.quantity >= 0 &&
    isValidDate(order.exFactoryDate) &&
    (order.orderDate === undefined ||
      order.orderDate === "" ||
      isValidDate(order.orderDate)) &&
    orderStatuses.some((status) => status.value === order.status) &&
    (order.stageOutput === undefined ||
      (Number.isFinite(order.stageOutput) && order.stageOutput >= 0)) &&
    (order.productionTarget === undefined ||
      (Number.isInteger(order.productionTarget) &&
        order.productionTarget > 0)) &&
    isValidSizeBreakdown(order.sizeBreakdown, order.quantity) &&
    isValidMilestones(order)
  );
}

function isValidOrderList(orders) {
  if (!Array.isArray(orders) || !orders.every(isValidStoredOrder)) {
    return false;
  }
  const poNumbers = orders.map((order) => order.poNumber.trim().toLocaleLowerCase());
  const ids = orders.map((order) =>
    (order.id || order.poNumber).toLocaleLowerCase(),
  );
  return (
    new Set(poNumbers).size === poNumbers.length &&
    new Set(ids).size === ids.length
  );
}

export function loadOrderData() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === null) {
      return { orders: productionOrders.map(normalizeOrder), error: "" };
    }

    const parsed = JSON.parse(stored);
    if (!parsed || parsed.version !== 1 || !isValidOrderList(parsed.orders)) {
      return {
        orders: productionOrders.map(normalizeOrder),
        error:
          "Saved order data could not be read. Showing the original sample orders; save a valid order to replace the damaged data.",
      };
    }

    return { orders: parsed.orders.map(normalizeOrder), error: "" };
  } catch {
    return {
      orders: productionOrders.map(normalizeOrder),
      error:
        "Saved order data is unavailable. Showing the original sample orders; check browser storage before saving changes.",
    };
  }
}

export function writeOrderData(orders) {
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ version: 1, orders }),
  );
}

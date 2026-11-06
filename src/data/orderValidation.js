import { requiredMilestones } from "./productionOrders.js";

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) {
    return false;
  }
  const date = new Date(`${value}T12:00:00`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function validateOrder(order, orders, existingId = null) {
  const errors = {};
  const poNumber = order.poNumber.trim();

  if (!poNumber) {
    errors.poNumber = "Enter a PO number.";
  } else if (
    orders.some(
      (savedOrder) =>
        savedOrder.id !== existingId &&
        savedOrder.poNumber.trim().toLocaleLowerCase() ===
          poNumber.toLocaleLowerCase(),
    )
  ) {
    errors.poNumber = "That PO number is already in use.";
  }

  if (!order.buyer.trim()) {
    errors.buyer = "Select or enter a buyer.";
  }
  if (!order.productionUnit) {
    errors.productionUnit = "Select a production unit.";
  }
  if (!order.style.trim()) {
    errors.style = "Enter a style name.";
  }
  if (!order.exFactoryDate || !isValidDate(order.exFactoryDate)) {
    errors.exFactoryDate = "Enter a valid ex-factory date.";
  }
  if (order.orderDate && !isValidDate(order.orderDate)) {
    errors.orderDate = "Enter a valid order date.";
  }
  if (
    order.orderDate &&
    isValidDate(order.orderDate) &&
    isValidDate(order.exFactoryDate) &&
    order.exFactoryDate < order.orderDate
  ) {
    errors.exFactoryDate = "Ex-factory date cannot be before the order date.";
  }

  const sizeNames = new Set();
  let totalQuantity = 0;
  let hasInvalidSize = false;
  for (const row of order.sizeBreakdown) {
    const name = row.size.trim().toLocaleLowerCase();
    const quantity = Number(row.quantity);

    if (
      !name ||
      row.quantity === "" ||
      !Number.isInteger(quantity) ||
      quantity < 0
    ) {
      hasInvalidSize = true;
      continue;
    }
    if (sizeNames.has(name)) {
      errors.sizeBreakdown =
        "Each size must be unique. Check the duplicate size entries.";
    }
    sizeNames.add(name);
    totalQuantity += quantity;
  }

  if (hasInvalidSize) {
    errors.sizeBreakdown =
      "Enter a size and a non-negative whole-number quantity for every row.";
  } else if (order.sizeBreakdown.length === 0) {
    errors.sizeBreakdown = "Add at least one size and quantity.";
  } else if (totalQuantity <= 0) {
    errors.sizeBreakdown = "Order quantity must be greater than zero.";
  }

  if (
    order.separateProductionTarget &&
    (!Number.isInteger(Number(order.productionTarget)) ||
      Number(order.productionTarget) <= 0)
  ) {
    errors.productionTarget =
      "Enter a positive whole-number production target.";
  }

  const milestones = Array.isArray(order.milestones) ? order.milestones : [];
  for (const required of requiredMilestones) {
    if (!milestones.some((milestone) => milestone.key === required.key)) {
      errors.milestones = `Add the required ${required.name} milestone.`;
    }
  }

  const exFactoryMilestone = milestones.find(
    (milestone) => milestone.key === "ex-factory",
  );
  if (
    exFactoryMilestone &&
    exFactoryMilestone.plannedDate !== order.exFactoryDate
  ) {
    errors.milestones =
      "The Ex-Factory milestone date must match the order ex-factory date.";
  }

  for (const milestone of milestones) {
    const nameError = !milestone.name.trim()
      ? "Enter a milestone name."
      : "";
    if (nameError) {
      errors[`milestones.${milestone.id}.name`] = nameError;
    }

    if (milestone.required && !milestone.plannedDate) {
      errors[`milestones.${milestone.id}.plannedDate`] =
        "Choose a date for this required milestone.";
    } else if (milestone.plannedDate && !isValidDate(milestone.plannedDate)) {
      errors[`milestones.${milestone.id}.plannedDate`] =
        "Enter a valid milestone date.";
    } else if (
      milestone.plannedDate &&
      order.orderDate &&
      milestone.plannedDate < order.orderDate
    ) {
      errors[`milestones.${milestone.id}.plannedDate`] =
        "Milestone date cannot be before the order date.";
    } else if (
      milestone.plannedDate &&
      order.exFactoryDate &&
      milestone.key !== "ex-factory" &&
      milestone.plannedDate > order.exFactoryDate
    ) {
      errors[`milestones.${milestone.id}.plannedDate`] =
        "Milestone date cannot be after ex-factory.";
    }

    if (milestone.completed && !isValidDate(milestone.completedDate)) {
      errors[`milestones.${milestone.id}.completedDate`] =
        "Enter the completion date.";
    }
    if (
      milestone.completed &&
      isValidDate(milestone.completedDate) &&
      milestone.plannedDate &&
      milestone.completedDate < milestone.plannedDate
    ) {
      errors[`milestones.${milestone.id}.completedDate`] =
        "Completion date cannot be before the planned date.";
    }
  }

  return { errors, totalQuantity };
}

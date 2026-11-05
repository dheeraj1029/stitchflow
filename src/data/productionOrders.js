export const productionOrders = [
  {
    poNumber: "B-PO-88213",
    buyer: "Company B (UK)",
    style: "Men's Crew Neck Tee",
    colour: "Navy",
    quantity: 12000,
    stage: "Stitching",
    stageOutput: 6800,
    exFactoryDate: "2026-11-20",
    status: "on-track",
    productionUnit: "North Mill (Demo)",
  },
  {
    poNumber: "B-PO-88240",
    buyer: "Company B (UK)",
    style: "Men's Polo",
    colour: "White",
    quantity: 8000,
    stage: "Finishing",
    stageOutput: 5200,
    exFactoryDate: "2026-11-12",
    status: "at-risk",
    productionUnit: "Riverside Works (Demo)",
  },
  {
    poNumber: "C-PO-0488",
    buyer: "Company C (Germany)",
    style: "Kids Printed Tee",
    colour: "Yellow",
    quantity: 10000,
    stage: "Printing",
    stageOutput: 3100,
    exFactoryDate: "2026-11-28",
    status: "delayed",
    productionUnit: "East Works (Demo)",
  },
];

export const orderStatuses = [
  { value: "on-track", label: "On Track" },
  { value: "at-risk", label: "At Risk" },
  { value: "delayed", label: "Delayed" },
  { value: "completed", label: "Completed" },
  { value: "pending", label: "Pending" },
];

export function getStageProgress(order) {
  if (!Number.isFinite(order.quantity) || order.quantity <= 0) {
    return 0;
  }

  if (!Number.isFinite(order.stageOutput) || order.stageOutput < 0) {
    return 0;
  }

  return Math.min((order.stageOutput / order.quantity) * 100, 100);
}

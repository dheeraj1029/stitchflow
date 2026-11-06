export const orderStatuses = [
  { value: "on-track", label: "On Track" },
  { value: "at-risk", label: "At Risk" },
  { value: "delayed", label: "Delayed" },
  { value: "completed", label: "Completed" },
  { value: "pending", label: "Pending" },
];

export const requiredMilestones = [
  { key: "order-confirmation", name: "Order Confirmation" },
  { key: "sample-approval", name: "Sample Approval" },
  { key: "fabric-in-house", name: "Fabric In-house" },
  { key: "cutting-start", name: "Cutting Start" },
  { key: "stitching-start", name: "Stitching Start" },
  { key: "finishing-start", name: "Finishing Start" },
  { key: "final-inspection", name: "Final Inspection" },
  { key: "packing-completion", name: "Packing Completion" },
  { key: "ex-factory", name: "Ex-Factory" },
];

const demoMilestones = (orderDate, exFactoryDate) => {
  const start = new Date(`${orderDate}T12:00:00`).getTime();
  const end = new Date(`${exFactoryDate}T12:00:00`).getTime();
  const names = [
    "Order Confirmation",
    "Sample Approval",
    "Fabric In-house",
    "Cutting Start",
    "Printing / Embroidery",
    "Stitching Start",
    "Finishing Start",
    "Final Inspection",
    "Packing Completion",
    "Ex-Factory",
  ];

  return names.map((name, index) => {
    const plannedDate =
      index === names.length - 1
        ? exFactoryDate
        : new Date(
            start + ((end - start) * index) / (names.length - 1),
          )
            .toISOString()
            .slice(0, 10);

    return {
      id: `demo-${index + 1}`,
      name,
      plannedDate,
      required: name !== "Printing / Embroidery",
      completed: false,
      completedDate: "",
      updatedAt: new Date().toISOString(),
    };
  });
};

export const productionOrders = [
  {
    id: "B-PO-88213",
    poNumber: "B-PO-88213",
    buyer: "Company B (UK)",
    buyerCountry: "United Kingdom",
    buyerReference: "",
    orderDate: "2026-10-01",
    style: "Men's Crew Neck Tee",
    styleNumber: "",
    productCategory: "T-shirt",
    colour: "Navy",
    fabricDescription: "",
    notes: "",
    quantity: 12000,
    sizeBreakdown: [],
    stage: "Stitching",
    stageOutput: 6800,
    productionTarget: 12000,
    productionNotes: "",
    exFactoryDate: "2026-11-20",
    status: "on-track",
    productionUnit: "North Mill (Demo)",
    milestones: demoMilestones("2026-10-01", "2026-11-20"),
  },
  {
    id: "B-PO-88240",
    poNumber: "B-PO-88240",
    buyer: "Company B (UK)",
    buyerCountry: "United Kingdom",
    buyerReference: "",
    orderDate: "2026-09-20",
    style: "Men's Polo",
    styleNumber: "",
    productCategory: "Polo",
    colour: "White",
    fabricDescription: "",
    notes: "",
    quantity: 8000,
    sizeBreakdown: [],
    stage: "Finishing",
    stageOutput: 5200,
    productionTarget: 8000,
    productionNotes: "",
    exFactoryDate: "2026-11-12",
    status: "at-risk",
    productionUnit: "Riverside Works (Demo)",
    milestones: demoMilestones("2026-09-20", "2026-11-12"),
  },
  {
    id: "C-PO-0488",
    poNumber: "C-PO-0488",
    buyer: "Company C (Germany)",
    buyerCountry: "Germany",
    buyerReference: "",
    orderDate: "2026-10-05",
    style: "Kids Printed Tee",
    styleNumber: "",
    productCategory: "T-shirt",
    colour: "Yellow",
    fabricDescription: "",
    notes: "",
    quantity: 10000,
    sizeBreakdown: [],
    stage: "Printing",
    stageOutput: 3100,
    productionTarget: 10000,
    productionNotes: "",
    exFactoryDate: "2026-11-28",
    status: "delayed",
    productionUnit: "East Works (Demo)",
    milestones: demoMilestones("2026-10-05", "2026-11-28"),
  },
];

export function normalizeOrder(order) {
  return {
    ...order,
    id: order.id || order.poNumber,
    buyerCountry: order.buyerCountry || "",
    buyerReference: order.buyerReference || "",
    orderDate: order.orderDate || "",
    styleNumber: order.styleNumber || "",
    productCategory: order.productCategory || "",
    fabricDescription: order.fabricDescription || "",
    notes: order.notes || "",
    sizeBreakdown: Array.isArray(order.sizeBreakdown) ? order.sizeBreakdown : [],
    productionTarget: order.productionTarget ?? order.quantity,
    productionNotes: order.productionNotes || "",
    milestones: Array.isArray(order.milestones)
      ? order.milestones.map((milestone) => ({
          ...milestone,
          key: milestone.key || "",
          required: Boolean(milestone.required),
          completed: Boolean(milestone.completed),
          completedDate: milestone.completedDate || "",
          updatedAt:
            milestone.updatedAt &&
            !Number.isNaN(Date.parse(milestone.updatedAt))
              ? milestone.updatedAt
              : new Date().toISOString(),
        }))
      : demoMilestones(order.orderDate || "2026-10-01", order.exFactoryDate),
  };
}

export function getStageProgress(order) {
  const target = getStageTarget(order);
  if (!Number.isFinite(target) || target <= 0) {
    return 0;
  }

  if (!Number.isFinite(order.stageOutput) || order.stageOutput < 0) {
    return 0;
  }

  return Math.min((order.stageOutput / target) * 100, 100);
}

export function getStageTarget(order) {
  return Number.isFinite(order.productionTarget) && order.productionTarget > 0
    ? order.productionTarget
    : order.quantity;
}

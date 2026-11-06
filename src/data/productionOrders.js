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

export const productionStages = [
  "Cutting",
  "Printing",
  "Embroidery",
  "Stitching",
  "Washing",
  "Finishing",
  "Packing",
];

export const demoOrderWorkflows = {
  "B-PO-88213": ["Cutting", "Stitching", "Finishing", "Packing"],
  "B-PO-88240": ["Cutting", "Stitching", "Finishing", "Packing"],
  "C-PO-0488": ["Cutting", "Printing", "Stitching", "Finishing", "Packing"],
};

function workflowFor(order) {
  const stages =
    order.workflowStages?.length
      ? order.workflowStages
      : demoOrderWorkflows[order.poNumber] ||
        (order.stage ? [order.stage] : []);
  const target = order.productionTarget ?? order.quantity;
  return stages.map((stage) =>
    typeof stage === "string"
      ? { name: stage, target }
      : { name: stage.name, target: stage.target ?? target },
  );
}

export function getOrderWorkflow(order) {
  return workflowFor(order).filter(({ name }) => productionStages.includes(name));
}

export function getStageTarget(order, stage = order.stage) {
  const workflowStage = getOrderWorkflow(order).find(
    (item) => item.name === stage,
  );
  return Number.isInteger(workflowStage?.target) && workflowStage.target > 0
    ? workflowStage.target
    : null;
}

export function getBaselineStageOutput(order, stage = order.stage) {
  if (Number.isFinite(order.baselineStageOutputs?.[stage])) {
    return order.baselineStageOutputs[stage];
  }
  if (
    stage === order.stage &&
    Number.isFinite(order.baselineStageOutput)
  ) {
    return order.baselineStageOutput;
  }
  return stage === order.stage && Number.isFinite(order.stageOutput)
    ? order.stageOutput
    : 0;
}

export function getCumulativeStageOutput(order, stage, updates) {
  return (
    getBaselineStageOutput(order, stage) +
    updates.reduce(
      (total, update) =>
        update.orderId === order.id && update.stage === stage
          ? total + update.completedQuantity
          : total,
      0,
    )
  );
}

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
      key:
        requiredMilestones.find((milestone) => milestone.name === name)?.key ||
        (name === "Printing / Embroidery" ? "printing-embroidery" : ""),
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
    workflowStages: demoOrderWorkflows["B-PO-88213"],
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
    workflowStages: demoOrderWorkflows["B-PO-88240"],
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
    workflowStages: demoOrderWorkflows["C-PO-0488"],
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
    workflowStages: workflowFor(order),
    productionNotes: order.productionNotes || "",
    milestones: Array.isArray(order.milestones)
      ? order.milestones.map((milestone) => ({
          ...milestone,
          key:
            milestone.key ||
            requiredMilestones.find(
              (required) => required.name === milestone.name,
            )?.key ||
            (milestone.name === "Printing / Embroidery"
              ? "printing-embroidery"
              : ""),
          required:
            milestone.required ??
            requiredMilestones.some(
              (required) => required.name === milestone.name,
            ),
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
  const target = getStageTarget(order, order.stage);
  if (!Number.isFinite(target) || target <= 0) {
    return 0;
  }

  if (!Number.isFinite(order.stageOutput) || order.stageOutput < 0) {
    return 0;
  }

  return Math.min((order.stageOutput / target) * 100, 100);
}

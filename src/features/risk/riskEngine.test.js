import assert from "node:assert/strict";
import test from "node:test";
import {
  addWorkingDays,
  countWorkingDaysAfter,
  countWorkingDaysBetween,
  getLastWorkingDates,
} from "./riskHelpers.js";
import {
  predictOrderStageRisk,
  predictProductionRisks,
  summarizeOrderRisks,
} from "./riskEngine.js";
import { RISK_LEVELS } from "./riskConstants.js";

const AS_OF = "2026-11-06";

function makeOrder({
  target = 200,
  output = 100,
  plannedDate = "2026-11-13",
  stage = "Stitching",
  workflowStages = [stage],
  milestones = [
    {
      id: "stitching-start",
      key: "stitching-start",
      name: "Stitching Start",
      plannedDate,
    },
  ],
} = {}) {
  return {
    id: "order-1",
    poNumber: "PO-1",
    buyer: "Buyer A",
    style: "Crew tee",
    productionUnit: "North Mill",
    quantity: target,
    productionTarget: target,
    stage,
    stageOutput: output,
    workflowStages,
    milestones,
  };
}

function updatesFor(quantity, { dates = ["2026-11-02"], stage = "Stitching" } = {}) {
  return dates.map((productionDate, index) => ({
    id: `update-${index + 1}`,
    orderId: "order-1",
    stage,
    productionDate,
    completedQuantity: quantity,
  }));
}

test("classifies an adequately progressing stage as green", () => {
  const result = predictOrderStageRisk(
    makeOrder({ target: 350, output: 0 }),
    "Stitching",
    updatesFor(250),
    AS_OF,
  );
  assert.equal(result.riskLevel, RISK_LEVELS.GREEN);
  assert.equal(result.actualDailyRate, 50);
  assert.equal(result.remainingQuantity, 100);
});

test("classifies a modest shortfall within the red threshold as amber", () => {
  const result = predictOrderStageRisk(
    makeOrder({ target: 190, output: 0 }),
    "Stitching",
    updatesFor(90),
    AS_OF,
  );
  assert.equal(result.riskLevel, RISK_LEVELS.AMBER);
  assert.equal(result.actualDailyRate, 18);
  assert.match(result.explanation, /25% amber tolerance/i);
});

test("classifies a severe shortfall and late projection as red", () => {
  const result = predictOrderStageRisk(
    makeOrder({ target: 150, output: 0 }),
    "Stitching",
    updatesFor(50),
    AS_OF,
  );
  assert.equal(result.riskLevel, RISK_LEVELS.RED);
  assert.ok(result.projectedCompletionDate > result.milestoneDate);
});

test("overdue incomplete milestones are red even without recent history", () => {
  const result = predictOrderStageRisk(
    makeOrder({ plannedDate: "2026-11-05" }),
    "Stitching",
    [],
    AS_OF,
  );
  assert.equal(result.riskLevel, RISK_LEVELS.RED);
  assert.equal(result.isOverdue, true);
});

test("insufficient recent history is unknown", () => {
  const result = predictOrderStageRisk(makeOrder(), "Stitching", [], AS_OF);
  assert.equal(result.riskLevel, RISK_LEVELS.UNKNOWN);
  assert.equal(result.actualDailyRate, null);
});

test("updates outside the five-day observation window do not count as history", () => {
  const result = predictOrderStageRisk(
    makeOrder(),
    "Stitching",
    updatesFor(500, { dates: ["2026-10-30"] }),
    AS_OF,
  );
  assert.equal(result.hasSufficientHistory, false);
  assert.equal(result.actualDailyRate, null);
});

test("zero recorded output does not divide by zero or invent a projection", () => {
  const result = predictOrderStageRisk(
    makeOrder(),
    "Stitching",
    updatesFor(0),
    AS_OF,
  );
  assert.equal(result.actualDailyRate, 0);
  assert.equal(result.projectedCompletionDate, null);
  assert.equal(result.riskLevel, RISK_LEVELS.RED);
  assert.ok(Number.isFinite(result.requiredDailyRate));
});

test("missing target or milestone date produces unknown", () => {
  const missingTarget = predictOrderStageRisk(
    makeOrder({ target: 0 }),
    "Stitching",
    updatesFor(100),
    AS_OF,
  );
  const missingDate = predictOrderStageRisk(
    makeOrder({
      milestones: [
        {
          key: "stitching-start",
          name: "Stitching Start",
          plannedDate: "",
        },
      ],
    }),
    "Stitching",
    updatesFor(100),
    AS_OF,
  );
  assert.equal(missingTarget.riskLevel, RISK_LEVELS.UNKNOWN);
  assert.equal(missingTarget.remainingQuantity, null);
  assert.equal(missingDate.riskLevel, RISK_LEVELS.UNKNOWN);
  assert.equal(missingDate.milestoneDate, null);
});

test("working-day helpers exclude weekends", () => {
  assert.deepEqual(
    getLastWorkingDates("2026-11-09", 5),
    ["2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-09"],
  );
  assert.equal(addWorkingDays("2026-11-06", 1), "2026-11-09");
  assert.equal(countWorkingDaysAfter("2026-11-06", "2026-11-13"), 5);
  assert.equal(countWorkingDaysBetween("2026-11-10", "2026-11-13"), 2);
});

test("an incomplete stage due today has no remaining workdays and is red", () => {
  const result = predictOrderStageRisk(
    makeOrder({ plannedDate: AS_OF }),
    "Stitching",
    updatesFor(10),
    AS_OF,
  );
  assert.equal(result.remainingWorkingDays, 0);
  assert.equal(result.requiredDailyRate, null);
  assert.equal(result.riskLevel, RISK_LEVELS.RED);
});

test("stage output and update rates are independent", () => {
  const order = makeOrder({
    target: 1000,
    output: 500,
    workflowStages: ["Stitching", "Finishing"],
    milestones: [
      {
        key: "stitching-start",
        name: "Stitching Start",
        plannedDate: "2026-11-13",
      },
      {
        key: "finishing-start",
        name: "Finishing Start",
        plannedDate: "2026-11-13",
      },
    ],
  });
  const updates = [
    ...updatesFor(200),
    ...updatesFor(400, { stage: "Finishing" }),
  ];
  const stitching = predictOrderStageRisk(order, "Stitching", updates, AS_OF);
  const finishing = predictOrderStageRisk(order, "Finishing", updates, AS_OF);
  assert.equal(stitching.output, 700);
  assert.equal(finishing.output, 400);
  assert.equal(stitching.actualDailyRate, 40);
  assert.equal(finishing.actualDailyRate, 80);
});

test("multiple updates on one date are added within the stage window", () => {
  const result = predictOrderStageRisk(
    makeOrder(),
    "Stitching",
    [
      ...updatesFor(100),
      {
        id: "update-extra",
        orderId: "order-1",
        stage: "Stitching",
        productionDate: "2026-11-02",
        completedQuantity: 50,
      },
    ],
    AS_OF,
  );
  assert.equal(result.recordedUpdateCount, 2);
  assert.equal(result.actualDailyRate, 30);
});

test("new updates and changed milestones recalculate prediction results", () => {
  const order = makeOrder();
  const before = predictOrderStageRisk(order, "Stitching", [], AS_OF);
  const updatedOrder = makeOrder({ target: 450, output: 100 });
  const afterUpdate = predictOrderStageRisk(
    updatedOrder,
    "Stitching",
    updatesFor(250),
    AS_OF,
  );
  const afterMilestoneEdit = predictOrderStageRisk(
    makeOrder({ target: 450, output: 100, plannedDate: "2026-11-10" }),
    "Stitching",
    updatesFor(250),
    AS_OF,
  );
  assert.equal(before.riskLevel, RISK_LEVELS.UNKNOWN);
  assert.equal(afterUpdate.riskLevel, RISK_LEVELS.GREEN);
  assert.equal(afterMilestoneEdit.riskLevel, RISK_LEVELS.AMBER);
});

test("completed and over-target output never has negative remaining quantity", () => {
  const completed = predictOrderStageRisk(
    makeOrder({ target: 200, output: 200 }),
    "Stitching",
    [],
    AS_OF,
  );
  const overTarget = predictOrderStageRisk(
    makeOrder({ target: 200, output: 250 }),
    "Stitching",
    [],
    AS_OF,
  );
  assert.equal(completed.remainingQuantity, 0);
  assert.equal(completed.riskLevel, RISK_LEVELS.GREEN);
  assert.equal(overTarget.remainingQuantity, 0);
  assert.equal(overTarget.progressPercent, 100);
});

test("invalid dates and stages without mapped milestones remain safe and unknown", () => {
  const invalidDate = predictOrderStageRisk(
    makeOrder({
      plannedDate: "2026-02-31",
      stage: "Stitching",
    }),
    "Stitching",
    updatesFor(100),
    AS_OF,
  );
  const unmappedStage = predictOrderStageRisk(
    makeOrder({ stage: "Washing" }),
    "Washing",
    updatesFor(100, { stage: "Washing" }),
    AS_OF,
  );
  assert.equal(invalidDate.riskLevel, RISK_LEVELS.UNKNOWN);
  assert.equal(unmappedStage.riskLevel, RISK_LEVELS.UNKNOWN);
  assert.ok(Number.isFinite(invalidDate.output));
});

test("summary cards count unique orders with matching stage risks", () => {
  const assessments = [
    { orderId: "a", riskLevel: RISK_LEVELS.GREEN },
    { orderId: "a", riskLevel: RISK_LEVELS.RED },
    { orderId: "b", riskLevel: RISK_LEVELS.AMBER },
    { orderId: "c", riskLevel: RISK_LEVELS.UNKNOWN },
  ];
  assert.deepEqual(
    {
      totalOrders: summarizeOrderRisks(assessments).totalOrders,
      highRisk: summarizeOrderRisks(assessments).highRisk,
      needsAttention: summarizeOrderRisks(assessments).needsAttention,
      onTrack: summarizeOrderRisks(assessments).onTrack,
      insufficientData: summarizeOrderRisks(assessments).insufficientData,
    },
    {
      totalOrders: 3,
      highRisk: 1,
      needsAttention: 1,
      onTrack: 0,
      insufficientData: 1,
    },
  );
});

test("risk calculation does not mutate manually managed order status", () => {
  const order = { ...makeOrder(), status: "on-track" };
  predictOrderStageRisk(order, "Stitching", updatesFor(250), AS_OF);
  assert.equal(order.status, "on-track");
});

test("risk assessments are generated separately for configured workflow stages", () => {
  const order = makeOrder({
    workflowStages: ["Stitching", "Finishing"],
    milestones: [
      {
        key: "stitching-start",
        name: "Stitching Start",
        plannedDate: "2026-11-13",
      },
      {
        key: "finishing-start",
        name: "Finishing Start",
        plannedDate: "2026-11-13",
      },
    ],
  });
  const results = predictProductionRisks([order], updatesFor(250), AS_OF);
  assert.deepEqual(
    results.map(({ stage }) => stage),
    ["Stitching", "Finishing"],
  );
  assert.notEqual(results[0].output, results[1].output);
});

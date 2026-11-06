import {
  getCumulativeStageOutput,
  getOrderWorkflow,
  getStageTarget,
} from "../../data/productionOrders.js";
import {
  OBSERVATION_WORKING_DAYS,
  RED_RATE_VARIANCE,
  RISK_LEVELS,
  STAGE_MILESTONE_KEYS,
} from "./riskConstants.js";
import {
  addWorkingDays,
  countWorkingDaysAfter,
  countWorkingDaysBetween,
  formatDate,
  getLastWorkingDates,
  toDateString,
} from "./riskHelpers.js";

function findStageMilestone(order, stage) {
  const key = STAGE_MILESTONE_KEYS[stage];
  if (!key || !Array.isArray(order.milestones)) {
    return null;
  }
  return order.milestones.find(
    (milestone) =>
      milestone.key === key ||
      (stage === "Printing" &&
        milestone.name?.toLocaleLowerCase() === "printing / embroidery"),
  );
}

function getActualRate(order, stage, updates, asOfDate) {
  const observedDates = getLastWorkingDates(
    asOfDate,
    OBSERVATION_WORKING_DAYS,
  );
  const observedSet = new Set(observedDates);
  const matchingUpdates = updates.filter(
    (update) =>
      update.orderId === order.id &&
      update.stage === stage &&
      observedSet.has(update.productionDate) &&
      Number.isInteger(update.completedQuantity) &&
      update.completedQuantity >= 0,
  );
  if (matchingUpdates.length === 0) {
    return {
      actualDailyRate: null,
      hasSufficientHistory: false,
      observedDates,
      recordedUpdateCount: 0,
    };
  }

  const totalOutput = matchingUpdates.reduce(
    (sum, update) => sum + update.completedQuantity,
    0,
  );
  return {
    actualDailyRate: totalOutput / OBSERVATION_WORKING_DAYS,
    hasSufficientHistory: true,
    observedDates,
    recordedUpdateCount: matchingUpdates.length,
  };
}

function getExplanation(result) {
  const { actualDailyRate, remainingQuantity, requiredDailyRate, riskLevel } =
    result;
  if (riskLevel === RISK_LEVELS.RED && result.isOverdue) {
    return `${result.stage} remains incomplete after its planned milestone on ${formatDate(result.milestoneDate)}.`;
  }
  if (riskLevel === RISK_LEVELS.RED && result.remainingWorkingDays === 0) {
    return `${result.stage} still has ${remainingQuantity} pieces remaining, but no working days remain before its planned milestone.`;
  }
  if (riskLevel === RISK_LEVELS.RED && result.projectedCompletionDate) {
    return `${result.stage} is projected to finish after its planned milestone, with ${remainingQuantity} pieces remaining.`;
  }
  if (riskLevel === RISK_LEVELS.RED) {
    return `${result.stage} requires ${requiredDailyRate.toFixed(1)} pieces per working day, more than 25% above the current ${actualDailyRate.toFixed(1)}-piece daily rate.`;
  }
  if (riskLevel === RISK_LEVELS.AMBER && actualDailyRate < requiredDailyRate) {
    if (
      result.projectedCompletionDate &&
      result.projectedCompletionDate > result.milestoneDate
    ) {
      return `${result.stage} is running ${actualDailyRate.toFixed(1)} pieces per working day against ${requiredDailyRate.toFixed(1)} required. The shortfall is within the 25% amber tolerance, although the conservative projection is later than the milestone.`;
    }
    return `${result.stage} is below the required daily rate: ${actualDailyRate.toFixed(1)} actual versus ${requiredDailyRate.toFixed(1)} pieces needed.`;
  }
  if (riskLevel === RISK_LEVELS.AMBER) {
    return `${result.stage} is projected to finish with fewer than two working days of buffer before its planned milestone.`;
  }
  if (riskLevel === RISK_LEVELS.GREEN && result.remainingQuantity === 0) {
    return `${result.stage} has reached its stage target.`;
  }
  if (riskLevel === RISK_LEVELS.GREEN) {
    return `${result.stage} is projected to finish by its milestone with at least two working days of buffer.`;
  }
  if (result.missingTarget) {
    return `A valid target is not available for ${result.stage}, so a reliable risk estimate cannot be calculated.`;
  }
  if (result.missingMilestone) {
    return `No valid planned milestone date is available for ${result.stage}.`;
  }
  return `Insufficient production history for ${result.stage}; an update in the last five working days is needed to estimate its rate.`;
}

function getRecommendedAction(riskLevel, missingTarget, missingMilestone) {
  if (missingTarget || missingMilestone || riskLevel === RISK_LEVELS.UNKNOWN) {
    return "Confirm the stage target and milestone, then record a production update.";
  }
  if (riskLevel === RISK_LEVELS.RED) {
    return "Contact the production unit, review manpower allocation, and agree a recovery plan.";
  }
  if (riskLevel === RISK_LEVELS.AMBER) {
    return "Confirm the next production update with the supervisor and review daily capacity.";
  }
  return "Continue routine monitoring and confirm the next scheduled update.";
}

export function predictOrderStageRisk(order, stage, updates = [], asOf = new Date()) {
  const asOfDate = toDateString(asOf);
  const target = getStageTarget(order, stage);
  const rawOutput = getCumulativeStageOutput(order, stage, updates);
  const output = Number.isFinite(rawOutput) && rawOutput >= 0 ? rawOutput : 0;
  const missingTarget = !Number.isInteger(target) || target <= 0;
  const remainingQuantity = missingTarget
    ? null
    : Math.max(target - output, 0);
  const milestone = findStageMilestone(order, stage);
  const milestoneDate =
    milestone?.plannedDate && toDateString(milestone.plannedDate)
      ? milestone.plannedDate
      : null;
  const missingMilestone = !milestoneDate;
  const remainingWorkingDays =
    asOfDate && milestoneDate && milestoneDate >= asOfDate
      ? countWorkingDaysAfter(asOfDate, milestoneDate)
      : null;
  const requiredDailyRate =
    remainingQuantity === null || remainingWorkingDays === null
      ? null
      : remainingWorkingDays > 0
        ? remainingQuantity / remainingWorkingDays
        : remainingQuantity === 0
          ? 0
          : null;
  const actual = getActualRate(order, stage, updates, asOfDate);
  const projectedWorkingDays =
    actual.actualDailyRate > 0 && remainingQuantity !== null
      ? Math.ceil(remainingQuantity / actual.actualDailyRate)
      : remainingQuantity === 0
        ? 0
        : null;
  const projectedCompletionDate =
    asOfDate && projectedWorkingDays !== null
      ? addWorkingDays(asOfDate, projectedWorkingDays)
      : null;
  const bufferWorkingDays =
    projectedCompletionDate && milestoneDate
      ? countWorkingDaysBetween(projectedCompletionDate, milestoneDate)
      : null;
  const isOverdue =
    Boolean(asOfDate && milestoneDate && milestoneDate < asOfDate) &&
    remainingQuantity > 0;

  let riskLevel = RISK_LEVELS.UNKNOWN;
  if (!asOfDate || missingTarget || missingMilestone) {
    riskLevel = RISK_LEVELS.UNKNOWN;
  } else if (isOverdue) {
    riskLevel = RISK_LEVELS.RED;
  } else if (
    remainingQuantity > 0 &&
    remainingWorkingDays === 0
  ) {
    riskLevel = RISK_LEVELS.RED;
  } else if (remainingQuantity === 0) {
    riskLevel = RISK_LEVELS.GREEN;
  } else if (!actual.hasSufficientHistory) {
    riskLevel = RISK_LEVELS.UNKNOWN;
  } else if (
    requiredDailyRate !== null &&
    requiredDailyRate > actual.actualDailyRate * (1 + RED_RATE_VARIANCE)
  ) {
    riskLevel = RISK_LEVELS.RED;
  } else if (actual.actualDailyRate < requiredDailyRate) {
    // Keep a shortfall within the configured 25% tolerance amber while still
    // showing its projected miss in the details.
    riskLevel = RISK_LEVELS.AMBER;
  } else if (
    projectedCompletionDate &&
    projectedCompletionDate > milestoneDate
  ) {
    riskLevel = RISK_LEVELS.RED;
  } else if (bufferWorkingDays < 2) {
    riskLevel = RISK_LEVELS.AMBER;
  } else {
    riskLevel = RISK_LEVELS.GREEN;
  }

  const result = {
    orderId: order.id,
    poNumber: order.poNumber,
    buyer: order.buyer,
    style: order.style,
    productionUnit: order.productionUnit,
    stage,
    target,
    output,
    progressPercent:
      target && Number.isFinite(target)
        ? Math.min((output / target) * 100, 100)
        : null,
    remainingQuantity,
    requiredDailyRate,
    actualDailyRate: actual.actualDailyRate,
    observedDates: actual.observedDates,
    recordedUpdateCount: actual.recordedUpdateCount,
    hasSufficientHistory: actual.hasSufficientHistory,
    observationWorkingDays: OBSERVATION_WORKING_DAYS,
    remainingWorkingDays,
    projectedWorkingDays,
    projectedCompletionDate,
    plannedMilestone: milestone?.name || `${stage} milestone`,
    milestoneDate,
    milestoneCompleted: Boolean(milestone?.completed),
    bufferWorkingDays,
    riskLevel,
    isOverdue,
    missingTarget,
    missingMilestone,
  };
  result.explanation = getExplanation(result);
  result.recommendedAction = getRecommendedAction(
    riskLevel,
    missingTarget,
    missingMilestone,
  );
  return result;
}

export function predictProductionRisks(orders, updates = [], asOf = new Date()) {
  return orders.flatMap((order) =>
    getOrderWorkflow(order).map(({ name }) =>
      predictOrderStageRisk(order, name, updates, asOf),
    ),
  );
}

export function summarizeOrderRisks(assessments) {
  const byOrder = new Map();
  for (const assessment of assessments) {
    const stages = byOrder.get(assessment.orderId) || [];
    stages.push(assessment);
    byOrder.set(assessment.orderId, stages);
  }
  const orderRisks = [...byOrder].map(([orderId, stages]) => ({
    orderId,
    assessments: stages,
    riskLevel: stages.some(({ riskLevel }) => riskLevel === RISK_LEVELS.RED)
      ? RISK_LEVELS.RED
      : stages.some(({ riskLevel }) => riskLevel === RISK_LEVELS.AMBER)
        ? RISK_LEVELS.AMBER
        : stages.every(({ riskLevel }) => riskLevel === RISK_LEVELS.GREEN)
          ? RISK_LEVELS.GREEN
          : RISK_LEVELS.UNKNOWN,
  }));
  return {
    totalOrders: orderRisks.length,
    highRisk: orderRisks.filter(
      ({ assessments: stages }) =>
        stages.some(({ riskLevel }) => riskLevel === RISK_LEVELS.RED),
    ).length,
    needsAttention: orderRisks.filter(
      ({ assessments: stages }) =>
        stages.some(({ riskLevel }) => riskLevel === RISK_LEVELS.AMBER),
    ).length,
    onTrack: orderRisks.filter(
      ({ assessments: stages }) =>
        stages.length > 0 &&
        stages.every(({ riskLevel }) => riskLevel === RISK_LEVELS.GREEN),
    ).length,
    insufficientData: orderRisks.filter(
      ({ assessments: stages }) =>
        stages.some(({ riskLevel }) => riskLevel === RISK_LEVELS.UNKNOWN),
    ).length,
    orderRisks,
  };
}

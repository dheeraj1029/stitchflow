import "dotenv/config";
import { readFile } from "node:fs/promises";
import mongoose from "mongoose";
import { closeDatabase, connectDatabase } from "../config/database.js";
import BuyerOrganization from "../models/BuyerOrganization.js";
import IssueAuditLog from "../models/IssueAuditLog.js";
import Order from "../models/Order.js";
import ProductionIssue from "../models/ProductionIssue.js";
import ProductionUnit from "../models/ProductionUnit.js";
import ProductionUpdate from "../models/ProductionUpdate.js";
import User from "../models/User.js";
import {
  ISSUE_CATEGORIES,
  ISSUE_REVIEW_STATUSES,
  ISSUE_SEVERITIES,
  ORDER_STATUSES,
  PRODUCTION_STAGES,
} from "../models/constants.js";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const REQUIRED_MILESTONES = [
  ["order-confirmation", "Order Confirmation"],
  ["sample-approval", "Sample Approval"],
  ["fabric-in-house", "Fabric In-house"],
  ["cutting-start", "Cutting Start"],
  ["stitching-start", "Stitching Start"],
  ["finishing-start", "Finishing Start"],
  ["final-inspection", "Final Inspection"],
  ["packing-completion", "Packing Completion"],
  ["ex-factory", "Ex-Factory"],
];
const auditActions = {
  SUBMITTED: "SUBMITTED",
  AI_CLASSIFIED: "AI_CLASSIFICATION_COMPLETED",
  AI_CLASSIFICATION_COMPLETED: "AI_CLASSIFICATION_COMPLETED",
  CLASSIFICATION_FAILED: "AI_CLASSIFICATION_FAILED",
  AI_CLASSIFICATION_FAILED: "AI_CLASSIFICATION_FAILED",
  CLASSIFICATION_RETRIED: "CLASSIFICATION_RETRIED",
  TRANSLATION_EDITED: "TRANSLATION_EDITED",
  CATEGORY_CHANGED: "CATEGORY_CHANGED",
  SEVERITY_CHANGED: "SEVERITY_CHANGED",
  MERCHANDISER_CONFIRMED: "CONFIRMED",
  CONFIRMED: "CONFIRMED",
  MERCHANDISER_REJECTED: "REJECTED",
  REJECTED: "REJECTED",
};
const unitAliases = {
  "North Mill (Demo)": "Unit A",
  "Riverside Works (Demo)": "Unit B",
  "East Works (Demo)": "Unit C",
};

function isDate(value, allowEmpty = false) {
  if (allowEmpty && value === "") return true;
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function rows(bundle, key, field) {
  const value = bundle[key];
  if (value == null) return [];
  if (value.version !== 1 || !Array.isArray(value[field])) {
    throw new Error(`The export contains an invalid ${key} section.`);
  }
  return value[field];
}

function normalizeWorkflow(order) {
  const workflow = order.workflowStages || [order.stage];
  if (
    !Array.isArray(workflow) ||
    workflow.length === 0 ||
    workflow.length > PRODUCTION_STAGES.length
  ) {
    throw new Error("Order has an invalid production workflow.");
  }
  return workflow.map((entry) => {
    const name = typeof entry === "string" ? entry : entry.name;
    const target = typeof entry === "string"
      ? name === order.stage
        ? order.productionTarget ?? order.quantity
        : order.quantity
      : entry.target ??
        (name === order.stage
          ? order.productionTarget ?? order.quantity
          : order.quantity);
    if (!PRODUCTION_STAGES.includes(name) || !Number.isInteger(target) || target <= 0) {
      throw new Error("Order has an invalid production stage or target.");
    }
    return { name, target };
  });
}

function normalizeMilestones(order) {
  if (!Array.isArray(order.milestones)) {
    throw new Error("Order has no valid TNA milestones.");
  }
  const ids = new Set();
  const normalized = order.milestones.map((milestone, index) => {
    if (
      typeof milestone.name !== "string" ||
      !milestone.name.trim() ||
      (milestone.plannedDate && !isDate(milestone.plannedDate)) ||
      (!milestone.plannedDate && milestone.required) ||
      (milestone.completedDate && !isDate(milestone.completedDate)) ||
      (milestone.completed &&
        (!isDate(milestone.completedDate) ||
          milestone.completedDate < milestone.plannedDate)) ||
      (milestone.plannedDate &&
        milestone.key !== "ex-factory" &&
        milestone.name !== "Ex-Factory" &&
        (milestone.plannedDate < (order.orderDate || "") ||
          milestone.plannedDate > order.exFactoryDate))
    ) {
      throw new Error("Order has an invalid TNA milestone.");
    }
    const id = milestone.id || `legacy-milestone-${index + 1}`;
    if (ids.has(id)) throw new Error("Order has duplicate TNA milestone IDs.");
    ids.add(id);
    return {
      id,
      key: milestone.key || "",
      name: milestone.name,
      plannedDate:
        milestone.key === "ex-factory" || milestone.name === "Ex-Factory"
          ? order.exFactoryDate
          : milestone.plannedDate,
      completedAt: milestone.completedDate || "",
      isCompleted: Boolean(milestone.completed),
      sortOrder: index,
      required: Boolean(milestone.required),
      updatedAt: Number.isNaN(Date.parse(milestone.updatedAt || ""))
        ? new Date()
        : new Date(milestone.updatedAt),
    };
  });
  for (const [key, name] of REQUIRED_MILESTONES) {
    if (!normalized.some((item) => item.key === key || item.name === name)) {
      throw new Error(`Order is missing the ${name} milestone.`);
    }
  }
  return normalized;
}

async function importOrder(source, report) {
  try {
    if (
      !source ||
      typeof source.poNumber !== "string" ||
      typeof source.buyer !== "string" ||
      typeof source.productionUnit !== "string" ||
      !Number.isInteger(source.quantity) ||
      source.quantity <= 0 ||
      !isDate(source.exFactoryDate) ||
      (source.orderDate && !isDate(source.orderDate)) ||
      (source.orderDate && source.orderDate > source.exFactoryDate) ||
      !ORDER_STATUSES.includes(source.status)
    ) {
      throw new Error("Order fields are invalid.");
    }
    if (await Order.exists({ poNumber: source.poNumber })) {
      report.orders.skipped += 1;
      return;
    }
    const buyerCountry = source.buyerCountry?.trim();
    if (!buyerCountry) throw new Error("Order buyer country is missing.");
    const buyer = await BuyerOrganization.findOneAndUpdate(
      { name: source.buyer },
      {
        $setOnInsert: {
          name: source.buyer,
          country: buyerCountry,
        },
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
    );
    const productionUnitName =
      unitAliases[source.productionUnit] || source.productionUnit;
    const unit = await ProductionUnit.findOneAndUpdate(
      { name: productionUnitName },
      { $setOnInsert: { name: productionUnitName } },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
    );
    const stages = normalizeWorkflow(source);
    const stage = source.stage;
    if (
      new Set(stages.map((item) => item.name)).size !== stages.length ||
      !PRODUCTION_STAGES.includes(stage) ||
      !stages.some((item) => item.name === stage)
    ) {
      throw new Error("Order current stage is invalid.");
    }
    const rawSizeQuantities = source.sizeBreakdown || source.sizeQuantities || [];
    if (
      !Array.isArray(rawSizeQuantities) ||
      rawSizeQuantities.some(
        (row) =>
          !row ||
          !Number.isInteger(row.quantity) ||
          row.quantity < 0 ||
          (row.quantity > 0 &&
            (typeof row.size !== "string" || !row.size.trim())),
      )
    ) {
      throw new Error("Order size quantities are invalid.");
    }
    const sizeQuantities = rawSizeQuantities.filter((row) => row.quantity > 0);
    if (
      sizeQuantities.length > 0 &&
      (new Set(sizeQuantities.map((row) => row.size.trim().toLocaleLowerCase())).size !==
        sizeQuantities.length ||
        sizeQuantities.reduce((sum, row) => sum + row.quantity, 0) !== source.quantity)
    ) {
      throw new Error("Order size quantities do not match the total.");
    }
    const targets = stages.map(({ name, target }) => {
      const previous = source.baselineStageOutputs?.[name] ??
        (name === stage ? source.baselineStageOutput ?? source.stageOutput ?? 0 : 0);
      if (!Number.isInteger(previous) || previous < 0 || previous > target) {
        throw new Error("Order baseline stage output is invalid.");
      }
      return {
        stage: name,
        targetQuantity: target,
        baselineOutput: previous,
        currentOutput: previous,
      };
    });
    await Order.create({
      poNumber: source.poNumber,
      buyerOrganization: buyer._id,
      productionUnit: unit._id,
      buyerReference: source.buyerReference || "",
      orderDate: source.orderDate || "",
      style: source.style,
      styleNumber: source.styleNumber || "",
      productDescription: source.productDescription || "",
      productCategory: source.productCategory || "",
      colour: source.colour,
      fabricDescription: source.fabricDescription || "",
      notes: source.notes || "",
      productionNotes: source.productionNotes || "",
      totalQuantity: source.quantity,
      sizeQuantities,
      currentStage: stage,
      status: source.status,
      exFactoryDate: source.exFactoryDate,
      workflowStages: stages,
      productionTargets: targets,
      tnaMilestones: normalizeMilestones(source),
      isDemo: false,
    });
    report.orders.imported += 1;
  } catch (error) {
    report.orders.skipped += 1;
    report.invalid.push({ type: "order", id: source?.poNumber || "unknown", reason: error.message });
  }
}

async function importUpdate(source, supervisor, report) {
  try {
    if (
      !source ||
      typeof source.id !== "string" ||
      !isDate(source.productionDate) ||
      !Number.isInteger(source.completedQuantity) ||
      source.completedQuantity <= 0 ||
      !PRODUCTION_STAGES.includes(source.stage)
    ) {
      throw new Error("Production update fields are invalid.");
    }
    if (await ProductionUpdate.exists({ legacyId: source.id })) {
      report.productionUpdates.skipped += 1;
      return;
    }
    const session = await mongoose.startSession();
    try {
      let imported = false;
      await session.withTransaction(async () => {
        const order = await Order.findOne({
          poNumber: source.poNumber || source.orderId,
        }).session(session);
        if (!order) throw new Error("Production update order was not found.");
        const target = order.productionTargets.find((item) => item.stage === source.stage);
        if (!target || target.currentOutput + source.completedQuantity > target.targetQuantity) {
          throw new Error("Production update exceeds its stage target.");
        }
        await ProductionUpdate.create(
          [{
            legacyId: source.id,
            order: order._id,
            submittedBy: supervisor._id,
            productionUnit: order.productionUnit,
            stage: source.stage,
            quantity: source.completedQuantity,
            updateDate: source.productionDate,
            ...(Number.isNaN(Date.parse(source.submittedAt || ""))
              ? {}
              : {
                  createdAt: new Date(source.submittedAt),
                  updatedAt: new Date(source.submittedAt),
                }),
            issueNote: source.issueNote || "",
            issueCategory: source.issueCategory || "",
            attachments: source.attachment
              ? [{
                  fileName: source.attachment.fileName,
                  mimeType: source.attachment.mimeType,
                  size: source.attachment.size,
                }]
              : [],
          }],
          { session },
        );
        target.currentOutput += source.completedQuantity;
        await order.save({ session });
        imported = true;
      });
      if (imported) report.productionUpdates.imported += 1;
    } finally {
      await session.endSession();
    }
  } catch (error) {
    report.productionUpdates.skipped += 1;
    report.invalid.push({ type: "production update", id: source?.id || "unknown", reason: error.message });
  }
}

async function importIssue(source, supervisor, merchandiser, report) {
  try {
    if (
      !source ||
      typeof source.id !== "string" ||
      typeof source.orderId !== "string" ||
      typeof source.originalNote !== "string" ||
      !source.originalNote.trim() ||
      !PRODUCTION_STAGES.includes(source.stage)
    ) {
      throw new Error("Production issue fields are invalid.");
    }
    if (await ProductionIssue.exists({ legacyId: source.id })) {
      report.issues.skipped += 1;
      return;
    }
    const order = await Order.findOne({ poNumber: source.orderId });
    if (!order) throw new Error("Production issue order was not found.");
    const reviewStatus = source.reviewStatus === "CLASSIFICATION_FAILED"
      ? "PENDING_REVIEW"
      : source.reviewStatus;
    if (!ISSUE_REVIEW_STATUSES.includes(reviewStatus)) {
      throw new Error("Production issue review status is invalid.");
    }
    const suggestedCategory = source.suggestedCategory || null;
    const confirmedCategory = source.confirmedCategory || null;
    const suggestedSeverity = source.suggestedSeverity || null;
    const confirmedSeverity = source.confirmedSeverity || null;
    if (
      (suggestedCategory && !ISSUE_CATEGORIES.includes(suggestedCategory)) ||
      (confirmedCategory && !ISSUE_CATEGORIES.includes(confirmedCategory)) ||
      (suggestedSeverity && !ISSUE_SEVERITIES.includes(suggestedSeverity)) ||
      (confirmedSeverity && !ISSUE_SEVERITIES.includes(confirmedSeverity))
    ) {
      throw new Error("Production issue classification values are invalid.");
    }
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const [issue] = await ProductionIssue.create(
          [{
            legacyId: source.id,
            order: order._id,
            submittedBy: supervisor._id,
            productionUnit: order.productionUnit,
            stage: source.stage,
            originalNote: source.originalNote,
            languageHint: source.languageHint || "auto",
            detectedLanguage: source.detectedLanguage || null,
            translatedNote: source.suggestedTranslation || null,
            suggestedCategory,
            confirmedCategory,
            suggestedSeverity,
            confirmedSeverity,
            aiExplanation: source.aiExplanation || null,
            confidence: source.confidence ?? null,
            needsReview: Boolean(source.needsReview),
            reviewStatus,
            reviewer: reviewStatus === "PENDING_REVIEW" ? null : merchandiser._id,
            reviewerNote: source.reviewerNote || "",
            reviewedAt: source.reviewedAt ? new Date(source.reviewedAt) : null,
            ...(Number.isNaN(Date.parse(source.createdAt || ""))
              ? {}
              : {
                  createdAt: new Date(source.createdAt),
                  updatedAt: new Date(source.createdAt),
                }),
            confirmedTranslation: source.confirmedTranslation || null,
            classificationError: source.classificationError || null,
            isDemo: false,
          }],
          { session },
        );
        const importedAudits = (source.auditHistory || [])
          .map((entry) => {
            const action = auditActions[entry.event];
            if (!action) return null;
            return {
              issue: issue._id,
              actor: ["CONFIRMED", "REJECTED", "CATEGORY_CHANGED", "SEVERITY_CHANGED", "TRANSLATION_EDITED"].includes(action)
                ? merchandiser._id
                : supervisor._id,
              action,
              newValue: entry,
              createdAt: Number.isNaN(Date.parse(entry.timestamp || ""))
                ? new Date()
                : new Date(entry.timestamp),
            };
          })
          .filter(Boolean);
        if (importedAudits.length) {
          await IssueAuditLog.create(importedAudits, { session, ordered: true });
        }
      });
      report.issues.imported += 1;
    } finally {
      await session.endSession();
    }
  } catch (error) {
    report.issues.skipped += 1;
    report.invalid.push({ type: "issue", id: source?.id || "unknown", reason: error.message });
  }
}

export async function importBrowserExport(filePath, uri = process.env.MONGODB_URI) {
  if (!filePath) throw new Error("Provide an explicit browser-export JSON file path.");
  await connectDatabase(uri);
  const bundle = JSON.parse(await readFile(filePath, "utf8"));
  const orderRows = rows(bundle, "orders", "orders");
  const updateRows = rows(bundle, "productionUpdates", "updates");
  const issueRows = rows(bundle, "issues", "issues");
  const report = {
    orders: { imported: 0, skipped: 0 },
    productionUpdates: { imported: 0, skipped: 0 },
    issues: { imported: 0, skipped: 0 },
    invalid: [],
  };
  for (const order of orderRows) await importOrder(order, report);
  const [supervisor, merchandiser] = await Promise.all([
    User.findOne({ email: "supervisor@stitchflow.demo" }),
    User.findOne({ email: "merchandiser@stitchflow.demo" }),
  ]);
  if (!supervisor || !merchandiser) {
    throw new Error("Run the demo seed before importing browser records.");
  }
  for (const update of updateRows) await importUpdate(update, supervisor, report);
  for (const issue of issueRows) await importIssue(issue, supervisor, merchandiser, report);
  return report;
}

if (process.argv[1] && process.argv[1].endsWith("import-browser-export.js")) {
  importBrowserExport(process.argv[2])
    .then((report) => {
      console.info("Browser record import complete:", JSON.stringify(report, null, 2));
    })
    .catch((error) => {
      console.error(error.message || "Browser record import failed.");
      process.exitCode = 1;
    })
    .finally(closeDatabase);
}

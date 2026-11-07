import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import BuyerOrganization from "../models/BuyerOrganization.js";
import IssueAuditLog from "../models/IssueAuditLog.js";
import Order from "../models/Order.js";
import ProductionIssue from "../models/ProductionIssue.js";
import ProductionUnit from "../models/ProductionUnit.js";
import ProductionUpdate from "../models/ProductionUpdate.js";
import User from "../models/User.js";
import {
  ISSUE_CATEGORIES,
  ISSUE_SEVERITIES,
  ORDER_STATUSES,
  PRODUCTION_STAGES,
  USER_ROLES,
} from "../models/constants.js";

const REQUIRED_TNA_MILESTONES = [
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

export class RepositoryError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "RepositoryError";
    this.status = status;
  }
}

function isObjectId(value) {
  return mongoose.isValidObjectId(value);
}

function asId(value) {
  return value == null ? null : String(value._id || value);
}

function validDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function getSizeBreakdownTotal(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new RepositoryError("Add at least one valid size quantity.");
  }
  const sizes = new Set();
  let total = 0;
  for (const row of rows) {
    if (
      !row ||
      typeof row.size !== "string" ||
      !row.size.trim() ||
      row.size.trim().length > 32 ||
      !Number.isInteger(row.quantity) ||
      row.quantity < 1
    ) {
      throw new RepositoryError("Each size requires a name and a positive whole-number quantity.");
    }
    const size = row.size.trim().toLocaleLowerCase();
    if (sizes.has(size)) {
      throw new RepositoryError("Size names must be unique within an order.");
    }
    sizes.add(size);
    total += row.quantity;
  }
  return total;
}

function serializeUser(user) {
  if (!user) return null;
  return {
    id: asId(user._id),
    email: user.email,
    name: user.name,
    role: user.role,
    isActive: user.isActive,
    buyerOrganizationId: asId(user.buyerOrganization),
    buyerOrganizationName: user.buyerOrganization?.name || null,
    productionUnitId: asId(user.productionUnit),
    productionUnitName: user.productionUnit?.name || null,
    ...(user.passwordHash ? { passwordHash: user.passwordHash } : {}),
  };
}

function serializeOrder(order) {
  const targets = new Map(
    order.productionTargets.map((target) => [target.stage, target]),
  );
  const currentTarget = targets.get(order.currentStage);
  const baselineStageOutputs = Object.fromEntries(
    order.productionTargets.map((target) => [target.stage, target.baselineOutput]),
  );
  return {
    id: order.poNumber,
    poNumber: order.poNumber,
    buyerOrganizationId: asId(order.buyerOrganization),
    buyer: order.buyerOrganization?.name || "",
    buyerCountry: order.buyerOrganization?.country || "",
    buyerReference: order.buyerReference,
    orderDate: order.orderDate,
    style: order.style,
    styleNumber: order.styleNumber,
    productDescription: order.productDescription,
    productCategory: order.productCategory,
    colour: order.colour,
    fabricDescription: order.fabricDescription,
    notes: order.notes,
    quantity: order.totalQuantity,
    totalQuantity: order.totalQuantity,
    sizeBreakdown: order.sizeQuantities.map((row) => ({ ...row.toObject() })),
    sizeQuantities: order.sizeQuantities.map((row) => ({ ...row.toObject() })),
    stage: order.currentStage,
    currentStage: order.currentStage,
    stageOutput: currentTarget?.currentOutput ?? 0,
    baselineStageOutput: currentTarget?.baselineOutput ?? 0,
    baselineStageOutputs,
    productionTarget: currentTarget?.targetQuantity ?? order.totalQuantity,
    separateProductionTarget:
      (currentTarget?.targetQuantity ?? order.totalQuantity) !== order.totalQuantity,
    productionTargets: order.productionTargets.map((target) => ({
      stage: target.stage,
      targetQuantity: target.targetQuantity,
      baselineOutput: target.baselineOutput,
      currentOutput: target.currentOutput,
    })),
    workflowStages: order.workflowStages.map((stage) => ({
      name: stage.name,
      target: stage.target,
    })),
    productionNotes: order.productionNotes,
    exFactoryDate: order.exFactoryDate,
    status: order.status,
    productionUnitId: asId(order.productionUnit),
    productionUnit: order.productionUnit?.name || "",
    milestones: order.tnaMilestones
      .slice()
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((milestone) => ({
        id: milestone.id,
        key: milestone.key,
        name: milestone.name,
        plannedDate: milestone.plannedDate,
        completed: milestone.isCompleted,
        completedDate: milestone.completedAt,
        required: milestone.required,
        updatedAt: milestone.updatedAt?.toISOString?.() || "",
      })),
    isDemo: order.isDemo,
    createdAt: order.createdAt?.toISOString?.() || "",
    updatedAt: order.updatedAt?.toISOString?.() || "",
  };
}

function serializeBuyerOrder(order, confirmedWarnings = []) {
  const workflow = order.workflowStages.map(({ name }, index) => {
    const currentIndex = order.workflowStages.findIndex(
      (item) => item.name === order.stage,
    );
    const earlier = index < currentIndex;
    const current = name === order.stage;
    const target = order.productionTargets.find((item) => item.stage === name);
    const percentage = earlier
      ? 100
      : current && target?.targetQuantity
        ? Math.min(
            Math.round((target.currentOutput / target.targetQuantity) * 100),
            100,
          )
        : 0;
    return {
      stage: name,
      status: earlier ? "COMPLETED" : current ? "IN_PROGRESS" : "PENDING",
      percentage,
      ...(current
        ? { output: target.currentOutput, target: target.targetQuantity }
        : {}),
    };
  });
  return {
    id: order.id,
    poNumber: order.poNumber,
    buyerOrganizationId: order.buyerOrganizationId,
    buyer: order.buyer,
    style: order.style,
    colour: order.colour,
    quantity: order.quantity,
    stage: order.stage,
    productionProgress:
      workflow.find((item) => item.status === "IN_PROGRESS")?.percentage || 0,
    isDemo: Boolean(order.isDemo),
    progressByStage: workflow,
    exFactoryDate: order.exFactoryDate,
    status: order.status,
    milestones: order.milestones,
    hasConfirmedWarnings: confirmedWarnings.length > 0,
    confirmedWarningCount: confirmedWarnings.length,
    confirmedWarnings,
  };
}

function serializeIssue(issue, audits = []) {
  if (!issue) return null;
  const order = issue.order;
  const user = issue.submittedBy;
  return {
    id: asId(issue._id),
    orderId: order?.poNumber || asId(issue.order),
    orderNumber: order?.poNumber || "",
    buyer: order?.buyerOrganization?.name || "",
    buyerOrganizationId: asId(order?.buyerOrganization),
    productionUnitId: asId(issue.productionUnit),
    productionUnit: issue.productionUnit?.name || "",
    stage: issue.stage,
    originalNote: issue.originalNote,
    languageHint: issue.languageHint,
    detectedLanguage: issue.detectedLanguage,
    suggestedTranslation: issue.translatedNote,
    suggestedCategory: issue.suggestedCategory,
    suggestedSeverity: issue.suggestedSeverity,
    confirmedTranslation: issue.confirmedTranslation,
    confirmedCategory: issue.confirmedCategory,
    confirmedSeverity: issue.confirmedSeverity,
    aiExplanation: issue.aiExplanation,
    confidence: issue.confidence,
    needsReview: issue.needsReview,
    reviewerNote: issue.reviewerNote,
    reviewStatus: issue.reviewStatus,
    classificationError: issue.classificationError,
    createdAt: issue.createdAt?.toISOString?.() || "",
    reviewedAt: issue.reviewedAt?.toISOString?.() || null,
    ownerUserId: asId(user || issue.submittedBy),
    auditHistory: audits.map((entry) => ({
      event: entry.action,
      timestamp: entry.createdAt?.toISOString?.() || "",
      reviewerNote: entry.newValue?.reviewerNote || "",
      ...entry.newValue,
    })),
  };
}

function serializeUpdate(update) {
  return {
    id: asId(update._id),
    orderId: update.order?.poNumber || asId(update.order),
    poNumber: update.order?.poNumber || "",
    stage: update.stage,
    productionDate: update.updateDate,
    completedQuantity: update.quantity,
    issueNote: update.issueNote,
    issueCategory: update.issueCategory,
    attachment: update.attachments?.[0]
      ? {
          fileName: update.attachments[0].fileName,
          mimeType: update.attachments[0].mimeType,
          size: update.attachments[0].size,
          previewAvailable: false,
        }
      : null,
    submittedAt: update.createdAt?.toISOString?.() || "",
    supervisor: update.submittedBy?.name || "",
    submittedById: asId(update.submittedBy),
    productionUnitId: asId(update.productionUnit),
  };
}

function scopeOrderQuery(user) {
  if (user.role === "BUYER") {
    return { buyerOrganization: user.buyerOrganizationId };
  }
  if (user.role === "SUPERVISOR") {
    return { productionUnit: user.productionUnitId };
  }
  return {};
}

function userScope(user) {
  if (user.role === "BUYER") return { "order.buyerOrganization": user.buyerOrganizationId };
  if (user.role === "SUPERVISOR") {
    return { productionUnit: user.productionUnitId };
  }
  return {};
}

export function createMongoRepository() {
  return {
    isPersistent: true,
    async findUserByEmail(email) {
      const user = await User.findOne({ email: email.toLowerCase() })
        .select("+passwordHash")
        .populate("buyerOrganization", "name country")
        .populate("productionUnit", "name");
      return serializeUser(user);
    },

    async findUserById(id) {
      if (!isObjectId(id)) return null;
      const user = await User.findById(id)
        .populate("buyerOrganization", "name country")
        .populate("productionUnit", "name");
      return serializeUser(user);
    },

    async listUsers() {
      const users = await User.find()
        .sort({ createdAt: 1, _id: 1 })
        .populate("buyerOrganization", "name country")
        .populate("productionUnit", "name");
      return users.map(serializeUser);
    },

    async listOrganizations() {
      return BuyerOrganization.find().sort({ name: 1 }).lean();
    },

    async listProductionUnits() {
      return ProductionUnit.find().sort({ name: 1 }).lean();
    },

    async findOrder(id, user) {
      const query = { ...scopeOrderQuery(user) };
      if (isObjectId(id)) {
        query._id = id;
      } else {
        query.poNumber = id;
      }
      const order = await Order.findOne(query)
        .populate("buyerOrganization", "name country")
        .populate("productionUnit", "name");
      if (!order) return null;
      const serialized = serializeOrder(order);
      if (user.role !== "BUYER") return serialized;
      const confirmedIssues = await ProductionIssue.find({
        order: order._id,
        reviewStatus: "CONFIRMED",
      }).sort({ createdAt: -1 });
      return serializeBuyerOrder(
        serialized,
        confirmedIssues.map((issue) => ({
          id: asId(issue._id),
          orderId: order.poNumber,
          orderNumber: order.poNumber,
          stage: issue.stage,
          translation: issue.confirmedTranslation,
          category: issue.confirmedCategory,
          severity: issue.confirmedSeverity,
          confirmedAt: issue.reviewedAt?.toISOString?.() || null,
        })),
      );
    },

    async listOrders(user) {
      const orders = await Order.find(scopeOrderQuery(user))
        .sort({ exFactoryDate: 1, poNumber: 1 })
        .populate("buyerOrganization", "name country")
        .populate("productionUnit", "name");
      const results = orders.map(serializeOrder);
      if (user.role !== "BUYER") return results;
      const orderIds = orders.map((order) => order._id);
      const issues = await ProductionIssue.find({
        order: { $in: orderIds },
        reviewStatus: "CONFIRMED",
      })
        .populate("order", "poNumber buyerOrganization")
        .populate("productionUnit", "name")
        .sort({ createdAt: -1 });
      const warningsByPo = new Map();
      for (const issue of issues) {
        const poNumber = issue.order.poNumber;
        const warnings = warningsByPo.get(poNumber) || [];
        warnings.push({
          id: asId(issue._id),
          orderId: poNumber,
          orderNumber: poNumber,
          stage: issue.stage,
          translation: issue.confirmedTranslation,
          category: issue.confirmedCategory,
          severity: issue.confirmedSeverity,
          confirmedAt: issue.reviewedAt?.toISOString?.() || null,
        });
        warningsByPo.set(poNumber, warnings);
      }
      return results.map((order) => {
        const warnings = warningsByPo.get(order.poNumber) || [];
        return serializeBuyerOrder(order, warnings);
      });
    },

    async findIssue(id) {
      if (!isObjectId(id)) return null;
      const issue = await ProductionIssue.findById(id)
        .populate({
          path: "order",
          populate: { path: "buyerOrganization", select: "name country" },
        })
        .populate("submittedBy", "name")
        .populate("productionUnit", "name");
      if (!issue) return null;
      const audits = await IssueAuditLog.find({ issue: issue._id }).sort({ createdAt: 1 });
      return serializeIssue(issue, audits);
    },

    async listIssues(user) {
      let query = userScope(user);
      if (user.role === "BUYER") {
        const scopedOrders = await Order.find({
          buyerOrganization: user.buyerOrganizationId,
        }).distinct("_id");
        query = {
          order: { $in: scopedOrders },
          reviewStatus: "CONFIRMED",
        };
      }
      const issues = await ProductionIssue.find(query)
        .populate({
          path: "order",
          select: user.role === "BUYER" ? "poNumber buyerOrganization" : "poNumber buyerOrganization",
          populate: { path: "buyerOrganization", select: "name country" },
          ...(user.role === "BUYER"
            ? { match: { buyerOrganization: user.buyerOrganizationId } }
            : {}),
        })
        .populate("submittedBy", "name")
        .populate("productionUnit", "name")
        .sort({ createdAt: -1 });
      const filtered = issues.filter((issue) => issue.order);
      const auditIds = filtered.map((issue) => issue._id);
      const audits = await IssueAuditLog.find({ issue: { $in: auditIds } })
        .sort({ createdAt: 1 })
        .lean();
      const byIssue = new Map();
      for (const audit of audits) {
        const key = asId(audit.issue);
        const entries = byIssue.get(key) || [];
        entries.push(audit);
        byIssue.set(key, entries);
      }
      if (user.role === "BUYER") {
        return filtered.map((issue) => ({
          id: asId(issue._id),
          orderId: issue.order.poNumber,
          orderNumber: issue.order.poNumber,
          stage: issue.stage,
          translation: issue.confirmedTranslation,
          category: issue.confirmedCategory,
          severity: issue.confirmedSeverity,
          confirmedAt: issue.reviewedAt?.toISOString?.() || null,
        }));
      }
      return filtered.map((issue) => serializeIssue(issue, byIssue.get(asId(issue._id)) || []));
    },

    async createUser(input) {
      const buyerOrganization = input.buyerOrganizationId || null;
      const productionUnit = input.productionUnitId || null;
      if (buyerOrganization && !isObjectId(buyerOrganization)) {
        throw new RepositoryError("Choose a valid buyer organization.");
      }
      if (productionUnit && !isObjectId(productionUnit)) {
        throw new RepositoryError("Choose a valid production unit.");
      }
      const [organization, unit] = await Promise.all([
        buyerOrganization ? BuyerOrganization.exists({ _id: buyerOrganization }) : null,
        productionUnit ? ProductionUnit.exists({ _id: productionUnit }) : null,
      ]);
      if ((buyerOrganization && !organization) || (productionUnit && !unit)) {
        throw new RepositoryError("Choose an existing organization and production unit.");
      }
      const passwordHash = input.passwordHash || await bcrypt.hash(input.password, 10);
      const user = await User.create({
        name: input.name,
        email: input.email,
        role: input.role,
        isActive: input.isActive ?? true,
        passwordHash,
        buyerOrganization,
        productionUnit,
      });
      return serializeUser(
        await User.findById(user._id)
          .populate("buyerOrganization", "name country")
          .populate("productionUnit", "name"),
      );
    },

    async updateUser(id, input) {
      if (!isObjectId(id)) throw new RepositoryError("Choose a valid user.");
      const existing = await User.findById(id);
      if (!existing) return null;
      const nextRole = input.role ?? existing.role;
      const nextActive = input.isActive ?? existing.isActive;
      if (
        existing.role === "ADMIN" &&
        existing.isActive &&
        (nextRole !== "ADMIN" || !nextActive) &&
        (await User.countDocuments({ role: "ADMIN", isActive: true })) <= 1
      ) {
        throw new RepositoryError(
          "The last active admin account cannot be disabled or reassigned.",
          409,
        );
      }
      const updates = { ...input };
      if (updates.password) {
        updates.passwordHash = await bcrypt.hash(updates.password, 10);
        delete updates.password;
      }
      if (Object.hasOwn(updates, "buyerOrganizationId")) {
        if (updates.buyerOrganizationId && !isObjectId(updates.buyerOrganizationId)) {
          throw new RepositoryError("Choose a valid buyer organization.");
        }
        updates.buyerOrganization = updates.buyerOrganizationId || null;
        delete updates.buyerOrganizationId;
      }
      if (Object.hasOwn(updates, "productionUnitId")) {
        if (updates.productionUnitId && !isObjectId(updates.productionUnitId)) {
          throw new RepositoryError("Choose a valid production unit.");
        }
        updates.productionUnit = updates.productionUnitId || null;
        delete updates.productionUnitId;
      }
      const user = await User.findByIdAndUpdate(id, updates, {
        returnDocument: "after",
        runValidators: true,
      })
        .populate("buyerOrganization", "name country")
        .populate("productionUnit", "name");
      return serializeUser(user);
    },

    async saveOrder(input, existingPoNumber = null) {
      if (!input || typeof input !== "object" || Array.isArray(input)) {
        throw new RepositoryError("Provide valid order details.");
      }
      if (existingPoNumber) {
        const current = await Order.findOne({ poNumber: existingPoNumber });
        if (!current) return null;
        const oldQuantity = current.totalQuantity;
        const previousOrderDate = current.orderDate;
        const previousExFactoryDate = current.exFactoryDate;
        const normalizedInput = { ...input };
        if (input.poNumber !== undefined) current.poNumber = input.poNumber;
        for (const key of [
          "buyerReference",
          "orderDate",
          "style",
          "styleNumber",
          "productDescription",
          "productCategory",
          "colour",
          "fabricDescription",
          "notes",
          "productionNotes",
          "exFactoryDate",
          "status",
        ]) {
          if (input[key] !== undefined) current[key] = input[key];
        }
        const sizeRows = input.sizeQuantities ?? input.sizeBreakdown;
        const requestedTotal = input.totalQuantity ?? input.quantity;
        const unchangedEmptyBreakdown =
          Array.isArray(sizeRows) &&
          sizeRows.length === 0 &&
          current.sizeQuantities.length === 0 &&
          (requestedTotal === undefined || requestedTotal === oldQuantity);
        const sizeTotal =
          sizeRows === undefined || unchangedEmptyBreakdown
            ? undefined
            : getSizeBreakdownTotal(sizeRows);
        if (requestedTotal !== undefined && sizeTotal !== undefined && requestedTotal !== sizeTotal) {
          throw new RepositoryError("Size quantities must match the order total.");
        }
        const total = requestedTotal ?? sizeTotal;
        if (total !== undefined) {
          current.totalQuantity = total;
          current.workflowStages = current.workflowStages.map((stage) => ({
            ...stage.toObject(),
            target: stage.target === oldQuantity ? total : stage.target,
          }));
          current.productionTargets = current.productionTargets.map((target) => ({
            ...target.toObject(),
            targetQuantity:
              target.targetQuantity === oldQuantity
                ? total
                : target.targetQuantity,
          }));
          const adjustDefaultTargets = (stages, targetKey) =>
            stages?.map((stage) => {
              if (
                stage &&
                typeof stage === "object" &&
                stage[targetKey] === oldQuantity
              ) {
                return { ...stage, [targetKey]: total };
              }
              return stage;
            });
          normalizedInput.workflowStages = adjustDefaultTargets(
            input.workflowStages,
            "target",
          ) || input.workflowStages;
          normalizedInput.productionTargets = adjustDefaultTargets(
            input.productionTargets,
            "targetQuantity",
          ) || input.productionTargets;
        }
        if (sizeRows !== undefined) current.sizeQuantities = sizeRows;
        if (input.stage !== undefined || input.currentStage !== undefined) {
          current.currentStage = input.currentStage ?? input.stage;
        }
        if (input.productionUnitId !== undefined) {
          if (!isObjectId(input.productionUnitId)) {
            throw new RepositoryError("Choose a valid production unit.");
          }
          if (!(await ProductionUnit.exists({ _id: input.productionUnitId }))) {
            throw new RepositoryError("Choose an existing production unit.");
          }
          current.productionUnit = input.productionUnitId;
        } else if (input.productionUnit !== undefined) {
          const unit = await ProductionUnit.findOne({ name: input.productionUnit });
          if (!unit) throw new RepositoryError("Choose an existing production unit.");
          current.productionUnit = unit._id;
        }
        if (input.buyerOrganizationId !== undefined) {
          if (!isObjectId(input.buyerOrganizationId)) {
            throw new RepositoryError("Choose a valid buyer organization.");
          }
          if (!(await BuyerOrganization.exists({ _id: input.buyerOrganizationId }))) {
            throw new RepositoryError("Choose an existing buyer organization.");
          }
          current.buyerOrganization = input.buyerOrganizationId;
        } else if (input.buyer !== undefined) {
          const organization = await BuyerOrganization.findOne({ name: input.buyer });
          if (!organization) throw new RepositoryError("Choose an existing buyer organization.");
          current.buyerOrganization = organization._id;
        }
        if (input.workflowStages !== undefined || input.productionTargets !== undefined) {
          current.workflowStages = normalizeWorkflow(
            normalizedInput,
            current.totalQuantity,
            current.currentStage,
            current.workflowStages,
          );
          const removedStagesWithOutput = current.productionTargets.filter(
            (target) =>
              target.currentOutput > 0 &&
              !current.workflowStages.some((stage) => stage.name === target.stage),
          );
          if (removedStagesWithOutput.length > 0) {
            throw new RepositoryError(
              "Production stages with recorded output cannot be removed.",
              409,
            );
          }
          current.productionTargets = mergeTargets(
            current.productionTargets,
            current.workflowStages,
            current.currentStage,
            current.totalQuantity,
            normalizedInput,
          );
        }
        if (input.milestones !== undefined || input.tnaMilestones !== undefined) {
          current.tnaMilestones = normalizeMilestones(
            input.tnaMilestones ?? input.milestones,
            current.exFactoryDate,
            current.orderDate,
          );
        } else if (
          current.orderDate !== previousOrderDate ||
          current.exFactoryDate !== previousExFactoryDate
        ) {
          current.tnaMilestones = normalizeMilestones(
            current.tnaMilestones.map((milestone) => milestone.toObject()),
            current.exFactoryDate,
            current.orderDate,
          );
        }
        validateOrderDates(current.orderDate, current.exFactoryDate);
        if (!current.workflowStages.some((stage) => stage.name === current.currentStage)) {
          throw new RepositoryError("The current stage must be included in the order workflow.");
        }
        await current.save();
        const order = await Order.findById(current._id)
          .populate("buyerOrganization", "name country")
          .populate("productionUnit", "name");
        return serializeOrder(order);
      }

      const [organization, unit] = await Promise.all([
        resolveOrganization(input),
        resolveProductionUnit(input),
      ]);
      const sizeRows = input.sizeQuantities ?? input.sizeBreakdown;
      const sizeTotal = getSizeBreakdownTotal(sizeRows);
      const requestedTotal = input.totalQuantity ?? input.quantity;
      if (requestedTotal !== undefined && requestedTotal !== sizeTotal) {
        throw new RepositoryError("Size quantities must match the order total.");
      }
      const quantity = requestedTotal ?? sizeTotal;
      const stage = input.currentStage ?? input.stage;
      validateOrderDates(input.orderDate || "", input.exFactoryDate);
      const workflowStages = normalizeWorkflow(input, quantity, stage);
      const productionTargets = mergeTargets(
        [],
        workflowStages,
        stage,
        quantity,
        input,
      );
      const order = await Order.create({
        poNumber: input.poNumber,
        buyerOrganization: organization._id,
        productionUnit: unit._id,
        buyerReference: input.buyerReference || "",
        orderDate: input.orderDate || "",
        style: input.style,
        styleNumber: input.styleNumber || "",
        productDescription: input.productDescription || "",
        productCategory: input.productCategory || "",
        colour: input.colour,
        fabricDescription: input.fabricDescription || "",
        notes: input.notes || "",
        productionNotes: input.productionNotes || "",
        totalQuantity: quantity,
        sizeQuantities: sizeRows,
        currentStage: stage,
        status: input.status,
        exFactoryDate: input.exFactoryDate,
        workflowStages,
        productionTargets,
        tnaMilestones: normalizeMilestones(
          input.tnaMilestones ?? input.milestones ?? [],
          input.exFactoryDate,
          input.orderDate || "",
        ),
        isDemo: false,
      });
      return serializeOrder(
        await Order.findById(order._id)
          .populate("buyerOrganization", "name country")
          .populate("productionUnit", "name"),
      );
    },

    async createIssue(input, user) {
      const order = await Order.findOne({ poNumber: input.orderId });
      if (!order) return null;
      if (
        user.role === "SUPERVISOR" &&
        String(order.productionUnit) !== user.productionUnitId
      ) {
        return null;
      }
      if (!order.workflowStages.some((stage) => stage.name === input.stage)) {
        throw new RepositoryError("Choose a stage in this order's workflow.");
      }
      if (input.clientRequestId) {
        const existing = await ProductionIssue.findOne({
          clientRequestId: input.clientRequestId,
        });
        if (existing) {
          const sameRequest =
            String(existing.order) === String(order._id) &&
            String(existing.submittedBy) === user.id &&
            existing.stage === input.stage &&
            existing.originalNote === input.originalNote;
          if (!sameRequest) {
            throw new RepositoryError("This issue identifier is already in use.", 409);
          }
          return {
            id: asId(existing._id),
            reviewStatus: existing.reviewStatus,
            created: false,
          };
        }
      }
      const duplicate = await ProductionIssue.findOne({
        order: order._id,
        submittedBy: user.id,
        stage: input.stage,
        originalNote: input.originalNote,
        ...(input.clientRequestId
          ? { clientRequestId: input.clientRequestId }
          : { reviewStatus: "PENDING_REVIEW" }),
      });
      if (duplicate) {
        return {
          id: asId(duplicate._id),
          reviewStatus: duplicate.reviewStatus,
          created: false,
        };
      }
      const session = await mongoose.startSession();
      try {
        let issue;
        await session.withTransaction(async () => {
          [issue] = await ProductionIssue.create(
            [
              {
                order: order._id,
                submittedBy: user.id,
                productionUnit: order.productionUnit,
                    ...(input.clientRequestId
                      ? { clientRequestId: input.clientRequestId }
                      : {}),
                stage: input.stage,
                originalNote: input.originalNote,
                languageHint: input.languageHint || "auto",
                reviewStatus: "PENDING_REVIEW",
              },
            ],
            { session },
          );
          await IssueAuditLog.create(
            [{ issue: issue._id, actor: user.id, action: "SUBMITTED" }],
            { session },
          );
        });
        return { id: asId(issue._id), reviewStatus: issue.reviewStatus, created: true };
      } finally {
        await session.endSession();
      }
    },

    async saveClassification(issueId, result, actorId) {
      if (!isObjectId(issueId)) return null;
      const session = await mongoose.startSession();
      try {
        let issue;
        await session.withTransaction(async () => {
          const before = await ProductionIssue.findOne({
            _id: issueId,
            reviewStatus: "PENDING_REVIEW",
          }).session(session);
          if (!before) throw new RepositoryError("Issue cannot be classified.", 409);
          issue = await ProductionIssue.findOneAndUpdate(
            { _id: issueId, reviewStatus: "PENDING_REVIEW" },
            {
              $set: {
                detectedLanguage: result.detectedLanguage,
                translatedNote: result.translatedNote,
                suggestedCategory: result.category,
                suggestedSeverity: result.severity,
                aiExplanation: result.explanation,
                confidence: result.confidence,
                needsReview: result.needsReview,
                classificationError: null,
              },
            },
            { returnDocument: "after", session },
          );
          if (!issue) throw new RepositoryError("Issue cannot be classified.", 409);
          await IssueAuditLog.create(
            [{
              issue: issue._id,
              actor: actorId,
              action:
                before.detectedLanguage || before.classificationError
                  ? "CLASSIFICATION_RETRIED"
                  : "AI_CLASSIFICATION_COMPLETED",
              newValue: {
                category: result.category,
                severity: result.severity,
                detectedLanguage: result.detectedLanguage,
              },
            }],
            { session },
          );
          if (before.detectedLanguage || before.classificationError) {
            await IssueAuditLog.create(
              [{
                issue: issue._id,
                actor: actorId,
                action: "AI_CLASSIFICATION_COMPLETED",
                newValue: {
                  category: result.category,
                  severity: result.severity,
                  detectedLanguage: result.detectedLanguage,
                },
              }],
              { session },
            );
          }
        });
        return this.findIssue(asId(issue._id));
      } finally {
        await session.endSession();
      }
    },

    async saveClassificationFailure(issueId, message, actorId) {
      if (!isObjectId(issueId)) return;
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          const issue = await ProductionIssue.findOneAndUpdate(
            { _id: issueId, reviewStatus: "PENDING_REVIEW" },
            { $set: { classificationError: message } },
            { returnDocument: "after", session },
          );
          if (issue) {
            await IssueAuditLog.create(
              [{
                issue: issue._id,
                actor: actorId,
                action: "AI_CLASSIFICATION_FAILED",
                newValue: { message },
              }],
              { session },
            );
          }
        });
      } finally {
        await session.endSession();
      }
    },

    async reviewIssue(id, input, actor) {
      if (!isObjectId(id)) return null;
      const session = await mongoose.startSession();
      try {
        let issue;
        await session.withTransaction(async () => {
          issue = await ProductionIssue.findOne({
            _id: id,
            reviewStatus: "PENDING_REVIEW",
          }).session(session);
          if (!issue) throw new RepositoryError("Only pending issues can be reviewed.", 409);
          const previousValue = {
            reviewStatus: issue.reviewStatus,
            translation: issue.confirmedTranslation,
            category: issue.confirmedCategory,
            severity: issue.confirmedSeverity,
          };
          const confirmed = input.decision === "CONFIRMED";
          issue.reviewStatus = confirmed ? "CONFIRMED" : "REJECTED";
          issue.confirmedTranslation = confirmed ? input.translation.trim() : null;
          issue.confirmedCategory = confirmed ? input.category : null;
          issue.confirmedSeverity = confirmed ? input.severity : null;
          issue.reviewer = actor.id;
          issue.reviewerNote = input.reviewerNote || "";
          issue.reviewedAt = new Date();
          await issue.save({ session });
          const auditRecords = [];
          if (confirmed && issue.confirmedTranslation !== previousValue.translation) {
            auditRecords.push({
              issue: issue._id,
              actor: actor.id,
              action: "TRANSLATION_EDITED",
              previousValue: { translation: previousValue.translation },
              newValue: { translation: issue.confirmedTranslation },
            });
          }
          if (confirmed && issue.confirmedCategory !== issue.suggestedCategory) {
            auditRecords.push({
              issue: issue._id,
              actor: actor.id,
              action: "CATEGORY_CHANGED",
              previousValue: { category: issue.suggestedCategory },
              newValue: { category: issue.confirmedCategory },
            });
          }
          if (confirmed && issue.confirmedSeverity !== issue.suggestedSeverity) {
            auditRecords.push({
              issue: issue._id,
              actor: actor.id,
              action: "SEVERITY_CHANGED",
              previousValue: { severity: issue.suggestedSeverity },
              newValue: { severity: issue.confirmedSeverity },
            });
          }
          auditRecords.push({
              issue: issue._id,
              actor: actor.id,
              action: confirmed ? "CONFIRMED" : "REJECTED",
              previousValue,
              newValue: {
                reviewStatus: issue.reviewStatus,
                translation: issue.confirmedTranslation,
                category: issue.confirmedCategory,
                severity: issue.confirmedSeverity,
                reviewerNote: issue.reviewerNote,
              },
            });
          await IssueAuditLog.create(auditRecords, { session, ordered: true });
        });
        return this.findIssue(asId(issue._id));
      } finally {
        await session.endSession();
      }
    },

    async listProductionUpdates(user) {
      const query = user.role === "SUPERVISOR"
        ? { productionUnit: user.productionUnitId }
        : {};
      const updates = await ProductionUpdate.find(query)
        .populate("order", "poNumber")
        .populate("submittedBy", "name")
        .sort({ updateDate: -1, createdAt: -1 });
      return updates.map(serializeUpdate);
    },

    async createProductionUpdate(input, user) {
      if (!validDate(input.productionDate)) {
        throw new RepositoryError("Choose a valid production date.");
      }
      if (!Number.isInteger(input.completedQuantity) || input.completedQuantity <= 0) {
        throw new RepositoryError("Enter a positive whole-number quantity.");
      }
      const session = await mongoose.startSession();
      let created;
      try {
        await session.withTransaction(async () => {
          const order = await Order.findOne({ poNumber: input.orderId }).session(session);
          if (!order) throw new RepositoryError("Order not found.", 404);
          if (
            user.role !== "SUPERVISOR" ||
            String(order.productionUnit) !== user.productionUnitId
          ) {
            throw new RepositoryError("Order not found.", 404);
          }
          if (!order.workflowStages.some((stage) => stage.name === input.stage)) {
            throw new RepositoryError("Choose a stage in this order's workflow.");
          }
          const target = order.productionTargets.find((item) => item.stage === input.stage);
          if (!target || target.currentOutput + input.completedQuantity > target.targetQuantity) {
            throw new RepositoryError("Quantity cannot exceed the remaining target for this stage.");
          }
          [created] = await ProductionUpdate.create(
            [{
              order: order._id,
              submittedBy: user.id,
              productionUnit: order.productionUnit,
              stage: input.stage,
              quantity: input.completedQuantity,
              updateDate: input.productionDate,
              issueNote: input.issueNote || "",
              issueCategory: input.issueCategory || "",
              attachments: input.attachment
                ? [{
                    fileName: input.attachment.fileName,
                    mimeType: input.attachment.mimeType,
                    size: input.attachment.size,
                  }]
                : [],
            }],
            { session },
          );
          target.currentOutput += input.completedQuantity;
          await order.save({ session });
        });
        return serializeUpdate(
          await ProductionUpdate.findById(created._id)
            .populate("order", "poNumber")
            .populate("submittedBy", "name"),
        );
      } finally {
        await session.endSession();
      }
    },

    async updateProductionUpdate(id, input, user) {
      return this._mutateProductionUpdate(id, input, user, "update");
    },

    async deleteProductionUpdate(id, user) {
      return this._mutateProductionUpdate(id, null, user, "delete");
    },

    async _mutateProductionUpdate(id, input, user, action) {
      if (!isObjectId(id)) return null;
      const session = await mongoose.startSession();
      let result;
      try {
        await session.withTransaction(async () => {
          const update = await ProductionUpdate.findById(id).session(session);
          if (!update) throw new RepositoryError("Production update not found.", 404);
          if (
            user.role !== "SUPERVISOR" ||
            String(update.submittedBy) !== user.id ||
            String(update.productionUnit) !== user.productionUnitId
          ) {
            throw new RepositoryError("Production update not found.", 404);
          }
          const order = await Order.findById(update.order).session(session);
          if (!order) throw new RepositoryError("Order not found.", 404);
          const originalTarget = order.productionTargets.find(
            (item) => item.stage === update.stage,
          );
          if (!originalTarget) throw new RepositoryError("Production stage target not found.", 409);
          originalTarget.currentOutput -= update.quantity;
          if (action === "delete") {
            await update.deleteOne({ session });
            result = { deleted: true };
            await order.save({ session });
            return;
          }
          if (
            !validDate(input.productionDate) ||
            !Number.isInteger(input.completedQuantity) ||
            input.completedQuantity <= 0
          ) {
            throw new RepositoryError("Enter a valid date and positive whole-number quantity.");
          }
          const target = order.productionTargets.find((item) => item.stage === input.stage);
          if (!target || target.currentOutput + input.completedQuantity > target.targetQuantity) {
            throw new RepositoryError("Quantity cannot exceed the remaining target for this stage.");
          }
          update.stage = input.stage;
          update.quantity = input.completedQuantity;
          update.updateDate = input.productionDate;
          update.issueNote = input.issueNote || "";
          update.issueCategory = input.issueCategory || "";
          update.attachments = input.attachment
            ? [{
                fileName: input.attachment.fileName,
                mimeType: input.attachment.mimeType,
                size: input.attachment.size,
              }]
            : [];
          target.currentOutput += input.completedQuantity;
          await update.save({ session });
          await order.save({ session });
          result = update;
        });
        if (result?.deleted) return { deleted: true };
        return result
          ? serializeUpdate(
              await ProductionUpdate.findById(result._id)
                .populate("order", "poNumber")
                .populate("submittedBy", "name"),
            )
          : null;
      } finally {
        await session.endSession();
      }
    },
  };
}

async function resolveOrganization(input) {
  if (input.buyerOrganizationId !== undefined) {
    if (!isObjectId(input.buyerOrganizationId)) {
      throw new RepositoryError("Choose a valid buyer organization.");
    }
    const organization = await BuyerOrganization.findById(input.buyerOrganizationId);
    if (!organization) throw new RepositoryError("Choose an existing buyer organization.");
    return organization;
  }
  if (input.buyer) {
    const organization = await BuyerOrganization.findOne({ name: input.buyer });
    if (organization) return organization;
  }
  throw new RepositoryError("Choose an existing buyer organization.");
}

async function resolveProductionUnit(input) {
  if (input.productionUnitId !== undefined) {
    if (!isObjectId(input.productionUnitId)) {
      throw new RepositoryError("Choose a valid production unit.");
    }
    const unit = await ProductionUnit.findById(input.productionUnitId);
    if (!unit) throw new RepositoryError("Choose an existing production unit.");
    return unit;
  }
  if (input.productionUnit) {
    const unit = await ProductionUnit.findOne({ name: input.productionUnit });
    if (unit) return unit;
  }
  throw new RepositoryError("Choose an existing production unit.");
}

function normalizeWorkflow(input, quantity, currentStage, existing = []) {
  const stages = input.workflowStages ?? input.productionTargets ?? [currentStage];
  if (
    !Array.isArray(stages) ||
    stages.length === 0 ||
    stages.length > PRODUCTION_STAGES.length
  ) {
    throw new RepositoryError("Provide a valid production workflow.");
  }
  const normalized = stages.map((entry) => {
    const name = typeof entry === "string" ? entry : entry.name || entry.stage;
    if (!PRODUCTION_STAGES.includes(name)) {
      throw new RepositoryError("Choose a valid production stage.");
    }
    const previous = existing.find((stage) => stage.name === name);
    const suppliedTarget = typeof entry === "string"
      ? undefined
      : entry.target ?? entry.targetQuantity;
    const currentStageTarget =
      name === currentStage && input.productionTarget !== undefined
        ? input.productionTarget
        : undefined;
    const target =
      currentStageTarget ?? suppliedTarget ?? previous?.target ?? quantity;
    if (!Number.isInteger(target) || target <= 0) {
      throw new RepositoryError("Stage targets must be positive whole numbers.");
    }
    return { name, target };
  });
  if (
    new Set(normalized.map((stage) => stage.name)).size !== normalized.length
  ) {
    throw new RepositoryError("A production workflow cannot repeat a stage.");
  }
  if (
    currentStage &&
    !normalized.some((stage) => stage.name === currentStage)
  ) {
    throw new RepositoryError("The current stage must be included in the order workflow.");
  }
  return normalized;
}

function mergeTargets(existing, workflow, currentStage, total, input) {
  const incoming = input.productionTargets ?? [];
  if (!Array.isArray(incoming)) {
    throw new RepositoryError("Provide valid production stage targets.");
  }
  const incomingStages = incoming.map((item) => item?.stage);
  if (new Set(incomingStages).size !== incomingStages.length) {
    throw new RepositoryError("A production stage can have only one target.");
  }
  if (
    incomingStages.some(
      (stage) => !workflow.some((workflowStage) => workflowStage.name === stage),
    )
  ) {
    throw new RepositoryError("Targets can only be set for stages in the workflow.");
  }
  return workflow.map(({ name: stage, target }) => {
    const previous = existing.find((item) => item.stage === stage);
    const explicit = incoming.find((item) => item.stage === stage);
    const initialOutput = previous?.baselineOutput ?? 0;
    const currentOutput = previous?.currentOutput ?? initialOutput;
    const targetQuantity = explicit?.targetQuantity ?? target ?? total;
    if (
      !Number.isInteger(targetQuantity) ||
      targetQuantity <= 0 ||
      !Number.isInteger(initialOutput) ||
      !Number.isInteger(currentOutput) ||
      initialOutput < 0 ||
      currentOutput < initialOutput ||
      currentOutput > targetQuantity
    ) {
      throw new RepositoryError("A stage target cannot be lower than its recorded output.");
    }
    return {
      stage,
      targetQuantity,
      baselineOutput: initialOutput,
      currentOutput,
    };
  });
}

function validateOrderDates(orderDate, exFactoryDate) {
  if (!validDate(exFactoryDate)) {
    throw new RepositoryError("Choose a valid ex-factory date.");
  }
  if (orderDate && !validDate(orderDate)) {
    throw new RepositoryError("Choose a valid order date.");
  }
  if (orderDate && orderDate > exFactoryDate) {
    throw new RepositoryError("Ex-factory date cannot be before the order date.");
  }
}

function normalizeMilestones(milestones, exFactoryDate, orderDate) {
  if (
    !Array.isArray(milestones) ||
    milestones.length === 0 ||
    milestones.length > 50
  ) {
    throw new RepositoryError("Provide a valid TNA milestone list.");
  }
  const normalized = milestones.map((milestone, index) => {
    if (
      !milestone ||
      typeof milestone !== "object" ||
      typeof milestone.name !== "string" ||
      !milestone.name.trim()
    ) {
      throw new RepositoryError("Provide valid TNA milestone details.");
    }
    const plannedDate = milestone.plannedDate || "";
    const completedAt =
      milestone.completedAt ?? milestone.completedDate ?? "";
    const isCompleted = milestone.isCompleted ?? milestone.completed ?? false;
    if (
      (plannedDate && !validDate(plannedDate)) ||
      (!plannedDate && milestone.required) ||
      (completedAt && !validDate(completedAt)) ||
      typeof isCompleted !== "boolean" ||
      (isCompleted && !validDate(completedAt)) ||
      (completedAt && plannedDate && completedAt < plannedDate)
    ) {
      throw new RepositoryError("Provide valid TNA milestone dates.");
    }
    if (
      plannedDate &&
      ((milestone.key !== "ex-factory" &&
        milestone.name !== "Ex-Factory" &&
        plannedDate > exFactoryDate) ||
        (milestone.key !== "ex-factory" &&
          milestone.name !== "Ex-Factory" &&
          orderDate &&
          plannedDate < orderDate))
    ) {
      throw new RepositoryError("TNA dates must fall within the order schedule.");
    }
    return {
      id: milestone.id || `milestone-${index + 1}`,
      key: milestone.key || "",
      name: milestone.name,
      plannedDate:
        milestone.key === "ex-factory" || milestone.name === "Ex-Factory"
          ? exFactoryDate
          : plannedDate,
      completedAt,
      isCompleted,
      sortOrder: milestone.sortOrder ?? index,
      required: Boolean(milestone.required),
      updatedAt: milestone.updatedAt ? new Date(milestone.updatedAt) : new Date(),
    };
  });
  const ids = normalized.map((milestone) => milestone.id);
  if (new Set(ids).size !== ids.length) {
    throw new RepositoryError("TNA milestone IDs must be unique within an order.");
  }
  for (const [key, name] of REQUIRED_TNA_MILESTONES) {
    const milestone = normalized.find((item) => item.key === key || item.name === name);
    if (!milestone?.plannedDate) {
      throw new RepositoryError(`Provide a planned date for ${name}.`);
    }
  }
  return normalized;
}

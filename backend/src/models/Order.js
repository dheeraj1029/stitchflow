import mongoose from "mongoose";
import {
  ORDER_STATUSES,
  PRODUCTION_STAGES,
} from "./constants.js";

const sizeQuantitySchema = new mongoose.Schema(
  {
    size: { type: String, required: true, trim: true, maxlength: 32 },
    quantity: { type: Number, required: true, min: 1, validate: Number.isInteger },
  },
  { _id: false, strict: "throw" },
);

const productionTargetSchema = new mongoose.Schema(
  {
    stage: { type: String, enum: PRODUCTION_STAGES, required: true },
    targetQuantity: { type: Number, required: true, min: 1, validate: Number.isInteger },
    baselineOutput: { type: Number, required: true, min: 0, validate: Number.isInteger, default: 0 },
    currentOutput: { type: Number, required: true, min: 0, validate: Number.isInteger, default: 0 },
  },
  { _id: false, strict: "throw" },
);

const workflowStageSchema = new mongoose.Schema(
  {
    name: { type: String, enum: PRODUCTION_STAGES, required: true },
    target: { type: Number, required: true, min: 1, validate: Number.isInteger },
  },
  { _id: false, strict: "throw" },
);

const tnaMilestoneSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, trim: true, maxlength: 100 },
    key: { type: String, trim: true, maxlength: 100, default: "" },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    plannedDate: {
      type: String,
      default: "",
      validate: (value) => value === "" || /^\d{4}-\d{2}-\d{2}$/.test(value),
    },
    completedAt: { type: String, default: "" },
    isCompleted: { type: Boolean, default: false },
    sortOrder: { type: Number, required: true, min: 0, validate: Number.isInteger },
    required: { type: Boolean, default: false },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: false, strict: "throw" },
);

const orderSchema = new mongoose.Schema(
  {
    poNumber: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
      unique: true,
      index: true,
    },
    buyerOrganization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BuyerOrganization",
      required: true,
      index: true,
    },
    productionUnit: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductionUnit",
      required: true,
      index: true,
    },
    buyerReference: { type: String, trim: true, maxlength: 160, default: "" },
    orderDate: { type: String, match: /^\d{4}-\d{2}-\d{2}$/, default: "" },
    style: { type: String, required: true, trim: true, maxlength: 200 },
    styleNumber: { type: String, trim: true, maxlength: 100, default: "" },
    productDescription: { type: String, trim: true, maxlength: 1000, default: "" },
    productCategory: { type: String, trim: true, maxlength: 120, default: "" },
    colour: { type: String, required: true, trim: true, maxlength: 100 },
    fabricDescription: { type: String, trim: true, maxlength: 1000, default: "" },
    notes: { type: String, maxlength: 4000, default: "" },
    productionNotes: { type: String, maxlength: 4000, default: "" },
    totalQuantity: { type: Number, required: true, min: 1, validate: Number.isInteger },
    sizeQuantities: { type: [sizeQuantitySchema], default: [] },
    currentStage: { type: String, enum: PRODUCTION_STAGES, required: true },
    status: { type: String, enum: ORDER_STATUSES, required: true, default: "pending" },
    exFactoryDate: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    productionTargets: { type: [productionTargetSchema], default: [] },
    workflowStages: { type: [workflowStageSchema], default: [] },
    tnaMilestones: { type: [tnaMilestoneSchema], default: [] },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true, strict: "throw" },
);

orderSchema.index({ buyerOrganization: 1, exFactoryDate: 1 });
orderSchema.index({ productionUnit: 1, exFactoryDate: 1 });
orderSchema.index({ buyerOrganization: 1, status: 1, exFactoryDate: 1 });
orderSchema.pre("validate", function validateOrderData() {
  const sizeNames = this.sizeQuantities.map((item) => item.size.toLocaleLowerCase());
  if (new Set(sizeNames).size !== sizeNames.length) {
    this.invalidate("sizeQuantities", "Size names must be unique within an order.");
  }
  if (
    this.sizeQuantities.length > 0 &&
    this.sizeQuantities.reduce((total, item) => total + item.quantity, 0) !==
      this.totalQuantity
  ) {
    this.invalidate("totalQuantity", "Size quantities must match the order total.");
  }
  const targetStages = this.productionTargets.map((item) => item.stage);
  if (new Set(targetStages).size !== targetStages.length) {
    this.invalidate("productionTargets", "Each production stage can have only one target.");
  }
  for (const target of this.productionTargets) {
    if (
      target.baselineOutput > target.targetQuantity ||
      target.currentOutput < target.baselineOutput ||
      target.currentOutput > target.targetQuantity
    ) {
      this.invalidate(
        "productionTargets",
        "Recorded stage output must remain within its target.",
      );
      break;
    }
  }
  const workflowNames = this.workflowStages.map((stage) => stage.name);
  if (new Set(workflowNames).size !== workflowNames.length) {
    this.invalidate("workflowStages", "A production workflow cannot repeat a stage.");
  }
  if (
    this.workflowStages.length > 0 &&
    !workflowNames.includes(this.currentStage)
  ) {
    this.invalidate("currentStage", "The current stage must be included in the workflow.");
  }
  const milestoneIds = this.tnaMilestones.map((item) => item.id);
  if (new Set(milestoneIds).size !== milestoneIds.length) {
    this.invalidate("tnaMilestones", "TNA milestone IDs must be unique within an order.");
  }
});

export default mongoose.models.Order || mongoose.model("Order", orderSchema);

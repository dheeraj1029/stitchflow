import mongoose from "mongoose";
import {
  ISSUE_CATEGORIES,
  ISSUE_REVIEW_STATUSES,
  ISSUE_SEVERITIES,
  PRODUCTION_STAGES,
} from "./constants.js";

const productionIssueSchema = new mongoose.Schema(
  {
    clientRequestId: { type: String, trim: true, maxlength: 100, default: undefined },
    legacyId: { type: String, trim: true, maxlength: 100, default: undefined },
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true, index: true },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    productionUnit: { type: mongoose.Schema.Types.ObjectId, ref: "ProductionUnit", required: true },
    stage: { type: String, enum: PRODUCTION_STAGES, required: true },
    originalNote: { type: String, required: true, maxlength: 4000, immutable: true },
    languageHint: { type: String, enum: ["auto", "ta", "en"], default: "auto" },
    detectedLanguage: { type: String, enum: ["Tamil", "English", "Other", null], default: null },
    translatedNote: { type: String, maxlength: 4000, default: null },
    suggestedCategory: { type: String, enum: [...ISSUE_CATEGORIES, null], default: null },
    confirmedCategory: { type: String, enum: [...ISSUE_CATEGORIES, null], default: null },
    suggestedSeverity: { type: String, enum: [...ISSUE_SEVERITIES, null], default: null },
    confirmedSeverity: { type: String, enum: [...ISSUE_SEVERITIES, null], default: null },
    aiExplanation: { type: String, maxlength: 500, default: null },
    confidence: { type: Number, min: 0, max: 1, default: null },
    needsReview: { type: Boolean, default: false },
    reviewStatus: { type: String, enum: ISSUE_REVIEW_STATUSES, default: "PENDING_REVIEW", index: true },
    reviewer: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reviewerNote: { type: String, maxlength: 1000, default: "" },
    reviewedAt: { type: Date, default: null },
    classificationError: { type: String, maxlength: 500, default: null },
    confirmedTranslation: { type: String, maxlength: 4000, default: null },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true, strict: "throw" },
);

productionIssueSchema.index({ order: 1, reviewStatus: 1, createdAt: -1 });
productionIssueSchema.index({ productionUnit: 1, reviewStatus: 1, createdAt: -1 });
productionIssueSchema.index(
  { clientRequestId: 1 },
  { unique: true, sparse: true },
);
productionIssueSchema.index({ legacyId: 1 }, { unique: true, sparse: true });

export default mongoose.models.ProductionIssue ||
  mongoose.model("ProductionIssue", productionIssueSchema);

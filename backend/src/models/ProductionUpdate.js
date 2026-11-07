import mongoose from "mongoose";
import { PRODUCTION_STAGES } from "./constants.js";

const attachmentSchema = new mongoose.Schema(
  {
    fileName: { type: String, required: true, trim: true, maxlength: 255 },
    mimeType: { type: String, required: true, trim: true, maxlength: 120 },
    size: { type: Number, required: true, min: 0, validate: Number.isInteger },
    storageKey: { type: String, trim: true, maxlength: 500, default: "" },
  },
  { _id: false, strict: "throw" },
);

const productionUpdateSchema = new mongoose.Schema(
  {
    legacyId: { type: String, trim: true, maxlength: 100, default: undefined },
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true, index: true },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    productionUnit: { type: mongoose.Schema.Types.ObjectId, ref: "ProductionUnit", required: true },
    stage: { type: String, enum: PRODUCTION_STAGES, required: true, index: true },
    quantity: { type: Number, required: true, min: 1, validate: Number.isInteger },
    updateDate: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    issueNote: { type: String, maxlength: 4000, default: "" },
    issueCategory: { type: String, maxlength: 100, default: "" },
    attachments: { type: [attachmentSchema], default: [] },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true, strict: "throw" },
);

productionUpdateSchema.index({ order: 1, stage: 1, updateDate: 1 });
productionUpdateSchema.index({ productionUnit: 1, updateDate: -1 });
productionUpdateSchema.index({ legacyId: 1 }, { unique: true, sparse: true });

export default mongoose.models.ProductionUpdate ||
  mongoose.model("ProductionUpdate", productionUpdateSchema);

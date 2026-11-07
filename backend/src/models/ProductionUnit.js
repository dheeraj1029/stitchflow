import mongoose from "mongoose";

const productionUnitSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 160 },
    location: { type: String, trim: true, maxlength: 200, default: "" },
  },
  { timestamps: true, strict: "throw" },
);

productionUnitSchema.index({ name: 1 }, { unique: true });

export default mongoose.models.ProductionUnit ||
  mongoose.model("ProductionUnit", productionUnitSchema);

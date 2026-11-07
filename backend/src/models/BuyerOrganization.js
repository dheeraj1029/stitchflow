import mongoose from "mongoose";

const buyerOrganizationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 160 },
    country: { type: String, required: true, trim: true, maxlength: 100 },
    contact: {
      name: { type: String, trim: true, maxlength: 120, default: "" },
      email: { type: String, trim: true, lowercase: true, maxlength: 254, default: "" },
      phone: { type: String, trim: true, maxlength: 40, default: "" },
    },
  },
  { timestamps: true, strict: "throw" },
);

buyerOrganizationSchema.index({ name: 1 }, { unique: true });

export default mongoose.models.BuyerOrganization ||
  mongoose.model("BuyerOrganization", buyerOrganizationSchema);

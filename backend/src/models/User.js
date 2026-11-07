import mongoose from "mongoose";
import { USER_ROLES } from "./constants.js";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
      index: true,
    },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: USER_ROLES, required: true, index: true },
    isActive: { type: Boolean, default: true, required: true },
    buyerOrganization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BuyerOrganization",
      default: null,
      index: true,
    },
    productionUnit: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductionUnit",
      default: null,
      index: true,
    },
  },
  { timestamps: true, strict: "throw" },
);

userSchema.pre("validate", function validateRoleAssociation() {
  if (this.role === "BUYER" && !this.buyerOrganization) {
    this.invalidate("buyerOrganization", "Buyer accounts require an organization.");
  }
  if (this.role === "SUPERVISOR" && !this.productionUnit) {
    this.invalidate("productionUnit", "Supervisor accounts require a production unit.");
  }
  if (
    (this.role === "BUYER" && this.productionUnit) ||
    (this.role === "SUPERVISOR" && this.buyerOrganization) ||
    (["ADMIN", "MERCHANDISER"].includes(this.role) &&
      (this.buyerOrganization || this.productionUnit))
  ) {
    this.invalidate("role", "The role does not allow the supplied organization or unit.");
  }
});

export default mongoose.models.User || mongoose.model("User", userSchema);

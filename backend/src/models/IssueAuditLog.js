import mongoose from "mongoose";

const issueAuditLogSchema = new mongoose.Schema(
  {
    issue: { type: mongoose.Schema.Types.ObjectId, ref: "ProductionIssue", required: true, index: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    action: {
      type: String,
      enum: [
        "SUBMITTED",
        "AI_CLASSIFICATION_COMPLETED",
        "AI_CLASSIFICATION_FAILED",
        "CLASSIFICATION_RETRIED",
        "TRANSLATION_EDITED",
        "CATEGORY_CHANGED",
        "SEVERITY_CHANGED",
        "CONFIRMED",
        "REJECTED",
      ],
      required: true,
    },
    previousValue: { type: mongoose.Schema.Types.Mixed, default: null },
    newValue: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false }, strict: "throw" },
);

issueAuditLogSchema.index({ issue: 1, createdAt: 1 });

export default mongoose.models.IssueAuditLog ||
  mongoose.model("IssueAuditLog", issueAuditLogSchema);

import "dotenv/config";
import bcrypt from "bcryptjs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import { closeDatabase, connectDatabase } from "../config/database.js";
import BuyerOrganization from "../models/BuyerOrganization.js";
import IssueAuditLog from "../models/IssueAuditLog.js";
import Order from "../models/Order.js";
import ProductionIssue from "../models/ProductionIssue.js";
import ProductionUnit from "../models/ProductionUnit.js";
import User from "../models/User.js";

const DEMO_PASSWORD = "StitchFlowDemo2026!";
const IDS = {
  organizations: {
    companyB: new mongoose.Types.ObjectId("670000000000000000000001"),
    companyC: new mongoose.Types.ObjectId("670000000000000000000002"),
  },
  units: {
    unitA: new mongoose.Types.ObjectId("671000000000000000000001"),
    unitB: new mongoose.Types.ObjectId("671000000000000000000002"),
    unitC: new mongoose.Types.ObjectId("671000000000000000000003"),
  },
  users: {
    admin: new mongoose.Types.ObjectId("672000000000000000000001"),
    merchandiser: new mongoose.Types.ObjectId("672000000000000000000002"),
    supervisor: new mongoose.Types.ObjectId("672000000000000000000003"),
    buyerB: new mongoose.Types.ObjectId("672000000000000000000004"),
    buyerC: new mongoose.Types.ObjectId("672000000000000000000005"),
  },
};

const buyers = [
  { _id: IDS.organizations.companyB, name: "Company B (UK)", country: "United Kingdom" },
  { _id: IDS.organizations.companyC, name: "Company C (Germany)", country: "Germany" },
];

const units = [
  { _id: IDS.units.unitA, name: "Unit A", location: "Demonstration facility A" },
  { _id: IDS.units.unitB, name: "Unit B", location: "Demonstration facility B" },
  { _id: IDS.units.unitC, name: "Unit C", location: "Demonstration facility C" },
];

const userRecords = [
  { _id: IDS.users.admin, name: "StitchFlow Admin", email: "admin@stitchflow.demo", role: "ADMIN" },
  { _id: IDS.users.merchandiser, name: "Demo Merchandiser", email: "merchandiser@stitchflow.demo", role: "MERCHANDISER" },
  { _id: IDS.users.supervisor, name: "Demo Supervisor", email: "supervisor@stitchflow.demo", role: "SUPERVISOR", productionUnit: IDS.units.unitA },
  { _id: IDS.users.buyerB, name: "Company B Buyer", email: "buyer.b@stitchflow.demo", role: "BUYER", buyerOrganization: IDS.organizations.companyB },
  { _id: IDS.users.buyerC, name: "Company C Buyer", email: "buyer.c@stitchflow.demo", role: "BUYER", buyerOrganization: IDS.organizations.companyC },
];

const milestoneNames = [
  ["order-confirmation", "Order Confirmation"],
  ["sample-approval", "Sample Approval"],
  ["fabric-in-house", "Fabric In-house"],
  ["cutting-start", "Cutting Start"],
  ["printing-embroidery", "Printing / Embroidery"],
  ["stitching-start", "Stitching Start"],
  ["finishing-start", "Finishing Start"],
  ["final-inspection", "Final Inspection"],
  ["packing-completion", "Packing Completion"],
  ["ex-factory", "Ex-Factory"],
];

function milestones(orderDate, exFactoryDate) {
  const start = new Date(`${orderDate}T12:00:00Z`).getTime();
  const end = new Date(`${exFactoryDate}T12:00:00Z`).getTime();
  return milestoneNames.map(([key, name], sortOrder) => {
    const plannedDate =
      sortOrder === milestoneNames.length - 1
        ? exFactoryDate
        : new Date(
            start + ((end - start) * sortOrder) / (milestoneNames.length - 1),
          )
            .toISOString()
            .slice(0, 10);
    return {
      id: `${key}-${orderDate}`,
      key,
      name,
      plannedDate,
      completedAt: "",
      isCompleted: false,
      sortOrder,
      required: key !== "printing-embroidery",
    };
  });
}

const orders = [
  {
    poNumber: "B-PO-88213",
    buyerOrganization: IDS.organizations.companyB,
    productionUnit: IDS.units.unitA,
    orderDate: "2026-10-01",
    style: "Men's Crew Neck Tee",
    productDescription: "Men's crew neck tee",
    productCategory: "T-shirt",
    colour: "Navy",
    totalQuantity: 12000,
    currentStage: "Stitching",
    status: "on-track",
    exFactoryDate: "2026-11-20",
    workflowStages: ["Cutting", "Stitching", "Finishing", "Packing"].map((name) => ({ name, target: 12000 })),
    productionTargets: [
      { stage: "Cutting", targetQuantity: 12000, baselineOutput: 0, currentOutput: 0 },
      { stage: "Stitching", targetQuantity: 12000, baselineOutput: 6800, currentOutput: 6800 },
      { stage: "Finishing", targetQuantity: 12000, baselineOutput: 0, currentOutput: 0 },
      { stage: "Packing", targetQuantity: 12000, baselineOutput: 0, currentOutput: 0 },
    ],
  },
  {
    poNumber: "B-PO-88240",
    buyerOrganization: IDS.organizations.companyB,
    productionUnit: IDS.units.unitB,
    orderDate: "2026-09-20",
    style: "Men's Polo",
    productDescription: "Men's polo",
    productCategory: "Polo",
    colour: "White",
    totalQuantity: 8000,
    currentStage: "Finishing",
    status: "at-risk",
    exFactoryDate: "2026-11-12",
    workflowStages: ["Cutting", "Stitching", "Finishing", "Packing"].map((name) => ({ name, target: 8000 })),
    productionTargets: [
      { stage: "Cutting", targetQuantity: 8000, baselineOutput: 0, currentOutput: 0 },
      { stage: "Stitching", targetQuantity: 8000, baselineOutput: 0, currentOutput: 0 },
      { stage: "Finishing", targetQuantity: 8000, baselineOutput: 5200, currentOutput: 5200 },
      { stage: "Packing", targetQuantity: 8000, baselineOutput: 0, currentOutput: 0 },
    ],
  },
  {
    poNumber: "C-PO-0488",
    buyerOrganization: IDS.organizations.companyC,
    productionUnit: IDS.units.unitC,
    orderDate: "2026-10-05",
    style: "Kids Printed Tee",
    productDescription: "Kids printed tee",
    productCategory: "T-shirt",
    colour: "Yellow",
    totalQuantity: 10000,
    currentStage: "Printing",
    status: "delayed",
    exFactoryDate: "2026-11-28",
    workflowStages: ["Cutting", "Printing", "Stitching", "Finishing", "Packing"].map((name) => ({ name, target: 10000 })),
    productionTargets: [
      { stage: "Cutting", targetQuantity: 10000, baselineOutput: 0, currentOutput: 0 },
      { stage: "Printing", targetQuantity: 10000, baselineOutput: 3100, currentOutput: 3100 },
      { stage: "Stitching", targetQuantity: 10000, baselineOutput: 0, currentOutput: 0 },
      { stage: "Finishing", targetQuantity: 10000, baselineOutput: 0, currentOutput: 0 },
      { stage: "Packing", targetQuantity: 10000, baselineOutput: 0, currentOutput: 0 },
    ],
  },
].map((order) => ({
  ...order,
  buyerReference: "",
  styleNumber: "",
  fabricDescription: "",
  notes: "",
  productionNotes: "",
  sizeQuantities: [],
  tnaMilestones: milestones(order.orderDate, order.exFactoryDate),
  isDemo: true,
}));

const issues = [
  {
    orderPo: "B-PO-88213",
    stage: "Stitching",
    originalNote: "Internal supervisor report about thread tension.",
    languageHint: "en",
    detectedLanguage: "English",
    translatedNote: "The stitching thread tension was adjusted.",
    suggestedCategory: "QUALITY_DEFECT",
    confirmedCategory: "QUALITY_DEFECT",
    suggestedSeverity: "MEDIUM",
    confirmedSeverity: "MEDIUM",
    aiExplanation: "Thread tension affected the stitching quality.",
    confidence: 0.94,
    reviewStatus: "CONFIRMED",
    confirmedTranslation: "The stitching thread tension was adjusted.",
    reviewerNote: "Internal review details must remain private.",
    reviewerUser: IDS.users.merchandiser,
    submittedBy: IDS.users.supervisor,
    reviewedAt: new Date("2026-11-03T10:00:00.000Z"),
  },
  {
    orderPo: "B-PO-88240",
    stage: "Finishing",
    originalNote: "Internal unreviewed issue note.",
    languageHint: "en",
    detectedLanguage: "English",
    translatedNote: "Unreviewed suggestion.",
    suggestedCategory: "PRODUCTION_DELAY",
    suggestedSeverity: "HIGH",
    reviewStatus: "PENDING_REVIEW",
    submittedBy: IDS.users.supervisor,
  },
  {
    orderPo: "C-PO-0488",
    stage: "Printing",
    originalNote: "Internal supervisor report about print alignment.",
    languageHint: "en",
    detectedLanguage: "English",
    translatedNote: "A print alignment issue was corrected.",
    suggestedCategory: "PRINTING_ISSUE",
    confirmedCategory: "PRINTING_ISSUE",
    suggestedSeverity: "LOW",
    confirmedSeverity: "LOW",
    reviewStatus: "CONFIRMED",
    confirmedTranslation: "A print alignment issue was corrected.",
    submittedBy: IDS.users.supervisor,
    reviewerUser: IDS.users.merchandiser,
    reviewedAt: new Date("2026-11-02T10:00:00.000Z"),
  },
  {
    orderPo: "C-PO-0488",
    stage: "Printing",
    originalNote: "Internal rejected issue note.",
    languageHint: "en",
    detectedLanguage: "English",
    translatedNote: "Rejected internal translation.",
    suggestedCategory: "OTHER",
    suggestedSeverity: "LOW",
    reviewStatus: "REJECTED",
    reviewerNote: "Rejected after internal review.",
    submittedBy: IDS.users.supervisor,
    reviewerUser: IDS.users.merchandiser,
    reviewedAt: new Date("2026-11-01T10:00:00.000Z"),
  },
];

async function seedCollection(Model, records, uniqueField) {
  let inserted = 0;
  for (const record of records) {
    const { upsertedCount } = await Model.updateOne(
      { [uniqueField]: record[uniqueField] },
      { $setOnInsert: record },
      { upsert: true, runValidators: true },
    );
    inserted += upsertedCount;
  }
  return inserted;
}

export async function seedDemoData(uri = process.env.MONGODB_URI) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Demo seeding is disabled in production.");
  }
  await connectDatabase(uri);
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const buyerCount = await seedCollection(BuyerOrganization, buyers, "name");
  const unitCount = await seedCollection(ProductionUnit, units, "name");
  const [buyerB, buyerC, unitA, unitB, unitC] = await Promise.all([
    BuyerOrganization.findOne({ name: "Company B (UK)" }),
    BuyerOrganization.findOne({ name: "Company C (Germany)" }),
    ProductionUnit.findOne({ name: "Unit A" }),
    ProductionUnit.findOne({ name: "Unit B" }),
    ProductionUnit.findOne({ name: "Unit C" }),
  ]);
  if ([buyerB, buyerC, unitA, unitB, unitC].some((item) => !item)) {
    throw new Error("Seed verification could not resolve buyer organizations or production units.");
  }
  const userAssociations = {
    "supervisor@stitchflow.demo": { productionUnit: unitA._id },
    "buyer.b@stitchflow.demo": { buyerOrganization: buyerB._id },
    "buyer.c@stitchflow.demo": { buyerOrganization: buyerC._id },
  };
  const users = userRecords.map(({ buyerOrganization, productionUnit, ...user }) => ({
    ...user,
    ...userAssociations[user.email],
    passwordHash,
    isActive: true,
  }));
  const userCount = await seedCollection(User, users, "email");
  const supervisor = await User.findOne({ email: "supervisor@stitchflow.demo" });
  const merchandiser = await User.findOne({ email: "merchandiser@stitchflow.demo" });
  if (!supervisor || !merchandiser) {
    throw new Error("Seed verification could not resolve demo users.");
  }
  const orderAssociations = {
    "B-PO-88213": { buyerOrganization: buyerB._id, productionUnit: unitA._id },
    "B-PO-88240": { buyerOrganization: buyerB._id, productionUnit: unitB._id },
    "C-PO-0488": { buyerOrganization: buyerC._id, productionUnit: unitC._id },
  };
  const seededOrders = orders.map((order) => ({
    ...order,
    ...orderAssociations[order.poNumber],
  }));
  const orderCount = await seedCollection(Order, seededOrders, "poNumber");

  const orderByPo = await Order.find({
    poNumber: { $in: issues.map((issue) => issue.orderPo) },
  }).select("_id poNumber");
  const orderIds = new Map(orderByPo.map((order) => [order.poNumber, order._id]));
  let issueCount = 0;
  for (const issueRecord of issues) {
    const {
      orderPo,
      reviewerUser: _reviewerUser,
      submittedBy: _submittedBy,
      ...issue
    } = issueRecord;
    const filter = { order: orderIds.get(orderPo), originalNote: issue.originalNote };
    const order = await Order.findById(orderIds.get(orderPo)).select("productionUnit");
    const submittedBy = supervisor._id;
    const reviewer = issue.reviewerUser ? merchandiser._id : undefined;
    const result = await ProductionIssue.updateOne(
      filter,
      {
        $setOnInsert: {
          ...issue,
          submittedBy,
          ...(reviewer ? { reviewer } : {}),
          order: orderIds.get(orderPo),
          productionUnit: order.productionUnit,
          isDemo: true,
        },
      },
      { upsert: true, runValidators: true },
    );
    issueCount += result.upsertedCount;
    if (result.upsertedId && reviewer) {
      await IssueAuditLog.updateOne(
        { issue: result.upsertedId, action: issue.reviewStatus },
        {
          $setOnInsert: {
            issue: result.upsertedId,
            actor: reviewer,
            action: issue.reviewStatus,
            newValue: {
              reviewStatus: issue.reviewStatus,
              reviewerNote: issue.reviewerNote || "",
            },
            createdAt: issue.reviewedAt || new Date(),
          },
        },
        { upsert: true },
      );
    }
  }
  const counts = {
    buyers: await BuyerOrganization.countDocuments(),
    productionUnits: await ProductionUnit.countDocuments(),
    users: await User.countDocuments(),
    orders: await Order.countDocuments(),
    issues: await ProductionIssue.countDocuments(),
  };
  const expected = { buyers: 2, productionUnits: 3, users: 5, orders: 3, issues: 4 };
  for (const [collection, minimum] of Object.entries(expected)) {
    if (counts[collection] < minimum) {
      throw new Error(`Seed verification failed for ${collection}.`);
    }
  }
  console.info("Demo seed verified:", {
    inserted: {
      buyers: buyerCount,
      productionUnits: unitCount,
      users: userCount,
      orders: orderCount,
      issues: issueCount,
    },
    total: counts,
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  seedDemoData()
    .catch((error) => {
      console.error(error.message || "Demo seed failed.");
      process.exitCode = 1;
    })
    .finally(closeDatabase);
}

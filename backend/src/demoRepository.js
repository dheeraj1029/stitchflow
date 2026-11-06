import { randomUUID } from "node:crypto";

const DEMO_PASSWORD_HASH =
  "$2b$10$H8VkmgMIvSginphuJJ4z9eUwEvLW2xeTdFDEsQDBZWFAHtM/wFibW";

const demoUsers = [
  {
    id: "user-admin",
    email: "admin@stitchflow.demo",
    name: "StitchFlow Admin",
    role: "ADMIN",
    isActive: true,
    buyerOrganizationId: null,
    productionUnitId: null,
  },
  {
    id: "user-merchandiser",
    email: "merchandiser@stitchflow.demo",
    name: "Demo Merchandiser",
    role: "MERCHANDISER",
    isActive: true,
    buyerOrganizationId: null,
    productionUnitId: null,
  },
  {
    id: "user-supervisor",
    email: "supervisor@stitchflow.demo",
    name: "Demo Supervisor",
    role: "SUPERVISOR",
    isActive: true,
    buyerOrganizationId: null,
    productionUnitId: "unit-north-mill",
  },
  {
    id: "user-buyer-b",
    email: "buyer.b@stitchflow.demo",
    name: "Company B Buyer",
    role: "BUYER",
    isActive: true,
    buyerOrganizationId: "buyer-company-b",
    productionUnitId: null,
  },
  {
    id: "user-buyer-c",
    email: "buyer.c@stitchflow.demo",
    name: "Company C Buyer",
    role: "BUYER",
    isActive: true,
    buyerOrganizationId: "buyer-company-c",
    productionUnitId: null,
  },
].map((user) => ({ ...user, passwordHash: DEMO_PASSWORD_HASH }));

const demoOrders = [
  {
    id: "B-PO-88213",
    poNumber: "B-PO-88213",
    buyerOrganizationId: "buyer-company-b",
    buyer: "Company B (UK)",
    buyerCountry: "United Kingdom",
    style: "Men's Crew Neck Tee",
    colour: "Navy",
    quantity: 12000,
    stage: "Stitching",
    stageOutput: 6800,
    productionTarget: 12000,
    workflowStages: ["Cutting", "Stitching", "Finishing", "Packing"],
    exFactoryDate: "2026-11-20",
    status: "on-track",
    productionUnitId: "unit-north-mill",
    productionUnit: "North Mill (Demo)",
    notes: "Internal merchandiser note for demo purposes.",
    productionNotes: "Internal supervisor note for demo purposes.",
    milestones: [
      { id: "b-88213-m1", name: "Order Confirmation", plannedDate: "2026-10-01", completed: true, completedDate: "2026-10-01" },
      { id: "b-88213-m2", name: "Sample Approval", plannedDate: "2026-10-07", completed: true, completedDate: "2026-10-06" },
      { id: "b-88213-m3", name: "Fabric In-house", plannedDate: "2026-10-14", completed: true, completedDate: "2026-10-14" },
      { id: "b-88213-m4", name: "Cutting Start", plannedDate: "2026-10-20", completed: true, completedDate: "2026-10-20" },
      { id: "b-88213-m5", name: "Stitching Start", plannedDate: "2026-10-28", completed: true, completedDate: "2026-10-28" },
      { id: "b-88213-m6", name: "Final Inspection", plannedDate: "2026-11-16", completed: false, completedDate: "" },
      { id: "b-88213-m7", name: "Ex-Factory", plannedDate: "2026-11-20", completed: false, completedDate: "" },
    ],
  },
  {
    id: "B-PO-88240",
    poNumber: "B-PO-88240",
    buyerOrganizationId: "buyer-company-b",
    buyer: "Company B (UK)",
    buyerCountry: "United Kingdom",
    style: "Men's Polo",
    colour: "White",
    quantity: 8000,
    stage: "Finishing",
    stageOutput: 5200,
    productionTarget: 8000,
    workflowStages: ["Cutting", "Stitching", "Finishing", "Packing"],
    exFactoryDate: "2026-11-12",
    status: "at-risk",
    productionUnitId: "unit-riverside-works",
    productionUnit: "Riverside Works (Demo)",
    notes: "Internal order note.",
    productionNotes: "Internal supervisor note.",
    milestones: [
      { id: "b-88240-m1", name: "Order Confirmation", plannedDate: "2026-09-20", completed: true, completedDate: "2026-09-20" },
      { id: "b-88240-m2", name: "Sample Approval", plannedDate: "2026-09-27", completed: true, completedDate: "2026-09-26" },
      { id: "b-88240-m3", name: "Fabric In-house", plannedDate: "2026-10-04", completed: true, completedDate: "2026-10-05" },
      { id: "b-88240-m4", name: "Stitching Start", plannedDate: "2026-10-15", completed: true, completedDate: "2026-10-16" },
      { id: "b-88240-m5", name: "Final Inspection", plannedDate: "2026-11-09", completed: false, completedDate: "" },
      { id: "b-88240-m6", name: "Ex-Factory", plannedDate: "2026-11-12", completed: false, completedDate: "" },
    ],
  },
  {
    id: "C-PO-0488",
    poNumber: "C-PO-0488",
    buyerOrganizationId: "buyer-company-c",
    buyer: "Company C (Germany)",
    buyerCountry: "Germany",
    style: "Kids Printed Tee",
    colour: "Yellow",
    quantity: 10000,
    stage: "Printing",
    stageOutput: 3100,
    productionTarget: 10000,
    workflowStages: ["Cutting", "Printing", "Stitching", "Finishing", "Packing"],
    exFactoryDate: "2026-11-28",
    status: "delayed",
    productionUnitId: "unit-east-works",
    productionUnit: "East Works (Demo)",
    notes: "Internal order note.",
    productionNotes: "Internal supervisor note.",
    milestones: [
      { id: "c-0488-m1", name: "Order Confirmation", plannedDate: "2026-10-05", completed: true, completedDate: "2026-10-05" },
      { id: "c-0488-m2", name: "Sample Approval", plannedDate: "2026-10-12", completed: true, completedDate: "2026-10-13" },
      { id: "c-0488-m3", name: "Fabric In-house", plannedDate: "2026-10-19", completed: true, completedDate: "2026-10-19" },
      { id: "c-0488-m4", name: "Printing Start", plannedDate: "2026-10-24", completed: false, completedDate: "" },
      { id: "c-0488-m5", name: "Final Inspection", plannedDate: "2026-11-24", completed: false, completedDate: "" },
      { id: "c-0488-m6", name: "Ex-Factory", plannedDate: "2026-11-28", completed: false, completedDate: "" },
    ],
  },
];

const demoIssues = [
  {
    id: "issue-b-confirmed",
    orderId: "B-PO-88213",
    orderNumber: "B-PO-88213",
    buyerOrganizationId: "buyer-company-b",
    productionUnitId: "unit-north-mill",
    stage: "Stitching",
    originalNote: "Internal supervisor report about thread tension.",
    suggestedTranslation: "An internal AI translation not for buyers.",
    suggestedCategory: "QUALITY_DEFECT",
    suggestedSeverity: "MEDIUM",
    reviewerNote: "Internal review details must remain private.",
    confirmedTranslation: "The stitching thread tension was adjusted.",
    confirmedCategory: "QUALITY_DEFECT",
    confirmedSeverity: "MEDIUM",
    reviewStatus: "CONFIRMED",
    createdAt: "2026-11-03T08:30:00.000Z",
    reviewedAt: "2026-11-03T10:00:00.000Z",
    ownerUserId: "user-supervisor",
    auditHistory: [{ event: "MERCHANDISER_CONFIRMED", timestamp: "2026-11-03T10:00:00.000Z", reviewerNote: "Internal review details must remain private." }],
  },
  {
    id: "issue-b-pending",
    orderId: "B-PO-88240",
    orderNumber: "B-PO-88240",
    buyerOrganizationId: "buyer-company-b",
    productionUnitId: "unit-riverside-works",
    stage: "Finishing",
    originalNote: "Internal unreviewed issue note.",
    suggestedTranslation: "Unreviewed suggestion.",
    suggestedCategory: "PRODUCTION_DELAY",
    suggestedSeverity: "HIGH",
    reviewerNote: "",
    confirmedTranslation: null,
    confirmedCategory: null,
    confirmedSeverity: null,
    reviewStatus: "PENDING_REVIEW",
    createdAt: "2026-11-05T08:30:00.000Z",
    reviewedAt: null,
    ownerUserId: "user-supervisor",
    auditHistory: [],
  },
  {
    id: "issue-c-confirmed",
    orderId: "C-PO-0488",
    orderNumber: "C-PO-0488",
    buyerOrganizationId: "buyer-company-c",
    productionUnitId: "unit-east-works",
    stage: "Printing",
    originalNote: "Internal supervisor report about print alignment.",
    suggestedTranslation: "An internal AI translation not for buyers.",
    suggestedCategory: "PRINTING_ISSUE",
    suggestedSeverity: "LOW",
    reviewerNote: "Internal review details must remain private.",
    confirmedTranslation: "A print alignment issue was corrected.",
    confirmedCategory: "PRINTING_ISSUE",
    confirmedSeverity: "LOW",
    reviewStatus: "CONFIRMED",
    createdAt: "2026-11-02T08:30:00.000Z",
    reviewedAt: "2026-11-02T10:00:00.000Z",
    ownerUserId: "user-supervisor",
    auditHistory: [],
  },
  {
    id: "issue-c-rejected",
    orderId: "C-PO-0488",
    orderNumber: "C-PO-0488",
    buyerOrganizationId: "buyer-company-c",
    productionUnitId: "unit-east-works",
    stage: "Printing",
    originalNote: "Internal rejected issue note.",
    suggestedTranslation: "Rejected internal translation.",
    suggestedCategory: "OTHER",
    suggestedSeverity: "LOW",
    reviewerNote: "Rejected after internal review.",
    confirmedTranslation: null,
    confirmedCategory: null,
    confirmedSeverity: null,
    reviewStatus: "REJECTED",
    createdAt: "2026-11-01T08:30:00.000Z",
    reviewedAt: "2026-11-01T10:00:00.000Z",
    ownerUserId: "user-supervisor",
    auditHistory: [],
  },
];

export function createDemoRepository() {
  const users = demoUsers.map((user) => ({ ...user }));
  const orders = demoOrders.map((order) => ({
    ...order,
    milestones: order.milestones.map((milestone) => ({ ...milestone })),
    workflowStages: [...order.workflowStages],
  }));
  const issues = demoIssues.map((issue) => ({
    ...issue,
    auditHistory: issue.auditHistory.map((event) => ({ ...event })),
  }));

  return {
    users,
    orders,
    issues,
    organizations: [
      { id: "buyer-company-b", name: "Company B (UK)", country: "United Kingdom" },
      { id: "buyer-company-c", name: "Company C (Germany)", country: "Germany" },
    ],
    productionUnits: [
      { id: "unit-north-mill", name: "North Mill (Demo)" },
      { id: "unit-riverside-works", name: "Riverside Works (Demo)" },
      { id: "unit-east-works", name: "East Works (Demo)" },
    ],
    findUserByEmail(email) {
      return users.find((user) => user.email === email) || null;
    },
    findUserById(id) {
      return users.find((user) => user.id === id) || null;
    },
    findOrder(id) {
      return orders.find((order) => order.id === id || order.poNumber === id) || null;
    },
    findIssue(id) {
      return issues.find((issue) => issue.id === id) || null;
    },
    createUser(user) {
      const created = { id: randomUUID(), ...user };
      users.push(created);
      return created;
    },
  };
}

export const DEMO_ORGANIZATIONS = [
  { id: "buyer-company-b", name: "Company B (UK)" },
  { id: "buyer-company-c", name: "Company C (Germany)" },
];

export const DEMO_PRODUCTION_UNITS = [
  { id: "unit-north-mill", name: "North Mill (Demo)" },
  { id: "unit-riverside-works", name: "Riverside Works (Demo)" },
  { id: "unit-east-works", name: "East Works (Demo)" },
];

export const USER_ROLES = ["ADMIN", "MERCHANDISER", "SUPERVISOR", "BUYER"];

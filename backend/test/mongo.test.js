import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { once } from "node:events";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import mongoose from "mongoose";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MongoMemoryReplSet, MongoMemoryServer } from "mongodb-memory-server";
import test, { after, before, beforeEach } from "node:test";
import { createApp } from "../src/app.js";
import { closeDatabase, connectDatabase, isDatabaseReady } from "../src/config/database.js";
import BuyerOrganization from "../src/models/BuyerOrganization.js";
import IssueAuditLog from "../src/models/IssueAuditLog.js";
import Order from "../src/models/Order.js";
import ProductionIssue from "../src/models/ProductionIssue.js";
import ProductionUnit from "../src/models/ProductionUnit.js";
import ProductionUpdate from "../src/models/ProductionUpdate.js";
import User from "../src/models/User.js";
import { importBrowserExport } from "../src/migrations/import-browser-export.js";
import { createMongoRepository } from "../src/repositories/mongoRepository.js";
import { seedDemoData } from "../src/seed/seed.js";

const SECRET = "phase-eight-mongodb-test-secret-with-more-than-thirty-two-bytes";
let replicaSet;
let mongoUri;

before(async () => {
  replicaSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  mongoUri = replicaSet.getUri("stitchflow_test");
  await connectDatabase(mongoUri);
});

beforeEach(async () => {
  await mongoose.connection.db.dropDatabase();
  await Promise.all(
    [
      BuyerOrganization,
      ProductionUnit,
      User,
      Order,
      ProductionUpdate,
      ProductionIssue,
      IssueAuditLog,
    ].map((Model) => Model.createIndexes()),
  );
  await seedDemoData(mongoUri);
});

after(async () => {
  await closeDatabase();
  await replicaSet?.stop();
});

async function withServer(run, classify) {
  const app = createApp({
    repository: createMongoRepository(),
    jwtSecret: SECRET,
    classify,
    loginLimit: 20,
  });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();
  try {
    return await run(`http://127.0.0.1:${port}`, app);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

async function login(baseUrl, email, password = "StitchFlowDemo2026!") {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return { response, body: await response.json() };
}

function request(baseUrl, token, path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (token) headers.set("authorization", `Bearer ${token}`);
  if (options.body) headers.set("content-type", "application/json");
  return fetch(`${baseUrl}${path}`, { ...options, headers });
}

test("MongoDB connection waits for readiness and missing URI is rejected", async () => {
  assert.equal(isDatabaseReady(), true);
  await assert.rejects(
    connectDatabase(""),
    /MONGODB_URI is required before the API can start/,
  );
});

test("standalone MongoDB is rejected because workflow writes require transactions", async () => {
  const standalone = await MongoMemoryServer.create();
  await closeDatabase();
  try {
    await assert.rejects(
      connectDatabase(standalone.getUri()),
      /transactions require a replica set or sharded cluster/,
    );
  } finally {
    await standalone.stop();
    await connectDatabase(mongoUri);
  }
});

test("Mongoose schemas enforce associations, stage, quantities, and unique values", async () => {
  const organization = await BuyerOrganization.findOne({ name: "Company B (UK)" });
  const unit = await ProductionUnit.findOne({ name: "Unit A" });
  const hash = await bcrypt.hash("valid-test-password", 4);

  await assert.rejects(
    new User({
      name: "Unassigned buyer",
      email: "unassigned@example.test",
      passwordHash: hash,
      role: "BUYER",
    }).validate(),
    /buyerOrganization/,
  );
  await assert.rejects(
    new User({
      name: "Bad stage",
      email: "bad-stage@example.test",
      passwordHash: hash,
      role: "MERCHANDISER",
      productionUnit: unit._id,
    }).validate(),
    /role/,
  );
  await assert.rejects(
    Order.create({
      poNumber: "BAD-QUANTITY",
      buyerOrganization: organization._id,
      productionUnit: unit._id,
      style: "Test",
      colour: "Blue",
      totalQuantity: 0,
      currentStage: "Stitching",
      status: "pending",
      exFactoryDate: "2026-12-01",
    }),
    /validation failed|less than minimum/i,
  );

  const order = await Order.findOne({ poNumber: "B-PO-88213" });
  const invalidStage = new Order({
    ...order.toObject(),
    _id: new mongoose.Types.ObjectId(),
    poNumber: "BAD-STAGE",
    currentStage: "Sewing",
  });
  await assert.rejects(invalidStage.validate(), /currentStage/);
  await assert.rejects(
    Order.create({
      poNumber: "B-PO-88213",
      buyerOrganization: organization._id,
      productionUnit: unit._id,
      style: "Duplicate",
      colour: "Blue",
      totalQuantity: 1,
      currentStage: "Cutting",
      status: "pending",
      exFactoryDate: "2026-12-01",
    }),
    (error) => error.code === 11000,
  );

  await assert.rejects(
    User.create({
      name: "Duplicate email",
      email: "ADMIN@STITCHFLOW.DEMO",
      passwordHash: hash,
      role: "ADMIN",
    }),
    (error) => error.code === 11000,
  );
});

test("demo seeding is repeatable and never overwrites user-created records", async () => {
  await User.create({
    name: "User-created merchandiser",
    email: "created.by.admin@stitchflow.demo",
    passwordHash: await bcrypt.hash("another-valid-password", 4),
    role: "MERCHANDISER",
  });
  const demoAdmin = await User.findOne({ email: "admin@stitchflow.demo" });
  demoAdmin.name = "Admin-edited label";
  await demoAdmin.save();

  await seedDemoData(mongoUri);
  await seedDemoData(mongoUri);

  assert.equal(await BuyerOrganization.countDocuments(), 2);
  assert.equal(await ProductionUnit.countDocuments(), 3);
  assert.equal(await Order.countDocuments(), 3);
  assert.equal(await ProductionIssue.countDocuments(), 4);
  assert.equal(await User.countDocuments(), 6);
  assert.equal(
    (await User.findOne({ email: "admin@stitchflow.demo" })).name,
    "Admin-edited label",
  );
  assert.equal(
    (await User.findOne({ email: "created.by.admin@stitchflow.demo" })).name,
    "User-created merchandiser",
  );
});

test("demo seeding is blocked in production", async () => {
  const previousEnvironment = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    await assert.rejects(
      seedDemoData(mongoUri),
      /Demo seeding is disabled in production/,
    );
    assert.equal(await Order.countDocuments(), 3);
  } finally {
    if (previousEnvironment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousEnvironment;
  }
});

test("browser export import is additive, repeatable, and preserves stage output", async () => {
  const directory = await mkdtemp(join(tmpdir(), "stitchflow-import-"));
  const exportPath = join(directory, "browser-export.json");
  const requiredMilestones = [
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
  const bundle = {
    orders: {
      version: 1,
      orders: [{
        id: "MIGRATED-PO-1",
        poNumber: "MIGRATED-PO-1",
        buyer: "Company B (UK)",
        buyerCountry: "United Kingdom",
        productionUnit: "North Mill (Demo)",
        orderDate: "2026-10-01",
        style: "Migrated tee",
        colour: "Navy",
        quantity: 12000,
        stage: "Stitching",
        status: "on-track",
        exFactoryDate: "2026-11-20",
        stageOutput: 6800,
        baselineStageOutputs: { Stitching: 6800 },
        workflowStages: ["Cutting", "Stitching"],
        milestones: requiredMilestones.map(([key, name]) => ({
          id: key,
          key,
          name,
          plannedDate: key === "ex-factory" ? "2026-11-20" : "2026-10-15",
          completed: false,
          required: true,
        })).concat([{
          id: "optional-milestone",
          name: "Optional milestone",
          plannedDate: "",
          completed: false,
          required: false,
        }]),
      }],
    },
    productionUpdates: {
      version: 1,
      updates: [{
        id: "legacy-update-1",
        orderId: "MIGRATED-PO-1",
        poNumber: "MIGRATED-PO-1",
        stage: "Stitching",
        productionDate: "2026-11-01",
        completedQuantity: 25,
        submittedAt: "2026-11-01T10:00:00.000Z",
        attachment: null,
      }],
    },
    issues: {
      version: 1,
      issues: [{
        id: "legacy-issue-1",
        orderId: "MIGRATED-PO-1",
        orderNumber: "MIGRATED-PO-1",
        stage: "Stitching",
        originalNote: "Needles are broken on line 2.",
        reviewStatus: "PENDING_REVIEW",
        suggestedCategory: null,
        confirmedCategory: null,
        suggestedSeverity: null,
        confirmedSeverity: null,
        confidence: null,
        auditHistory: [],
      }],
    },
  };
  await writeFile(exportPath, JSON.stringify(bundle));
  try {
    const first = await importBrowserExport(exportPath, mongoUri);
    assert.deepEqual(first.orders, { imported: 1, skipped: 0 });
    assert.deepEqual(first.productionUpdates, { imported: 1, skipped: 0 });
    assert.deepEqual(first.issues, { imported: 1, skipped: 0 });

    const order = await Order.findOne({ poNumber: "MIGRATED-PO-1" });
    assert.equal(order.productionTargets.find((target) => target.stage === "Stitching").baselineOutput, 6800);
    assert.equal(order.productionTargets.find((target) => target.stage === "Stitching").currentOutput, 6825);
    assert.equal(order.tnaMilestones.find((milestone) => milestone.id === "optional-milestone").plannedDate, "");

    const second = await importBrowserExport(exportPath, mongoUri);
    assert.deepEqual(second.orders, { imported: 0, skipped: 1 });
    assert.deepEqual(second.productionUpdates, { imported: 0, skipped: 1 });
    assert.deepEqual(second.issues, { imported: 0, skipped: 1 });
    assert.equal(await ProductionUpdate.countDocuments({ legacyId: "legacy-update-1" }), 1);
    assert.equal(await ProductionIssue.countDocuments({ legacyId: "legacy-issue-1" }), 1);
    assert.equal(
      (await Order.findOne({ poNumber: "MIGRATED-PO-1" })).productionTargets
        .find((target) => target.stage === "Stitching").currentOutput,
      6825,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("database APIs preserve buyer isolation and supervisor unit scoping", async () => {
  await withServer(async (baseUrl) => {
    const buyerB = await login(baseUrl, "buyer.b@stitchflow.demo");
    const buyerC = await login(baseUrl, "buyer.c@stitchflow.demo");
    const supervisor = await login(baseUrl, "supervisor@stitchflow.demo");
    const merchandiser = await login(baseUrl, "merchandiser@stitchflow.demo");
    const ordersB = await request(baseUrl, buyerB.body.accessToken, "/api/orders?buyer=all");
    const ordersC = await request(baseUrl, buyerC.body.accessToken, "/api/orders");
    const ordersSupervisor = await request(
      baseUrl,
      supervisor.body.accessToken,
      "/api/orders",
    );
    assert.deepEqual(
      (await ordersB.json()).orders.map((order) => order.poNumber),
      ["B-PO-88240", "B-PO-88213"],
    );
    assert.deepEqual(
      (await ordersC.json()).orders.map((order) => order.poNumber),
      ["C-PO-0488"],
    );
    assert.deepEqual(
      (await ordersSupervisor.json()).orders.map((order) => order.poNumber),
      ["B-PO-88213"],
    );
    const buyerOrder = (await (
      await request(baseUrl, buyerB.body.accessToken, "/api/orders/B-PO-88213")
    ).json()).order;
    assert.equal(buyerOrder.isDemo, true);
    assert.equal("notes" in buyerOrder, false);
    assert.equal("productionNotes" in buyerOrder, false);
    assert.equal("baselineStageOutputs" in buyerOrder, false);
    assert.equal("productionTargets" in buyerOrder, false);
    assert.equal(
      (await request(
        baseUrl,
        buyerB.body.accessToken,
        "/api/orders/C-PO-0488",
      )).status,
      404,
    );
    assert.equal(
      (await request(baseUrl, buyerB.body.accessToken, "/api/users")).status,
      403,
    );
    const optionsResponse = await request(
      baseUrl,
      merchandiser.body.accessToken,
      "/api/order-options",
    );
    const options = await optionsResponse.json();
    assert.equal(optionsResponse.status, 200);
    assert.deepEqual(options.organizations.map((item) => item.name), [
      "Company B (UK)",
      "Company C (Germany)",
    ]);
    assert.deepEqual(options.productionUnits.map((item) => item.name), [
      "Unit A",
      "Unit B",
      "Unit C",
    ]);
    assert.equal(
      (await request(baseUrl, buyerB.body.accessToken, "/api/order-options")).status,
      403,
    );
  });
});

test("admin user changes persist and deactivation invalidates an existing access token", async () => {
  await withServer(async (baseUrl) => {
    const admin = await login(baseUrl, "admin@stitchflow.demo");
    const organization = await BuyerOrganization.findOne({ name: "Company B (UK)" });
    const createdResponse = await request(baseUrl, admin.body.accessToken, "/api/users", {
      method: "POST",
      body: JSON.stringify({
        name: "Phase 9 Buyer",
        email: "phase9.buyer@stitchflow.demo",
        role: "BUYER",
        buyerOrganizationId: String(organization._id),
        productionUnitId: null,
        password: "Phase9-Unique-Test!",
      }),
    });
    assert.equal(createdResponse.status, 201);
    const created = (await createdResponse.json()).user;
    assert.equal(created.passwordHash, undefined);
    const buyerToken = (
      await login(baseUrl, "phase9.buyer@stitchflow.demo", "Phase9-Unique-Test!")
    ).body.accessToken;
    assert.equal(typeof buyerToken, "string");

    const editResponse = await request(
      baseUrl,
      admin.body.accessToken,
      `/api/users/${created.id}`,
      {
        method: "PATCH",
        body: JSON.stringify({ name: "Updated Phase 9 Buyer" }),
      },
    );
    assert.equal(editResponse.status, 200);
    assert.equal((await editResponse.json()).user.name, "Updated Phase 9 Buyer");

    const disableResponse = await request(
      baseUrl,
      admin.body.accessToken,
      `/api/users/${created.id}`,
      {
        method: "PATCH",
        body: JSON.stringify({ isActive: false }),
      },
    );
    assert.equal(disableResponse.status, 200);
    assert.equal(
      (await request(baseUrl, buyerToken, "/api/auth/me")).status,
      401,
    );
    assert.equal(
      (await login(baseUrl, "phase9.buyer@stitchflow.demo", "Phase9-Unique-Test!"))
        .response.status,
      401,
    );
  });
});

test("MongoDB APIs create and validate orders, preserve TNA edits, and recalculate size totals", async () => {
  await withServer(async (baseUrl) => {
    const merchandiser = await login(baseUrl, "merchandiser@stitchflow.demo");
    const token = merchandiser.body.accessToken;
    const options = await (
      await request(baseUrl, token, "/api/order-options")
    ).json();
    const milestones = [
      ["order-confirmation", "Order Confirmation"],
      ["sample-approval", "Sample Approval"],
      ["fabric-in-house", "Fabric In-house"],
      ["cutting-start", "Cutting Start"],
      ["stitching-start", "Stitching Start"],
      ["finishing-start", "Finishing Start"],
      ["final-inspection", "Final Inspection"],
      ["packing-completion", "Packing Completion"],
      ["ex-factory", "Ex-Factory"],
    ].map(([key, name], sortOrder) => ({
      id: key,
      key,
      name,
      plannedDate:
        key === "ex-factory"
          ? "2026-12-10"
          : `2026-11-${String(7 + sortOrder).padStart(2, "0")}`,
      required: true,
      completed: false,
      completedDate: "",
      sortOrder,
    }));
    const orderInput = {
      poNumber: "P9-ORDER-CREATE",
      buyerOrganizationId: options.organizations.find(
        (organization) => organization.name === "Company B (UK)",
      ).id,
      productionUnitId: options.productionUnits.find(
        (unit) => unit.name === "Unit A",
      ).id,
      orderDate: "2026-11-07",
      style: "Phase 9 sample tee",
      colour: "Navy",
      sizeBreakdown: [
        { size: "S", quantity: 7 },
        { size: "M", quantity: 5 },
      ],
      stage: "Cutting",
      productionTarget: 12,
      workflowStages: ["Cutting", "Stitching"],
      status: "pending",
      exFactoryDate: "2026-12-10",
      milestones,
      isDemo: true,
      passwordHash: "must-not-be-persisted",
    };

    const missingBreakdown = await request(baseUrl, token, "/api/orders", {
      method: "POST",
      body: JSON.stringify({ ...orderInput, poNumber: "P9-MISSING-SIZES", sizeBreakdown: [] }),
    });
    assert.equal(missingBreakdown.status, 400);

    const mismatchedBreakdown = await request(baseUrl, token, "/api/orders", {
      method: "POST",
      body: JSON.stringify({
        ...orderInput,
        poNumber: "P9-MISMATCHED-SIZES",
        totalQuantity: 13,
      }),
    });
    assert.equal(mismatchedBreakdown.status, 400);

    const createdResponse = await request(baseUrl, token, "/api/orders", {
      method: "POST",
      body: JSON.stringify(orderInput),
    });
    assert.equal(createdResponse.status, 201);
    const created = (await createdResponse.json()).order;
    assert.equal(created.quantity, 12);
    assert.equal(created.isDemo, false);
    assert.equal(created.passwordHash, undefined);
    assert.equal(created.sizeBreakdown.reduce((sum, row) => sum + row.quantity, 0), 12);

    const duplicateResponse = await request(baseUrl, token, "/api/orders", {
      method: "POST",
      body: JSON.stringify(orderInput),
    });
    assert.equal(duplicateResponse.status, 409);

    const changedMilestones = created.milestones.map((milestone) => ({
      ...milestone,
      plannedDate:
        milestone.key === "sample-approval"
          ? "2026-11-10"
          : milestone.plannedDate,
    }));
    const dateResponse = await request(
      baseUrl,
      token,
      "/api/orders/P9-ORDER-CREATE",
      {
        method: "PATCH",
        body: JSON.stringify({
          exFactoryDate: "2026-12-11",
          milestones: changedMilestones.map((milestone) => ({
            ...milestone,
            plannedDate:
              milestone.key === "ex-factory"
                ? "2026-12-11"
                : milestone.plannedDate,
          })),
        }),
      },
    );
    assert.equal(dateResponse.status, 200);

    const sizeResponse = await request(
      baseUrl,
      token,
      "/api/orders/P9-ORDER-CREATE",
      {
        method: "PATCH",
        body: JSON.stringify({
          sizeBreakdown: [
            { size: "S", quantity: 8 },
            { size: "M", quantity: 7 },
          ],
        }),
      },
    );
    assert.equal(sizeResponse.status, 200);

    const reopened = (await (
      await request(baseUrl, token, "/api/orders/P9-ORDER-CREATE")
    ).json()).order;
    assert.equal(reopened.quantity, 15);
    assert.equal(reopened.exFactoryDate, "2026-12-11");
    assert.equal(
      reopened.milestones.find((milestone) => milestone.key === "sample-approval")
        .plannedDate,
      "2026-11-10",
    );
    assert.equal(
      reopened.productionTargets.find((target) => target.stage === "Cutting")
        .targetQuantity,
      15,
    );
  });
});

test("order updates and stage-specific production output persist", async () => {
  await withServer(async (baseUrl) => {
    const merchandiser = await login(baseUrl, "merchandiser@stitchflow.demo");
    const token = merchandiser.body.accessToken;
    const originalOrder = (await (
      await request(baseUrl, token, "/api/orders/B-PO-88213")
    ).json()).order;
    const orderResponse = await request(
      baseUrl,
      token,
      "/api/orders/B-PO-88213",
      {
        method: "PATCH",
        body: JSON.stringify({
          exFactoryDate: "2026-11-21",
          quantity: originalOrder.quantity,
          sizeBreakdown: originalOrder.sizeBreakdown,
          milestones: originalOrder.milestones.map((milestone) =>
            milestone.key === "ex-factory"
              ? { ...milestone, plannedDate: "2026-11-21" }
              : milestone,
          ),
        }),
      },
    );
    assert.equal(orderResponse.status, 200);
    const updated = (await orderResponse.json()).order;
    assert.equal(updated.exFactoryDate, "2026-11-21");
    assert.equal(updated.stageOutput, 6800);
    assert.equal(
      updated.milestones.find((milestone) => milestone.key === "ex-factory").plannedDate,
      "2026-11-21",
    );

    const invalidWorkflow = await request(
      baseUrl,
      token,
      "/api/orders/B-PO-88213",
      {
        method: "PATCH",
        body: JSON.stringify({ workflowStages: ["Stitching", "Stitching"] }),
      },
    );
    assert.equal(invalidWorkflow.status, 400);

    const targetBelowOutput = await request(
      baseUrl,
      token,
      "/api/orders/B-PO-88213",
      {
        method: "PATCH",
        body: JSON.stringify({
          productionTargets: [{ stage: "Stitching", targetQuantity: 100 }],
        }),
      },
    );
    assert.equal(targetBelowOutput.status, 400);

    const invalidOrderDate = await request(
      baseUrl,
      token,
      "/api/orders/B-PO-88213",
      {
        method: "PATCH",
        body: JSON.stringify({ orderDate: "2026-02-31" }),
      },
    );
    assert.equal(invalidOrderDate.status, 400);

    const missingUnit = await request(
      baseUrl,
      token,
      "/api/orders/B-PO-88213",
      {
        method: "PATCH",
        body: JSON.stringify({
          productionUnitId: "673000000000000000000001",
        }),
      },
    );
    assert.equal(missingUnit.status, 400);
    const unchanged = (await (
      await request(baseUrl, merchandiser.body.accessToken, "/api/orders/B-PO-88213")
    ).json()).order;
    assert.equal(unchanged.productionUnit, "Unit A");
    assert.equal(unchanged.stageOutput, 6800);
  });
});

test("issue request identifiers cannot be replayed for another payload or user", async () => {
  await withServer(async (baseUrl) => {
    const supervisor = await login(baseUrl, "supervisor@stitchflow.demo");
    const merchandiser = await login(baseUrl, "merchandiser@stitchflow.demo");
    const issue = {
      id: "request-key-123",
      orderId: "B-PO-88213",
      stage: "Stitching",
      originalNote: "Needles are broken on line 2.",
      languageHint: "en",
    };
    const created = await request(
      baseUrl,
      supervisor.body.accessToken,
      "/api/issues",
      { method: "POST", body: JSON.stringify(issue) },
    );
    assert.equal(created.status, 201);

    const replay = await request(
      baseUrl,
      supervisor.body.accessToken,
      "/api/issues",
      {
        method: "POST",
        body: JSON.stringify({ ...issue, originalNote: "Different note." }),
      },
    );
    assert.equal(replay.status, 409);

    const otherOwner = await request(
      baseUrl,
      merchandiser.body.accessToken,
      "/api/issues",
      { method: "POST", body: JSON.stringify(issue) },
    );
    assert.equal(otherOwner.status, 409);
    assert.equal(await ProductionIssue.countDocuments({ clientRequestId: issue.id }), 1);
  });
});

test("production update create, edit, and delete use transactions without double-counting", async () => {
  await withServer(async (baseUrl) => {
    const supervisor = await login(baseUrl, "supervisor@stitchflow.demo");
    const token = supervisor.body.accessToken;
    const originalSave = Order.prototype.save;
    Order.prototype.save = async function failTransactionalOrderWrite(options) {
      if (options?.session) {
        throw new Error("Injected transaction write failure.");
      }
      return originalSave.call(this, options);
    };
    try {
      const failedWrite = await request(baseUrl, token, "/api/production-updates", {
        method: "POST",
        body: JSON.stringify({
          orderId: "B-PO-88213",
          stage: "Stitching",
          productionDate: "2026-11-07",
          completedQuantity: 100,
          issueNote: "This transaction must roll back.",
        }),
      });
      assert.equal(failedWrite.status, 500);
    } finally {
      Order.prototype.save = originalSave;
    }
    assert.equal(await ProductionUpdate.countDocuments(), 0);
    const unchanged = (await (
      await request(baseUrl, token, "/api/orders/B-PO-88213")
    ).json()).order;
    assert.equal(unchanged.stageOutput, 6800);
    assert.equal(
      unchanged.productionTargets.find((target) => target.stage === "Finishing")
        .currentOutput,
      0,
    );

    const createdResponse = await request(baseUrl, token, "/api/production-updates", {
      method: "POST",
      body: JSON.stringify({
        orderId: "B-PO-88213",
        stage: "Stitching",
        productionDate: "2026-11-07",
        completedQuantity: 100,
        issueNote: "Small line stoppage.",
        attachment: { fileName: "line.jpg", mimeType: "image/jpeg", size: 12 },
      }),
    });
    assert.equal(createdResponse.status, 201);
    const created = (await createdResponse.json()).update;
    let order = (await (await request(baseUrl, token, "/api/orders/B-PO-88213")).json()).order;
    assert.equal(order.stageOutput, 6900);
    assert.equal(order.status, "on-track");
    assert.equal(
      order.productionTargets.find((target) => target.stage === "Finishing")
        .currentOutput,
      0,
    );

    const editResponse = await request(
      baseUrl,
      token,
      `/api/production-updates/${created.id}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          orderId: "B-PO-88213",
          stage: "Stitching",
          productionDate: "2026-11-07",
          completedQuantity: 250,
          issueNote: "Corrected output.",
          attachment: null,
        }),
      },
    );
    assert.equal(editResponse.status, 200);
    order = (await (await request(baseUrl, token, "/api/orders/B-PO-88213")).json()).order;
    assert.equal(order.stageOutput, 7050);

    const invalid = await request(baseUrl, token, "/api/production-updates", {
      method: "POST",
      body: JSON.stringify({
        orderId: "B-PO-88213",
        stage: "Stitching",
        productionDate: "2026-11-07",
        completedQuantity: 6000,
      }),
    });
    assert.equal(invalid.status, 400);
    assert.equal(await ProductionUpdate.countDocuments(), 1);
    const failedEdit = await request(
      baseUrl,
      token,
      `/api/production-updates/${created.id}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          orderId: "B-PO-88213",
          stage: "Stitching",
          productionDate: "2026-11-07",
          completedQuantity: 6000,
          issueNote: "Invalid edit must leave the original output intact.",
        }),
      },
    );
    assert.equal(failedEdit.status, 400);
    assert.equal((await ProductionUpdate.findById(created.id)).quantity, 250);
    order = (await (await request(baseUrl, token, "/api/orders/B-PO-88213")).json()).order;
    assert.equal(order.stageOutput, 7050);
    assert.equal(
      order.productionTargets.find((target) => target.stage === "Finishing")
        .currentOutput,
      0,
    );

    const deleteResponse = await request(
      baseUrl,
      token,
      `/api/production-updates/${created.id}`,
      { method: "DELETE" },
    );
    assert.equal(deleteResponse.status, 204);
    order = (await (await request(baseUrl, token, "/api/orders/B-PO-88213")).json()).order;
    assert.equal(order.stageOutput, 6800);
    assert.equal(order.status, "on-track");
    assert.equal(await ProductionUpdate.countDocuments(), 0);
  });
});

test("issue classification failure can be retried and audited before review", async () => {
  let attempts = 0;
  const classification = {
    detectedLanguage: "English",
    translatedNote: "The machine stopped.",
    category: "MACHINE_BREAKDOWN",
    severity: "MEDIUM",
    explanation: "The note describes a machine stoppage.",
    confidence: 0.9,
    needsReview: true,
  };
  await withServer(async (baseUrl) => {
    const supervisor = await login(baseUrl, "supervisor@stitchflow.demo");
    const merchandiser = await login(baseUrl, "merchandiser@stitchflow.demo");
    const created = await request(
      baseUrl,
      supervisor.body.accessToken,
      "/api/issues",
      {
        method: "POST",
        body: JSON.stringify({
          id: "p9-retry-issue",
          orderId: "B-PO-88213",
          stage: "Stitching",
          originalNote: "Machine stopped on the line.",
          languageHint: "en",
        }),
      },
    );
    assert.equal(created.status, 201);
    const issueId = (await created.json()).issue.id;
    const classificationInput = {
      issueId,
      orderId: "B-PO-88213",
      stage: "Stitching",
      originalNote: "Machine stopped on the line.",
      languageHint: "en",
    };

    const failed = await request(
      baseUrl,
      supervisor.body.accessToken,
      "/api/issues/classify",
      { method: "POST", body: JSON.stringify(classificationInput) },
    );
    assert.equal(failed.status, 502);
    assert.doesNotMatch(await failed.text(), /provider secret|stack/i);

    const retried = await request(
      baseUrl,
      supervisor.body.accessToken,
      "/api/issues/classify",
      { method: "POST", body: JSON.stringify(classificationInput) },
    );
    assert.equal(retried.status, 200);
    let issue = (await (
      await request(baseUrl, merchandiser.body.accessToken, "/api/issues")
    ).json()).issues.find((item) => item.id === issueId);
    assert.equal(issue.originalNote, "Machine stopped on the line.");
    assert.ok(
      issue.auditHistory.some((entry) => entry.event === "AI_CLASSIFICATION_FAILED"),
    );
    assert.ok(
      issue.auditHistory.some((entry) => entry.event === "CLASSIFICATION_RETRIED"),
    );
    assert.ok(
      issue.auditHistory.some((entry) => entry.event === "AI_CLASSIFICATION_COMPLETED"),
    );

    const reviewed = await request(
      baseUrl,
      merchandiser.body.accessToken,
      `/api/issues/${issueId}/review`,
      {
        method: "PATCH",
        body: JSON.stringify({
          decision: "CONFIRMED",
          translation: "The machine stopped at the sewing line.",
          category: "QUALITY_DEFECT",
          severity: "LOW",
          reviewerNote: "Category and severity corrected.",
        }),
      },
    );
    assert.equal(reviewed.status, 200);
    issue = (await reviewed.json()).issue;
    assert.equal(issue.originalNote, "Machine stopped on the line.");
    assert.equal(issue.confirmedCategory, "QUALITY_DEFECT");
    assert.ok(issue.auditHistory.some((entry) => entry.event === "CATEGORY_CHANGED"));
    assert.equal(attempts, 2);
  }, async () => {
    attempts += 1;
    if (attempts === 1) {
      throw new Error("provider secret and stack must not reach the client");
    }
    return classification;
  });
});

test("issue creation, classification, confirmation, and audit history persist", async () => {
  const classification = {
    detectedLanguage: "English",
    translatedNote: "The machine stopped.",
    category: "MACHINE_BREAKDOWN",
    severity: "MEDIUM",
    explanation: "The report describes a machine stoppage.",
    confidence: 0.9,
    needsReview: false,
  };
  await withServer(async (baseUrl) => {
    const supervisor = await login(baseUrl, "supervisor@stitchflow.demo");
    const merchandiser = await login(baseUrl, "merchandiser@stitchflow.demo");
    const createdResponse = await request(baseUrl, supervisor.body.accessToken, "/api/issues", {
      method: "POST",
      body: JSON.stringify({
        id: "legacy-stable-issue-id",
        orderId: "B-PO-88213",
        stage: "Stitching",
        originalNote: "Machine stopped on the line.",
        languageHint: "en",
      }),
    });
    assert.equal(createdResponse.status, 201);
    const issueId = (await createdResponse.json()).issue.id;
    const classifyResponse = await request(
      baseUrl,
      supervisor.body.accessToken,
      "/api/issues/classify",
      {
        method: "POST",
        body: JSON.stringify({
          issueId,
          orderId: "B-PO-88213",
          stage: "Stitching",
          originalNote: "Machine stopped on the line.",
          languageHint: "en",
        }),
      },
    );
    assert.equal(
      classifyResponse.status,
      200,
      JSON.stringify(await classifyResponse.clone().json()),
    );
    const reviewResponse = await request(
      baseUrl,
      merchandiser.body.accessToken,
      `/api/issues/${issueId}/review`,
      {
        method: "PATCH",
        body: JSON.stringify({
          decision: "CONFIRMED",
          translation: "The machine stopped.",
          category: "MACHINE_BREAKDOWN",
          severity: "MEDIUM",
          reviewerNote: "",
        }),
      },
    );
    assert.equal(reviewResponse.status, 200);
    const issue = await ProductionIssue.findById(issueId).select("+originalNote");
    assert.equal(issue.originalNote, "Machine stopped on the line.");
    assert.equal(issue.reviewStatus, "CONFIRMED");
    assert.ok(
      (await IssueAuditLog.countDocuments({ issue: issue._id })) >= 3,
    );
    const buyer = await login(baseUrl, "buyer.b@stitchflow.demo");
    const buyerIssues = await request(baseUrl, buyer.body.accessToken, "/api/issues");
    const warnings = (await buyerIssues.json()).issues;
    assert.ok(warnings.some((warning) => warning.id === issueId));
    assert.equal(warnings.find((warning) => warning.id === issueId).originalNote, undefined);
  }, async () => classification);
});

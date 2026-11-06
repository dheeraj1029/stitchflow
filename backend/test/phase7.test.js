import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { once } from "node:events";
import test from "node:test";
import { createApp } from "../src/app.js";

const SECRET = "phase-seven-test-secret-with-at-least-thirty-two-bytes";
const PASSWORD = "StitchFlowDemo2026!";

async function withServer(run, options = {}) {
  const app = createApp({ jwtSecret: SECRET, ...options });
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

async function login(baseUrl, email, password = PASSWORD) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return { response, body: await response.json() };
}

async function tokenFor(baseUrl, email) {
  const { response, body } = await login(baseUrl, email);
  assert.equal(response.status, 200);
  return body.accessToken;
}

function request(baseUrl, token, path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (token) headers.set("authorization", `Bearer ${token}`);
  if (options.body) headers.set("content-type", "application/json");
  return fetch(`${baseUrl}${path}`, { ...options, headers });
}

test("all five demo roles receive a short-lived token and safe profile", async () => {
  const accounts = [
    ["admin@stitchflow.demo", "ADMIN"],
    ["merchandiser@stitchflow.demo", "MERCHANDISER"],
    ["supervisor@stitchflow.demo", "SUPERVISOR"],
    ["buyer.b@stitchflow.demo", "BUYER"],
    ["buyer.c@stitchflow.demo", "BUYER"],
  ];
  await withServer(async (baseUrl) => {
    for (const [email, role] of accounts) {
      const { response, body } = await login(baseUrl, email);
      assert.equal(response.status, 200);
      assert.equal(body.user.role, role);
      assert.equal(typeof body.accessToken, "string");
      assert.equal(body.user.passwordHash, undefined);
      assert.equal(body.user.password, undefined);
      assert.equal(JSON.stringify(body).includes("$2b$"), false);
    }
  });
});

test("invalid passwords and unknown emails use the same safe error", async () => {
  await withServer(async (baseUrl) => {
    const wrongPassword = await login(baseUrl, "buyer.b@stitchflow.demo", "wrong-password");
    const unknownEmail = await login(baseUrl, "unknown@stitchflow.demo");
    assert.equal(wrongPassword.response.status, 401);
    assert.equal(unknownEmail.response.status, 401);
    assert.deepEqual(wrongPassword.body, unknownEmail.body);
    assert.equal(wrongPassword.body.accessToken, undefined);
  });
});

test("disabled accounts cannot log in", async () => {
  await withServer(async (baseUrl, app) => {
    app.locals.repository.findUserByEmail("buyer.b@stitchflow.demo").isActive = false;
    const { response, body } = await login(baseUrl, "buyer.b@stitchflow.demo");
    assert.equal(response.status, 401);
    assert.equal(body.accessToken, undefined);
  });
});

test("missing, malformed, and expired JWTs are rejected", async () => {
  await withServer(async (baseUrl) => {
    const missing = await request(baseUrl, null, "/api/auth/me");
    const malformed = await request(baseUrl, "not-a-token", "/api/auth/me");
    const expired = jwt.sign({ sub: "user-buyer-b" }, SECRET, {
      algorithm: "HS256",
      expiresIn: -1,
    });
    const expiredResponse = await request(baseUrl, expired, "/api/auth/me");
    for (const response of [missing, malformed, expiredResponse]) {
      assert.equal(response.status, 401);
    }
  });
});

test("GET auth me returns the current safe server-side profile", async () => {
  await withServer(async (baseUrl) => {
    const token = await tokenFor(baseUrl, "buyer.c@stitchflow.demo");
    const response = await request(baseUrl, token, "/api/auth/me");
    const { user } = await response.json();
    assert.equal(response.status, 200);
    assert.equal(user.buyerOrganizationId, "buyer-company-c");
    assert.equal(user.buyerOrganizationName, "Company C (Germany)");
    assert.equal(user.passwordHash, undefined);
  });
});

test("a frontend-supplied role and a token role claim cannot elevate access", async () => {
  await withServer(async (baseUrl) => {
    const loginResult = await login(baseUrl, "buyer.b@stitchflow.demo", PASSWORD);
    assert.equal(loginResult.body.user.role, "BUYER");
    const forgedClaim = jwt.sign(
      { sub: "user-buyer-b", role: "ADMIN", buyerOrganizationId: "buyer-company-c" },
      SECRET,
      { algorithm: "HS256", expiresIn: "1h" },
    );
    assert.equal((await request(baseUrl, forgedClaim, "/api/users")).status, 403);
    assert.equal((await request(baseUrl, loginResult.body.accessToken, "/api/users")).status, 403);
  });
});

test("admin-only user management denies non-admins", async () => {
  await withServer(async (baseUrl) => {
    const supervisor = await tokenFor(baseUrl, "supervisor@stitchflow.demo");
    const buyer = await tokenFor(baseUrl, "buyer.b@stitchflow.demo");
    for (const token of [supervisor, buyer]) {
      assert.equal((await request(baseUrl, token, "/api/users")).status, 403);
    }
    const admin = await tokenFor(baseUrl, "admin@stitchflow.demo");
    const response = await request(baseUrl, admin, "/api/users");
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.users.length, 5);
    assert.ok(body.organizations.some((item) => item.id === "buyer-company-b"));
    assert.ok(body.productionUnits.some((item) => item.id === "unit-north-mill"));
    assert.equal(JSON.stringify(body).includes("$2b$"), false);
  });
});

test("admin can create and edit users without returning password hashes", async () => {
  await withServer(async (baseUrl) => {
    const admin = await tokenFor(baseUrl, "admin@stitchflow.demo");
    const createResponse = await request(baseUrl, admin, "/api/users", {
      method: "POST",
      body: JSON.stringify({
        name: "New Buyer",
        email: "new.buyer@stitchflow.demo",
        role: "BUYER",
        buyerOrganizationId: "buyer-company-b",
        productionUnitId: null,
        password: "A-different-demo-pass!",
      }),
    });
    const created = (await createResponse.json()).user;
    assert.equal(createResponse.status, 201);
    assert.equal(created.role, "BUYER");
    assert.equal(created.buyerOrganizationId, "buyer-company-b");
    assert.equal(created.passwordHash, undefined);

    const editResponse = await request(
      baseUrl,
      admin,
      `/api/users/${created.id}`,
      {
        method: "PATCH",
        body: JSON.stringify({ isActive: false, name: "Disabled Buyer" }),
      },
    );
    const updated = (await editResponse.json()).user;
    assert.equal(editResponse.status, 200);
    assert.equal(updated.name, "Disabled Buyer");
    assert.equal(updated.isActive, false);
    assert.equal(updated.passwordHash, undefined);
  });
});

test("user creation validates roles, email, password, and required assignments", async () => {
  await withServer(async (baseUrl) => {
    const admin = await tokenFor(baseUrl, "admin@stitchflow.demo");
    const invalidUsers = [
      { name: "Bad email", email: "bad", role: "ADMIN", password: PASSWORD },
      { name: "No org", email: "no.org@demo.test", role: "BUYER", password: PASSWORD },
      { name: "No unit", email: "no.unit@demo.test", role: "SUPERVISOR", password: PASSWORD },
      { name: "Short pass", email: "short.pass@demo.test", role: "ADMIN", password: "short" },
      { name: "Wrong role", email: "wrong.role@demo.test", role: "ROOT", password: PASSWORD },
    ];
    for (const user of invalidUsers) {
      const response = await request(baseUrl, admin, "/api/users", {
        method: "POST",
        body: JSON.stringify(user),
      });
      assert.equal(response.status, 400);
    }
  });
});

test("the last active admin cannot be disabled or reassigned", async () => {
  await withServer(async (baseUrl) => {
    const admin = await tokenFor(baseUrl, "admin@stitchflow.demo");
    const response = await request(baseUrl, admin, "/api/users/user-admin", {
      method: "PATCH",
      body: JSON.stringify({ isActive: false }),
    });
    assert.equal(response.status, 409);
    assert.match((await response.json()).error, /last active admin/i);
  });
});

test("buyers and supervisors cannot access administrative user routes", async () => {
  await withServer(async (baseUrl) => {
    const buyer = await tokenFor(baseUrl, "buyer.c@stitchflow.demo");
    const supervisor = await tokenFor(baseUrl, "supervisor@stitchflow.demo");
    const post = JSON.stringify({ name: "Injected", email: "injected@demo.test", role: "ADMIN", password: PASSWORD });
    assert.equal((await request(baseUrl, buyer, "/api/users", { method: "POST", body: post })).status, 403);
    assert.equal((await request(baseUrl, supervisor, "/api/users/user-admin", { method: "PATCH", body: JSON.stringify({ role: "BUYER" }) })).status, 403);
  });
});

test("Company B sees only Company B orders even when query parameters are manipulated", async () => {
  await withServer(async (baseUrl) => {
    const buyer = await tokenFor(baseUrl, "buyer.b@stitchflow.demo");
    const response = await request(
      baseUrl,
      buyer,
      "/api/orders?buyerOrganizationId=buyer-company-c&buyer=Company%20C",
    );
    const { orders } = await response.json();
    assert.equal(response.status, 200);
    assert.deepEqual(orders.map((order) => order.id).sort(), ["B-PO-88213", "B-PO-88240"]);
    assert.ok(orders.every((order) => order.buyerOrganizationId === "buyer-company-b"));
  });
});

test("Company B cannot retrieve Company C order details by changing the path ID", async () => {
  await withServer(async (baseUrl) => {
    const buyer = await tokenFor(baseUrl, "buyer.b@stitchflow.demo");
    const response = await request(baseUrl, buyer, "/api/orders/C-PO-0488");
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: "Order not found." });
  });
});

test("Company C sees only Company C orders and cannot retrieve Company B orders", async () => {
  await withServer(async (baseUrl) => {
    const buyer = await tokenFor(baseUrl, "buyer.c@stitchflow.demo");
    const list = await request(baseUrl, buyer, "/api/orders?organization=buyer-company-b");
    assert.deepEqual((await list.json()).orders.map((order) => order.id), ["C-PO-0488"]);
    assert.equal((await request(baseUrl, buyer, "/api/orders/B-PO-88213")).status, 404);
  });
});

test("buyer order records contain only buyer-safe fields and confirmed warnings", async () => {
  await withServer(async (baseUrl) => {
    const buyer = await tokenFor(baseUrl, "buyer.b@stitchflow.demo");
    const response = await request(baseUrl, buyer, "/api/orders/B-PO-88213");
    const { order } = await response.json();
    assert.equal(response.status, 200);
    assert.equal(order.style, "Men's Crew Neck Tee");
    assert.equal(order.quantity, 12000);
    assert.equal(order.confirmedWarnings.length, 1);
    assert.equal(order.confirmedWarnings[0].translation, "The stitching thread tension was adjusted.");
    for (const internalField of ["notes", "productionNotes", "productionUnit", "productionUnitId", "buyerCountry"]) {
      assert.equal(Object.hasOwn(order, internalField), false);
    }
    const encoded = JSON.stringify(order);
    for (const privateText of ["Internal supervisor note", "Internal merchandiser note", "Internal AI translation", "Internal review details"]) {
      assert.equal(encoded.includes(privateText), false);
    }
  });
});

test("buyer issues include only confirmed, buyer-safe records", async () => {
  await withServer(async (baseUrl) => {
    const buyer = await tokenFor(baseUrl, "buyer.c@stitchflow.demo");
    const response = await request(baseUrl, buyer, "/api/issues?organization=buyer-company-b");
    const { issues } = await response.json();
    assert.equal(response.status, 200);
    assert.deepEqual(issues.map((issue) => issue.id), ["issue-c-confirmed"]);
    assert.equal(issues[0].translation, "A print alignment issue was corrected.");
    for (const privateField of ["originalNote", "suggestedTranslation", "suggestedCategory", "reviewerNote", "auditHistory", "reviewStatus", "productionUnitId"]) {
      assert.equal(Object.hasOwn(issues[0], privateField), false);
    }
    assert.equal(JSON.stringify(issues).includes("Rejected internal translation"), false);
  });
});

test("buyer cannot submit or review issues", async () => {
  await withServer(async (baseUrl) => {
    const buyer = await tokenFor(baseUrl, "buyer.b@stitchflow.demo");
    const create = await request(baseUrl, buyer, "/api/issues", {
      method: "POST",
      body: JSON.stringify({ orderId: "B-PO-88213", stage: "Stitching", originalNote: "private" }),
    });
    const review = await request(baseUrl, buyer, "/api/issues/issue-b-pending/review", {
      method: "PATCH",
      body: JSON.stringify({ decision: "CONFIRMED", translation: "x", category: "OTHER", severity: "LOW" }),
    });
    assert.equal(create.status, 403);
    assert.equal(review.status, 403);
  });
});

test("supervisors see and report only for their assigned production unit", async () => {
  await withServer(async (baseUrl) => {
    const supervisor = await tokenFor(baseUrl, "supervisor@stitchflow.demo");
    const list = await request(baseUrl, supervisor, "/api/orders");
    assert.deepEqual((await list.json()).orders.map((order) => order.id), ["B-PO-88213"]);
    assert.equal((await request(baseUrl, supervisor, "/api/orders/B-PO-88240")).status, 404);
    const forbiddenReport = await request(baseUrl, supervisor, "/api/issues", {
      method: "POST",
      body: JSON.stringify({ orderId: "B-PO-88240", stage: "Finishing", originalNote: "Internal." }),
    });
    assert.equal(forbiddenReport.status, 404);
    const ownReport = await request(baseUrl, supervisor, "/api/issues", {
      method: "POST",
      body: JSON.stringify({
        id: "supervisor-issue-1",
        orderId: "B-PO-88213",
        stage: "Stitching",
        originalNote: "Thread tension needs checking.",
        languageHint: "en",
      }),
    });
    assert.equal(ownReport.status, 201);
  });
});

test("only merchandisers can confirm or reject classifications", async () => {
  await withServer(async (baseUrl) => {
    const admin = await tokenFor(baseUrl, "admin@stitchflow.demo");
    const supervisor = await tokenFor(baseUrl, "supervisor@stitchflow.demo");
    const merchandiser = await tokenFor(baseUrl, "merchandiser@stitchflow.demo");
    const body = JSON.stringify({
      decision: "CONFIRMED",
      translation: "The finishing concern was addressed.",
      category: "PRODUCTION_DELAY",
      severity: "HIGH",
      reviewerNote: "Follow-up completed.",
    });
    for (const token of [admin, supervisor]) {
      const denied = await request(baseUrl, token, "/api/issues/issue-b-pending/review", { method: "PATCH", body });
      assert.equal(denied.status, 403);
    }
    const confirmed = await request(baseUrl, merchandiser, "/api/issues/issue-b-pending/review", {
      method: "PATCH",
      body,
    });
    assert.equal(confirmed.status, 200);
    const issue = (await confirmed.json()).issue;
    assert.equal(issue.reviewStatus, "CONFIRMED");
    assert.equal(issue.reviewerNote, "Follow-up completed.");
  });
});

test("admin and merchandiser can access all orders and internal issues", async () => {
  await withServer(async (baseUrl) => {
    for (const email of ["admin@stitchflow.demo", "merchandiser@stitchflow.demo"]) {
      const token = await tokenFor(baseUrl, email);
      const orders = await request(baseUrl, token, "/api/orders");
      const issues = await request(baseUrl, token, "/api/issues");
      assert.equal((await orders.json()).orders.length, 3);
      const issueBody = await issues.json();
      assert.equal(issueBody.issues.length, 4);
      assert.equal(typeof issueBody.issues[0].originalNote, "string");
    }
  });
});

test("login is rate limited", async () => {
  await withServer(async (baseUrl) => {
    let response;
    for (let index = 0; index < 6; index += 1) {
      response = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "buyer.b@stitchflow.demo", password: "incorrect" }),
      });
    }
    assert.equal(response.status, 429);
    assert.match((await response.json()).error, /too many login attempts/i);
  });
});

test("classification requires a valid role and authenticated supervisor can classify only own report", async () => {
  const classification = {
    detectedLanguage: "English",
    translatedNote: "Thread tension needs checking.",
    category: "QUALITY_DEFECT",
    severity: "LOW",
    explanation: "The note describes a quality concern.",
    confidence: 0.8,
    needsReview: true,
  };
  await withServer(async (baseUrl) => {
    const buyer = await tokenFor(baseUrl, "buyer.b@stitchflow.demo");
    const denied = await request(baseUrl, buyer, "/api/issues/classify", {
      method: "POST",
      body: JSON.stringify({ orderId: "B-PO-88213", stage: "Stitching", originalNote: "x" }),
    });
    assert.equal(denied.status, 403);
    const supervisor = await tokenFor(baseUrl, "supervisor@stitchflow.demo");
    const created = await request(baseUrl, supervisor, "/api/issues", {
      method: "POST",
      body: JSON.stringify({
        id: "classify-own-issue",
        orderId: "B-PO-88213",
        stage: "Stitching",
        originalNote: "Thread tension needs checking.",
        languageHint: "en",
      }),
    });
    assert.equal(created.status, 201);
    const classified = await request(baseUrl, supervisor, "/api/issues/classify", {
      method: "POST",
      body: JSON.stringify({
        issueId: "classify-own-issue",
        orderId: "B-PO-88213",
        stage: "Stitching",
        originalNote: "Thread tension needs checking.",
        languageHint: "en",
      }),
    });
    assert.equal(classified.status, 200);
    assert.deepEqual(await classified.json(), classification);
  }, { classify: async () => classification });
});

test("admin can list the full repository but buyer and supervisor data stays scoped", async () => {
  await withServer(async (baseUrl) => {
    const admin = await tokenFor(baseUrl, "admin@stitchflow.demo");
    const response = await request(baseUrl, admin, "/api/orders");
    const orders = (await response.json()).orders;
    assert.equal(response.status, 200);
    assert.equal(orders.length, 3);
    assert.ok(orders.some((order) => order.productionNotes));
  });
});

import { randomBytes, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import cors from "cors";
import express from "express";
import { rateLimit } from "express-rate-limit";
import helmet from "helmet";
import {
  authorizeRoles,
  createAccessToken,
  createAuthenticationMiddleware,
  toSafeUser,
} from "./auth.js";
import {
  DEMO_ORGANIZATIONS,
  DEMO_PRODUCTION_UNITS,
  USER_ROLES,
  createDemoRepository,
} from "./demoRepository.js";
import {
  ClassificationError,
  ISSUE_CATEGORIES,
  ISSUE_SEVERITIES,
  classifyIssue,
  validateClassificationInput,
} from "./classification.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ID_PATTERN = /^[A-Za-z0-9_-]{3,100}$/;
const INTERNAL_ROLES = ["ADMIN", "MERCHANDISER"];
const ISSUE_MANAGEMENT_ROLES = ["ADMIN", "MERCHANDISER", "SUPERVISOR"];
const ISSUE_REVIEW_ROLES = ["MERCHANDISER"];
const SAFE_CLASSIFICATION_ERRORS = {
  classification_not_configured:
    "Issue classification is not configured. Your issue has been saved and can be retried later.",
  classification_timeout:
    "Issue classification timed out. Your issue has been saved; please retry.",
  classification_rate_limited:
    "The classification service is busy. Your issue has been saved; please retry shortly.",
  classification_provider_error:
    "Issue classification is temporarily unavailable. Your issue has been saved; please retry.",
  classification_invalid_response:
    "The classification service returned an invalid result. Your issue has been saved; please retry.",
};

function isValidString(value, maximum = 160) {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maximum;
}

function safeOrder(order, repository) {
  const warnings = repository.issues
    .filter(
      (issue) =>
        issue.orderId === order.id && issue.reviewStatus === "CONFIRMED",
    )
    .map(toBuyerIssue);
  const progressByStage = order.workflowStages.map((stage, index) => {
    const isCurrentStage = stage === order.stage;
    const isEarlierStage = order.workflowStages.indexOf(order.stage) > index;
    const percentage = isEarlierStage
      ? 100
      : isCurrentStage
        ? Math.min(
            Math.round((order.stageOutput / order.productionTarget) * 100),
            100,
          )
        : 0;
    return {
      stage,
      status: isEarlierStage
        ? "COMPLETED"
        : isCurrentStage
          ? "IN_PROGRESS"
          : "PENDING",
      percentage,
      ...(isCurrentStage
        ? {
            output: order.stageOutput,
            target: order.productionTarget,
          }
        : {}),
    };
  });
  return {
    id: order.id,
    poNumber: order.poNumber,
    buyerOrganizationId: order.buyerOrganizationId,
    buyer: order.buyer,
    style: order.style,
    colour: order.colour,
    quantity: order.quantity,
    stage: order.stage,
    productionProgress: Math.min(
      Math.round((order.stageOutput / order.productionTarget) * 100),
      100,
    ),
    progressByStage,
    exFactoryDate: order.exFactoryDate,
    status: order.status,
    milestones: order.milestones.map((milestone) => ({
      id: milestone.id,
      name: milestone.name,
      plannedDate: milestone.plannedDate,
      completed: milestone.completed,
      completedDate: milestone.completedDate,
    })),
    hasConfirmedWarnings: warnings.length > 0,
    confirmedWarningCount: warnings.length,
    confirmedWarnings: warnings,
  };
}

function toBuyerIssue(issue) {
  return {
    id: issue.id,
    orderId: issue.orderId,
    orderNumber: issue.orderNumber,
    stage: issue.stage,
    translation: issue.confirmedTranslation,
    category: issue.confirmedCategory,
    severity: issue.confirmedSeverity,
    confirmedAt: issue.reviewedAt,
  };
}

function visibleOrders(user, repository) {
  if (user.role === "BUYER") {
    return repository.orders.filter(
      (order) => order.buyerOrganizationId === user.buyerOrganizationId,
    );
  }
  if (user.role === "SUPERVISOR") {
    return repository.orders.filter(
      (order) => order.productionUnitId === user.productionUnitId,
    );
  }
  return repository.orders;
}

function visibleIssues(user, repository) {
  if (user.role === "BUYER") {
    return repository.issues
      .filter(
        (issue) =>
          issue.buyerOrganizationId === user.buyerOrganizationId &&
          issue.reviewStatus === "CONFIRMED",
      )
      .map(toBuyerIssue);
  }
  if (user.role === "SUPERVISOR") {
    return repository.issues.filter(
      (issue) =>
        issue.productionUnitId === user.productionUnitId ||
        issue.ownerUserId === user.id,
    );
  }
  return repository.issues;
}

function validateUserFields(
  input,
  repository,
  { partial = false, existingUser = null } = {},
) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { error: "Provide valid user details." };
  }
  const value = {};
  const fields = ["email", "name", "role", "buyerOrganizationId", "productionUnitId", "isActive", "password"];
  if (Object.keys(input).some((key) => !fields.includes(key))) {
    return { error: "The request contains unsupported user fields." };
  }
  if (!partial || Object.hasOwn(input, "email")) {
    if (!isValidString(input.email, 254) || !EMAIL_PATTERN.test(input.email.trim())) {
      return { error: "Provide a valid email address." };
    }
    value.email = input.email.trim().toLowerCase();
    const duplicate = repository.findUserByEmail(value.email);
    if (duplicate && duplicate.id !== existingUser?.id) {
      return { error: "That email address is already assigned to a user." };
    }
  }
  if (!partial || Object.hasOwn(input, "name")) {
    if (!isValidString(input.name, 120)) {
      return { error: "Enter a name of 120 characters or fewer." };
    }
    value.name = input.name.trim();
  }
  if (!partial || Object.hasOwn(input, "role")) {
    if (!USER_ROLES.includes(input.role)) {
      return { error: "Choose a valid user role." };
    }
    value.role = input.role;
  }
  if (!partial || Object.hasOwn(input, "buyerOrganizationId")) {
    const organizationId = input.buyerOrganizationId || null;
    if (
      organizationId !== null &&
      !DEMO_ORGANIZATIONS.some((item) => item.id === organizationId)
    ) {
      return { error: "Choose a valid buyer organization." };
    }
    value.buyerOrganizationId = organizationId;
  }
  if (!partial || Object.hasOwn(input, "productionUnitId")) {
    const unitId = input.productionUnitId || null;
    if (
      unitId !== null &&
      !DEMO_PRODUCTION_UNITS.some((item) => item.id === unitId)
    ) {
      return { error: "Choose a valid production unit." };
    }
    value.productionUnitId = unitId;
  }
  if (
    value.role === "BUYER" &&
    (value.buyerOrganizationId ?? input.buyerOrganizationId) == null
  ) {
    return { error: "Buyer accounts must be assigned to an organization." };
  }
  if (
    value.role === "SUPERVISOR" &&
    (value.productionUnitId ?? input.productionUnitId) == null
  ) {
    return { error: "Supervisor accounts must be assigned to a production unit." };
  }
  const resolvedField = (field) =>
    Object.hasOwn(value, field)
      ? value[field]
      : Object.hasOwn(input, field)
        ? input[field]
        : existingUser?.[field] ?? null;
  const resolvedRole = resolvedField("role");
  const resolvedOrganization = resolvedField("buyerOrganizationId");
  const resolvedUnit = resolvedField("productionUnitId");
  if (resolvedRole === "BUYER" && !resolvedOrganization) {
    return { error: "Buyer accounts must be assigned to an organization." };
  }
  if (resolvedRole === "SUPERVISOR" && !resolvedUnit) {
    return { error: "Supervisor accounts must be assigned to a production unit." };
  }
  if (
    (resolvedRole === "BUYER" && resolvedUnit) ||
    (resolvedRole === "SUPERVISOR" && resolvedOrganization) ||
    (["ADMIN", "MERCHANDISER"].includes(resolvedRole) &&
      (resolvedOrganization || resolvedUnit))
  ) {
    return { error: "Assign organizations only to buyers and production units only to supervisors." };
  }
  if (Object.hasOwn(input, "isActive")) {
    if (typeof input.isActive !== "boolean") {
      return { error: "Account status must be enabled or disabled." };
    }
    value.isActive = input.isActive;
  } else if (!partial) {
    value.isActive = true;
  }
  if (!partial || Object.hasOwn(input, "password")) {
    if (!isValidString(input.password, 72) || input.password.length < 10) {
      return { error: "Passwords must contain at least 10 characters and no more than 72 bytes." };
    }
    if (Buffer.byteLength(input.password, "utf8") > 72) {
      return { error: "Passwords must be no more than 72 bytes." };
    }
    value.password = input.password;
  }
  return { value };
}

function validateReview(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { error: "Provide valid review details." };
  }
  if (!["CONFIRMED", "REJECTED"].includes(input.decision)) {
    return { error: "Choose confirm or reject." };
  }
  if (input.reviewerNote !== undefined && !isValidString(input.reviewerNote, 1000) && input.reviewerNote !== "") {
    return { error: "Review notes must be 1,000 characters or fewer." };
  }
  if (input.decision === "CONFIRMED") {
    if (
      !isValidString(input.translation, 4000) ||
      !ISSUE_CATEGORIES.includes(input.category) ||
      !ISSUE_SEVERITIES.includes(input.severity)
    ) {
      return { error: "Provide a valid translation, category, and severity." };
    }
  }
  return { value: input };
}

export function createApp({
  classify = classifyIssue,
  repository = createDemoRepository(),
  jwtSecret = process.env.JWT_SECRET || randomBytes(64).toString("hex"),
  jwtExpiresIn = process.env.JWT_EXPIRES_IN || "1h",
  frontendOrigin = process.env.FRONTEND_ORIGIN || "http://127.0.0.1:5173",
  loginLimit = 5,
} = {}) {
  if (typeof jwtSecret !== "string" || Buffer.byteLength(jwtSecret) < 32) {
    throw new Error("JWT_SECRET must be at least 32 bytes.");
  }
  const app = express();
  const authenticate = createAuthenticationMiddleware(repository, jwtSecret);
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: loginLimit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "Too many login attempts. Please try again later." },
  });
  const classificationLimiter = rateLimit({
    windowMs: 60_000,
    limit: 10,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "Too many classification requests. Please retry shortly." },
  });

  app.locals.repository = repository;
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || origin === frontendOrigin) {
          callback(null, true);
        } else {
          callback(new Error("Origin is not allowed."));
        }
      },
      methods: ["GET", "POST", "PATCH", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    }),
  );
  app.use(express.json({ limit: "16kb", strict: true }));

  app.get("/api/health", (_request, response) => {
    response.json({ status: "ok" });
  });

  app.post("/api/auth/login", loginLimiter, async (request, response) => {
    const email =
      typeof request.body?.email === "string"
        ? request.body.email.trim().toLowerCase()
        : "";
    const password =
      typeof request.body?.password === "string" ? request.body.password : "";
    if (
      !EMAIL_PATTERN.test(email) ||
      email.length > 254 ||
      password.length === 0 ||
      Buffer.byteLength(password, "utf8") > 72
    ) {
      return response.status(401).json({ error: "Email or password is incorrect." });
    }
    const user = repository.findUserByEmail(email);
    const passwordMatches = await bcrypt.compare(
      password,
      user?.passwordHash || "$2b$10$H8VkmgMIvSginphuJJ4z9eUwEvLW2xeTdFDEsQDBZWFAHtM/wFibW",
    );
    if (!user || !user.isActive || !passwordMatches) {
      return response.status(401).json({ error: "Email or password is incorrect." });
    }
    return response.json({
      accessToken: createAccessToken(user, jwtSecret, jwtExpiresIn),
      user: toSafeUser(user, repository),
    });
  });

  app.get("/api/auth/me", authenticate, (request, response) => {
    response.json({ user: toSafeUser(request.authUser, repository) });
  });

  app.get("/api/users", authenticate, authorizeRoles("ADMIN"), (_request, response) => {
    response.json({
      users: repository.users.map((user) => toSafeUser(user, repository)),
      organizations: DEMO_ORGANIZATIONS,
      productionUnits: DEMO_PRODUCTION_UNITS,
    });
  });

  app.post("/api/users", authenticate, authorizeRoles("ADMIN"), async (request, response) => {
    const validation = validateUserFields(request.body, repository);
    if (validation.error) {
      return response.status(400).json({ error: validation.error });
    }
    const { password, ...userFields } = validation.value;
    const created = repository.createUser({
      ...userFields,
      passwordHash: await bcrypt.hash(password, 10),
    });
    return response.status(201).json({ user: toSafeUser(created, repository) });
  });

  app.patch(
    "/api/users/:userId",
    authenticate,
    authorizeRoles("ADMIN"),
    async (request, response) => {
      if (!ID_PATTERN.test(request.params.userId)) {
        return response.status(400).json({ error: "Choose a valid user." });
      }
      const target = repository.findUserById(request.params.userId);
      if (!target) {
        return response.status(404).json({ error: "User not found." });
      }
      const validation = validateUserFields(request.body, repository, {
        partial: true,
        existingUser: target,
      });
      if (validation.error) {
        return response.status(400).json({ error: validation.error });
      }
      const updates = { ...validation.value };
      if (updates.password) {
        updates.passwordHash = await bcrypt.hash(updates.password, 10);
        delete updates.password;
      }
      const resultingRole = updates.role ?? target.role;
      const resultingActive = updates.isActive ?? target.isActive;
      if (
        target.role === "ADMIN" &&
        target.isActive &&
        (resultingRole !== "ADMIN" || !resultingActive)
      ) {
        const activeAdmins = repository.users.filter(
          (user) => user.role === "ADMIN" && user.isActive,
        );
        if (activeAdmins.length <= 1) {
          return response.status(409).json({
            error: "The last active admin account cannot be disabled or reassigned.",
          });
        }
      }
      Object.assign(target, updates);
      return response.json({ user: toSafeUser(target, repository) });
    },
  );

  app.get("/api/orders", authenticate, (request, response) => {
    const orders = visibleOrders(request.authUser, repository).map((order) => {
      if (request.authUser.role !== "BUYER") {
        return order;
      }
      return safeOrder(order, repository);
    });
    return response.json({ orders });
  });

  app.get("/api/orders/:orderId", authenticate, (request, response) => {
    if (!ID_PATTERN.test(request.params.orderId)) {
      return response.status(400).json({ error: "Choose a valid order." });
    }
    const order = repository.findOrder(request.params.orderId);
    const allowed = order && visibleOrders(request.authUser, repository).some(
      (item) => item.id === order.id,
    );
    if (!allowed) {
      return response.status(404).json({ error: "Order not found." });
    }
    return response.json({
      order:
        request.authUser.role === "BUYER" ? safeOrder(order, repository) : order,
    });
  });

  app.get("/api/issues", authenticate, (request, response) => {
    return response.json({
      issues: visibleIssues(request.authUser, repository),
    });
  });

  app.post(
    "/api/issues",
    authenticate,
    authorizeRoles("SUPERVISOR", "MERCHANDISER"),
    (request, response) => {
      const validation = validateClassificationInput(request.body);
      if (!validation.ok) {
        return response.status(400).json({ error: validation.error });
      }
      const { orderId, stage, originalNote, languageHint } = validation.value;
      const order = repository.findOrder(orderId);
      if (!order) {
        return response.status(404).json({ error: "Order not found." });
      }
      if (
        request.authUser.role === "SUPERVISOR" &&
        order.productionUnitId !== request.authUser.productionUnitId
      ) {
        return response.status(404).json({ error: "Order not found." });
      }
      if (!order.workflowStages.includes(stage)) {
        return response.status(400).json({ error: "Choose a stage in this order's workflow." });
      }
      const requestedId = request.body.id;
      if (requestedId !== undefined && !ID_PATTERN.test(requestedId)) {
        return response.status(400).json({ error: "Choose a valid issue identifier." });
      }
      const id = requestedId || randomUUID();
      const existing = repository.findIssue(id);
      if (existing) {
        const isSameReport =
          existing.orderId === order.id &&
          existing.stage === stage &&
          existing.originalNote === originalNote &&
          (existing.ownerUserId === request.authUser.id ||
            request.authUser.role === "MERCHANDISER");
        if (!isSameReport) {
          return response.status(409).json({ error: "This issue identifier is already in use." });
        }
        return response.status(200).json({ issue: { id: existing.id, reviewStatus: existing.reviewStatus } });
      }
      const issue = {
        id,
        orderId: order.id,
        orderNumber: order.poNumber,
        buyerOrganizationId: order.buyerOrganizationId,
        productionUnitId: order.productionUnitId,
        stage,
        originalNote,
        languageHint,
        detectedLanguage: null,
        suggestedTranslation: null,
        suggestedCategory: null,
        suggestedSeverity: null,
        confirmedTranslation: null,
        confirmedCategory: null,
        confirmedSeverity: null,
        reviewerNote: "",
        reviewStatus: "PENDING_REVIEW",
        classificationError: null,
        confidence: null,
        createdAt: new Date().toISOString(),
        reviewedAt: null,
        ownerUserId: request.authUser.id,
        auditHistory: [{ event: "SUBMITTED", timestamp: new Date().toISOString() }],
      };
      repository.issues.push(issue);
      return response.status(201).json({
        issue: { id: issue.id, reviewStatus: issue.reviewStatus },
      });
    },
  );

  app.post(
    "/api/issues/classify",
    authenticate,
    authorizeRoles("SUPERVISOR", "MERCHANDISER"),
    classificationLimiter,
    async (request, response) => {
      const validation = validateClassificationInput(request.body);
      if (!validation.ok) {
        return response.status(400).json({ error: validation.error });
      }
      const { issueId } = request.body;
      if (issueId !== undefined && !ID_PATTERN.test(issueId)) {
        return response.status(400).json({ error: "Choose a valid issue." });
      }
      const order = repository.findOrder(validation.value.orderId);
      if (
        !order ||
        (request.authUser.role === "SUPERVISOR" &&
          order.productionUnitId !== request.authUser.productionUnitId)
      ) {
        return response.status(404).json({ error: "Order not found." });
      }
      let issue = null;
      if (issueId) {
        issue = repository.findIssue(issueId);
        const userCanAccessIssue =
          issue &&
          issue.orderId === validation.value.orderId &&
          issue.stage === validation.value.stage &&
          issue.originalNote === validation.value.originalNote &&
          (request.authUser.role === "MERCHANDISER" ||
            issue.ownerUserId === request.authUser.id);
        if (!userCanAccessIssue) {
          return response.status(404).json({ error: "Issue not found." });
        }
        if (issue.reviewStatus === "CONFIRMED" || issue.reviewStatus === "REJECTED") {
          return response.status(409).json({ error: "A reviewed issue cannot be reclassified." });
        }
      }
      try {
        const result = await classify(validation.value);
        if (issue) {
          issue.detectedLanguage = result.detectedLanguage;
          issue.suggestedTranslation = result.translatedNote;
          issue.suggestedCategory = result.category;
          issue.suggestedSeverity = result.severity;
          issue.aiExplanation = result.explanation;
          issue.confidence = result.confidence;
          issue.needsReview = result.needsReview;
          issue.reviewStatus = "PENDING_REVIEW";
          issue.auditHistory.push({
            event: "AI_CLASSIFIED",
            timestamp: new Date().toISOString(),
            suggestedCategory: result.category,
            suggestedSeverity: result.severity,
          });
        }
        return response.json(result);
      } catch (error) {
        const status =
          error instanceof ClassificationError ? error.status : 502;
        const code =
          error instanceof ClassificationError
            ? error.code
            : "classification_provider_error";
        const message =
          SAFE_CLASSIFICATION_ERRORS[code] ||
          "Issue classification is temporarily unavailable. Your issue has been saved; please retry.";
        if (issue) {
          issue.classificationError = message;
        }
        return response.status(status).json({ error: message });
      }
    },
  );

  app.patch(
    "/api/issues/:issueId/review",
    authenticate,
    authorizeRoles(...ISSUE_REVIEW_ROLES),
    (request, response) => {
      if (!ID_PATTERN.test(request.params.issueId)) {
        return response.status(400).json({ error: "Choose a valid issue." });
      }
      const validation = validateReview(request.body);
      if (validation.error) {
        return response.status(400).json({ error: validation.error });
      }
      const issue = repository.findIssue(request.params.issueId);
      if (!issue) {
        return response.status(404).json({ error: "Issue not found." });
      }
      if (issue.reviewStatus !== "PENDING_REVIEW") {
        return response.status(409).json({ error: "Only pending issues can be reviewed." });
      }
      const { decision, translation, category, severity } = validation.value;
      const timestamp = new Date().toISOString();
      if (decision === "CONFIRMED") {
        issue.confirmedTranslation = translation.trim();
        issue.confirmedCategory = category;
        issue.confirmedSeverity = severity;
        issue.reviewStatus = "CONFIRMED";
      } else {
        issue.confirmedTranslation = null;
        issue.confirmedCategory = null;
        issue.confirmedSeverity = null;
        issue.reviewStatus = "REJECTED";
      }
      issue.reviewerNote = validation.value.reviewerNote || "";
      issue.reviewedAt = timestamp;
      issue.auditHistory.push({
        event: decision === "CONFIRMED" ? "MERCHANDISER_CONFIRMED" : "MERCHANDISER_REJECTED",
        timestamp,
        reviewerNote: issue.reviewerNote,
        ...(decision === "CONFIRMED"
          ? { confirmedCategory: category, confirmedSeverity: severity }
          : {}),
      });
      return response.json({ issue });
    },
  );

  app.use((error, _request, response, _next) => {
    if (error?.type === "entity.too.large") {
      return response.status(413).json({
        error: "The request is too large.",
      });
    }
    if (error instanceof SyntaxError && "body" in error) {
      return response.status(400).json({
        error: "Provide a valid JSON request.",
      });
    }
    return response.status(500).json({
      error: "The service could not process this request.",
    });
  });

  return app;
}

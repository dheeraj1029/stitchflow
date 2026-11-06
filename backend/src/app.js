import express from "express";
import { rateLimit } from "express-rate-limit";
import {
  ClassificationError,
  classifyIssue,
  validateClassificationInput,
} from "./classification.js";

const ERROR_MESSAGES = {
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

export function createApp({ classify = classifyIssue } = {}) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "16kb", strict: true }));

  app.get("/api/health", (_request, response) => {
    response.json({ status: "ok" });
  });

  app.post(
    "/api/issues/classify",
    rateLimit({
      windowMs: 60_000,
      limit: 10,
      standardHeaders: "draft-7",
      legacyHeaders: false,
      message: { error: "Too many classification requests. Please retry shortly." },
    }),
    async (request, response) => {
      const validation = validateClassificationInput(request.body);
      if (!validation.ok) {
        return response.status(400).json({ error: validation.error });
      }
      try {
        const result = await classify(validation.value);
        return response.json(result);
      } catch (error) {
        const status =
          error instanceof ClassificationError
            ? error.status
            : 502;
        const code =
          error instanceof ClassificationError
            ? error.code
            : "classification_provider_error";
        const message =
          ERROR_MESSAGES[code] ||
          "Issue classification is temporarily unavailable. Your issue has been saved; please retry.";
        return response.status(status).json({ error: message });
      }
    },
  );

  app.use((error, _request, response, _next) => {
    if (error?.type === "entity.too.large") {
      return response.status(413).json({
        error: "The issue report request is too large.",
      });
    }
    if (error instanceof SyntaxError && "body" in error) {
      return response.status(400).json({
        error: "Provide a valid JSON issue report.",
      });
    }
    return response.status(500).json({
      error: "The issue service could not process this request.",
    });
  });

  return app;
}

import "dotenv/config";
import { createApp } from "./app.js";
import { closeDatabase, connectDatabase } from "./config/database.js";

function readConfig(environment = process.env) {
  const port = environment.PORT === undefined ? 3001 : Number(environment.PORT);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535.");
  }
  if (!environment.MONGODB_URI?.trim()) {
    throw new Error("MONGODB_URI is required before the API can start.");
  }
  if (!/^(mongodb|mongodb\+srv):\/\//.test(environment.MONGODB_URI)) {
    throw new Error("MONGODB_URI must use the mongodb:// or mongodb+srv:// scheme.");
  }
  if (!environment.JWT_SECRET || Buffer.byteLength(environment.JWT_SECRET) < 32) {
    throw new Error("JWT_SECRET must be configured with at least 32 bytes.");
  }
  const frontendUrl = environment.FRONTEND_URL || "http://127.0.0.1:5173";
  try {
    new URL(frontendUrl);
  } catch {
    throw new Error("FRONTEND_URL must be a valid URL.");
  }
  return { port, frontendUrl };
}

async function start() {
  const { port, frontendUrl } = readConfig();
  await connectDatabase();
  const app = createApp({ frontendOrigin: frontendUrl });
  const server = app.listen(port, "127.0.0.1", () => {
    console.info(`StitchFlow API listening on 127.0.0.1:${port}; MongoDB is ready.`);
  });
  let stopping = false;
  const stop = (signal) => {
    if (stopping) return;
    stopping = true;
    console.info(`Received ${signal}; closing StitchFlow API.`);
    server.close(async (error) => {
      try {
        await closeDatabase();
      } catch {
        console.error("MongoDB disconnect failed during shutdown.");
        process.exitCode = 1;
      }
      if (error) {
        console.error("API server shutdown failed.");
        process.exitCode = 1;
      }
    });
  };
  process.once("SIGINT", () => stop("SIGINT"));
  process.once("SIGTERM", () => stop("SIGTERM"));
}

start().catch(async (error) => {
  console.error(error.message || "StitchFlow API could not start.");
  await closeDatabase().catch(() => {
    console.error("MongoDB cleanup failed after startup error.");
  });
  process.exitCode = 1;
});

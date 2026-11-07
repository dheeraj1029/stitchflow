import "dotenv/config";
import { createApp } from "./app.js";
import { closeDatabase, connectDatabase } from "./config/database.js";
import { readServerConfig } from "./config/server.js";

async function start() {
  const { port, host, frontendOrigin } = readServerConfig();
  await connectDatabase();
  const app = createApp({ frontendOrigin });
  const server = app.listen(port, host, () => {
    console.info(`StitchFlow API listening on ${host}:${port}; MongoDB is ready.`);
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

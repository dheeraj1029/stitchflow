export function readServerConfig(environment = process.env) {
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

  const configuredHost = environment.HOST?.trim();
  const host =
    configuredHost ||
    (environment.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1");
  if (/\s/.test(host)) {
    throw new Error("HOST must be a valid interface or hostname.");
  }

  const frontendUrl = environment.FRONTEND_URL || "http://127.0.0.1:5173";
  let frontendOrigin;
  try {
    const parsedUrl = new URL(frontendUrl);
    if (
      !["http:", "https:"].includes(parsedUrl.protocol) ||
      parsedUrl.username ||
      parsedUrl.password ||
      parsedUrl.pathname !== "/" ||
      parsedUrl.search ||
      parsedUrl.hash
    ) {
      throw new Error();
    }
    frontendOrigin = parsedUrl.origin;
  } catch {
    throw new Error("FRONTEND_URL must be an HTTP(S) origin without a path.");
  }

  return { port, host, frontendOrigin };
}

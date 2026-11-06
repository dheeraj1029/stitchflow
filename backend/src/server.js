import "dotenv/config";
import { createApp } from "./app.js";

const portValue = process.env.PORT === undefined ? 3001 : Number(process.env.PORT);
if (!Number.isInteger(portValue) || portValue <= 0 || portValue > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535.");
}
if (!process.env.JWT_SECRET) {
  console.warn("JWT_SECRET is not set; a random, process-only development secret will be used.");
}
const app = createApp();

app.listen(portValue, "127.0.0.1", () => {
  console.info(`StitchFlow demo API listening on 127.0.0.1:${portValue}`);
});

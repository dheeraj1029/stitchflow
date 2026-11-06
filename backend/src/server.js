import "dotenv/config";
import { createApp } from "./app.js";

const portValue = Number(process.env.PORT || 3001);
const port =
  Number.isInteger(portValue) && portValue > 0 && portValue <= 65535
    ? portValue
    : 3001;

createApp().listen(port, "127.0.0.1", () => {
  console.info(`StitchFlow issue API listening on 127.0.0.1:${port}`);
});

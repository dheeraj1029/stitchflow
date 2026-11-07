import assert from "node:assert/strict";
import test from "node:test";
import { readServerConfig } from "../src/config/server.js";

const validEnvironment = {
  MONGODB_URI: "mongodb://127.0.0.1:27017/stitchflow?replicaSet=rs0",
  JWT_SECRET: "server-config-test-secret-with-at-least-thirty-two-bytes",
};

test("server configuration defaults to loopback locally and an interface in production", () => {
  assert.deepEqual(readServerConfig(validEnvironment), {
    port: 3001,
    host: "127.0.0.1",
    frontendOrigin: "http://127.0.0.1:5173",
  });
  assert.deepEqual(
    readServerConfig({
      ...validEnvironment,
      NODE_ENV: "production",
      FRONTEND_URL: "https://stitchflow.example/",
    }),
    {
      port: 3001,
      host: "0.0.0.0",
      frontendOrigin: "https://stitchflow.example",
    },
  );
});

test("server configuration honors explicit host and port", () => {
  assert.deepEqual(
    readServerConfig({
      ...validEnvironment,
      HOST: "127.0.0.2",
      PORT: "3100",
      FRONTEND_URL: "http://localhost:5173",
    }),
    {
      port: 3100,
      host: "127.0.0.2",
      frontendOrigin: "http://localhost:5173",
    },
  );
});

test("server configuration rejects unsafe or incomplete deployment values", () => {
  for (const environment of [
    { ...validEnvironment, PORT: "70000" },
    { ...validEnvironment, HOST: "0.0.0.0 local" },
    { ...validEnvironment, FRONTEND_URL: "https://example.test/app" },
    { ...validEnvironment, FRONTEND_URL: "javascript:alert(1)" },
    { ...validEnvironment, JWT_SECRET: "too-short" },
    { ...validEnvironment, MONGODB_URI: "https://example.test" },
  ]) {
    assert.throws(() => readServerConfig(environment));
  }
});

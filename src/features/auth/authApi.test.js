import assert from "node:assert/strict";
import test from "node:test";
import {
  apiRequest,
  getAccessTokenForTests,
  setAccessToken,
  setUnauthorizedHandler,
} from "./authApi.js";

test("API client attaches the in-memory token and clears it after 401", async () => {
  const originalFetch = globalThis.fetch;
  let observedAuthorization = "";
  let unauthorizedCount = 0;
  setAccessToken("memory-only-access-token");
  setUnauthorizedHandler(() => {
    unauthorizedCount += 1;
    setAccessToken(null);
  });
  globalThis.fetch = async (_path, options) => {
    observedAuthorization = options.headers.get("Authorization");
    return new Response(JSON.stringify({ error: "Expired." }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  };
  try {
    await assert.rejects(apiRequest("/api/auth/me"), /Expired/);
    assert.equal(observedAuthorization, "Bearer memory-only-access-token");
    assert.equal(unauthorizedCount, 1);
    assert.equal(getAccessTokenForTests(), null);
  } finally {
    globalThis.fetch = originalFetch;
    setAccessToken(null);
    setUnauthorizedHandler(null);
  }
});

test("clearing an access token removes it from the in-memory API client", () => {
  setAccessToken("temporary");
  setAccessToken(null);
  assert.equal(getAccessTokenForTests(), null);
});

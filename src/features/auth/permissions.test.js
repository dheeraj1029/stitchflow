import assert from "node:assert/strict";
import test from "node:test";
import {
  canAccessPath,
  getNavigationForRole,
  getRoleHome,
  validateLoginInput,
} from "./permissions.js";

test("login validation rejects missing credentials and malformed email", () => {
  assert.match(validateLoginInput({ email: "bad", password: "pass" }), /email/i);
  assert.match(validateLoginInput({ email: "admin@example.test", password: "" }), /password/i);
  assert.equal(validateLoginInput({ email: "admin@example.test", password: "good" }), "");
});

test("role route rules separate buyer, supervisor, merchandiser, and admin pages", () => {
  assert.equal(canAccessPath("BUYER", "/buyer/orders"), true);
  assert.equal(canAccessPath("BUYER", "/orders"), false);
  assert.equal(canAccessPath("BUYER", "/issues"), false);
  assert.equal(canAccessPath("SUPERVISOR", "/production-updates/new"), true);
  assert.equal(canAccessPath("SUPERVISOR", "/orders/B-PO-88213/edit"), false);
  assert.equal(canAccessPath("SUPERVISOR", "/admin/users"), false);
  assert.equal(canAccessPath("MERCHANDISER", "/delay-warnings"), true);
  assert.equal(canAccessPath("MERCHANDISER", "/admin/users"), false);
  assert.equal(canAccessPath("ADMIN", "/admin/users"), true);
  assert.equal(canAccessPath("ADMIN", "/orders/new"), false);
});

test("navigation only exposes role-appropriate sections", () => {
  const buyerLinks = getNavigationForRole("BUYER").map((item) => item.to);
  assert.ok(buyerLinks.every((path) => path.startsWith("/buyer")));
  assert.equal(buyerLinks.includes("/issues"), false);

  const supervisorLinks = getNavigationForRole("SUPERVISOR").map((item) => item.to);
  assert.deepEqual(supervisorLinks, ["/production-updates", "/issues"]);

  const adminLinks = getNavigationForRole("ADMIN").map((item) => item.to);
  assert.ok(adminLinks.includes("/admin/users"));
  assert.equal(adminLinks.includes("/delay-warnings"), false);
});

test("each role has an appropriate landing route", () => {
  assert.equal(getRoleHome("BUYER"), "/buyer");
  assert.equal(getRoleHome("SUPERVISOR"), "/production-updates");
  assert.equal(getRoleHome("ADMIN"), "/overview");
});

import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import test, { after, before } from "node:test";
import { closeDatabase, connectDatabase } from "../src/config/database.js";
import User from "../src/models/User.js";
import { createInitialAdmin } from "../src/seed/createAdmin.js";

let replicaSet;

before(async () => {
  replicaSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  await connectDatabase(replicaSet.getUri("stitchflow_admin_bootstrap_test"));
  await User.createIndexes();
});

after(async () => {
  await closeDatabase();
  await replicaSet?.stop();
});

test("first-admin bootstrap stores a hash and can only be used once", async () => {
  const password = "unique-test-password";
  const created = await createInitialAdmin({
    name: "  Initial Administrator ",
    email: "  Admin@Example.test ",
    password,
  });

  assert.deepEqual(created, {
    name: "Initial Administrator",
    email: "admin@example.test",
  });
  const user = await User.findOne({ email: created.email }).select("+passwordHash");
  assert.equal(user.role, "ADMIN");
  assert.equal(user.isActive, true);
  assert.notEqual(user.passwordHash, password);
  assert.equal(await bcrypt.compare(password, user.passwordHash), true);

  await assert.rejects(
    createInitialAdmin({
      name: "Second Administrator",
      email: "second@example.test",
      password,
    }),
    /already been completed|administrator already exists/i,
  );
  assert.equal(await User.countDocuments({ role: "ADMIN" }), 1);
  await User.deleteOne({ email: created.email });
  await assert.rejects(
    createInitialAdmin({
      name: "Replacement Administrator",
      email: "replacement@example.test",
      password,
    }),
    /already been completed/i,
  );
  assert.equal(await User.countDocuments({ role: "ADMIN" }), 0);
  await assert.rejects(
    createInitialAdmin({
      name: "Invalid",
      email: "not-an-email",
      password: "short",
    }),
    /valid email address/,
  );
  assert.equal(await User.countDocuments(), 0);
});

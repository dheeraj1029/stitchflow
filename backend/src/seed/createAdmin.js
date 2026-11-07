import "dotenv/config";
import bcrypt from "bcryptjs";
import { createInterface } from "node:readline/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import { closeDatabase, connectDatabase } from "../config/database.js";
import User from "../models/User.js";

const BOOTSTRAP_LOCKS = "_stitchflow_bootstrap_locks";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BOOTSTRAP_CONFIRMATION = "CREATE FIRST ADMIN";

export async function createInitialAdmin({ name, email, password }) {
  if (mongoose.connection.readyState !== 1) {
    throw new Error("Connect to MongoDB before creating the first administrator.");
  }

  const normalizedName = typeof name === "string" ? name.trim() : "";
  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!normalizedName || normalizedName.length > 120) {
    throw new Error("Enter a name of 120 characters or fewer.");
  }
  if (
    !normalizedEmail ||
    normalizedEmail.length > 254 ||
    !EMAIL_PATTERN.test(normalizedEmail)
  ) {
    throw new Error("Enter a valid email address.");
  }
  if (
    typeof password !== "string" ||
    password.trim().length === 0 ||
    password.length < 10 ||
    Buffer.byteLength(password, "utf8") > 72
  ) {
    throw new Error("Password must contain at least 10 characters and no more than 72 bytes.");
  }

  const passwordHash = await bcrypt.hash(password, 10);
  try {
    await mongoose.connection.db.createCollection(BOOTSTRAP_LOCKS);
  } catch (error) {
    if (error.code !== 48 && error.codeName !== "NamespaceExists") {
      throw error;
    }
  }
  await User.init();

  const session = await mongoose.startSession();
  let createdAdmin;
  try {
    await session.withTransaction(async () => {
      const locks = mongoose.connection.db.collection(BOOTSTRAP_LOCKS);
      if (await locks.findOne({ _id: "initial-admin" }, { session })) {
        throw new Error("First-administrator bootstrap has already been completed.");
      }
      if (await User.exists({ role: "ADMIN" }).session(session)) {
        throw new Error("An administrator already exists; bootstrap is only available once.");
      }
      if (await User.exists({ email: normalizedEmail }).session(session)) {
        throw new Error("That email address is already assigned to a user.");
      }

      await locks.insertOne(
        { _id: "initial-admin", createdAt: new Date() },
        { session },
      );
      [createdAdmin] = await User.create(
        [
          {
            name: normalizedName,
            email: normalizedEmail,
            passwordHash,
            role: "ADMIN",
            isActive: true,
          },
        ],
        { session },
      );
    });
  } catch (error) {
    if (error.code === 11000 && error.keyPattern?.email) {
      throw new Error("That email address is already assigned to a user.");
    }
    throw error;
  } finally {
    await session.endSession();
  }

  return { name: createdAdmin.name, email: createdAdmin.email };
}

function readHiddenPassword(prompt) {
  const input = process.stdin;
  if (!input.isTTY || typeof input.setRawMode !== "function") {
    throw new Error("Run this command in an interactive terminal to enter the password privately.");
  }

  return new Promise((resolvePassword, rejectPassword) => {
    let password = "";
    let settled = false;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      input.removeListener("data", onData);
      input.setRawMode(false);
      input.pause();
      process.stderr.write("\n");
      if (error) {
        rejectPassword(error);
      } else {
        resolvePassword(password);
      }
    };
    const onData = (chunk) => {
      for (const character of chunk) {
        if (character === "\u0003") {
          finish(new Error("Administrator creation cancelled."));
          return;
        }
        if (character === "\r" || character === "\n") {
          finish();
          return;
        }
        if (character === "\u007f" || character === "\u0008") {
          password = [...password].slice(0, -1).join("");
        } else if (character.charCodeAt(0) >= 32) {
          password += character;
        }
      }
    };

    process.stderr.write(prompt);
    input.setEncoding("utf8");
    input.setRawMode(true);
    input.on("data", onData);
    input.resume();
  });
}

async function run() {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.STITCHFLOW_ALLOW_ADMIN_BOOTSTRAP !== "true"
  ) {
    throw new Error(
      "Production bootstrap requires STITCHFLOW_ALLOW_ADMIN_BOOTSTRAP=true for this command.",
    );
  }
  await connectDatabase();

  const terminal = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  let name;
  let email;
  let confirmation;
  try {
    name = await terminal.question("Administrator name: ");
    email = await terminal.question("Administrator email: ");
    confirmation = await terminal.question(
      `Type "${BOOTSTRAP_CONFIRMATION}" to continue: `,
    );
  } finally {
    terminal.close();
  }
  if (confirmation !== BOOTSTRAP_CONFIRMATION) {
    throw new Error("Administrator creation cancelled.");
  }

  const password = await readHiddenPassword("New password (minimum 10 characters): ");
  const confirmationPassword = await readHiddenPassword("Confirm new password: ");
  if (password !== confirmationPassword) {
    throw new Error("The passwords did not match.");
  }

  const admin = await createInitialAdmin({ name, email, password });
  console.info(`First administrator created for ${admin.email}.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run()
    .catch((error) => {
      console.error(error.message || "First administrator could not be created.");
      process.exitCode = 1;
    })
    .finally(() => closeDatabase());
}

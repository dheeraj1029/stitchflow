import mongoose from "mongoose";

let connectionPromise;

export async function connectDatabase(uri = process.env.MONGODB_URI) {
  if (!uri || typeof uri !== "string" || !uri.trim()) {
    throw new Error("MONGODB_URI is required before the API can start.");
  }
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }
  if (!connectionPromise) {
    connectionPromise = mongoose
      .connect(uri, { serverSelectionTimeoutMS: 10_000 })
      .then(async () => {
        const topology = await mongoose.connection.db.admin().command({ hello: 1 });
        if (!topology.setName && topology.msg !== "isdbgrid") {
          await mongoose.disconnect();
          throw new Error(
            "MongoDB transactions require a replica set or sharded cluster.",
          );
        }
        return mongoose.connection;
      })
      .catch((error) => {
        connectionPromise = null;
        if (error.message === "MongoDB transactions require a replica set or sharded cluster.") {
          throw error;
        }
        throw new Error(
          "MongoDB connection failed. Check MONGODB_URI and database network access.",
          { cause: error },
        );
      });
  }
  return connectionPromise;
}

export async function closeDatabase() {
  connectionPromise = null;
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

export function isDatabaseReady() {
  return mongoose.connection.readyState === 1;
}

mongoose.connection.on("disconnected", () => {
  connectionPromise = null;
});

mongoose.connection.on("error", () => {
  console.error("MongoDB connection encountered an error.");
});

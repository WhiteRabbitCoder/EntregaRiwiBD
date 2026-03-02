const path = require("path");
const dotenv = require("dotenv");

dotenv.config();

const env = {
  PORT: process.env.PORT ? Number(process.env.PORT) : 3000,
  DATABASE_URL: process.env.DATABASE_URL,
  MONGODB_URI: process.env.MONGODB_URI,
  MONGODB_DB: process.env.MONGODB_DB || "megastore_datahub",
  REDIS_URL: process.env.REDIS_URL || "",
  DATASET_CSV_PATH:
    process.env.DATASET_CSV_PATH ||
    process.env.SIMULACRO_CSV_PATH ||
    path.resolve(process.cwd(), "data-set.csv"),
};

function validateEnv() {
  const missing = [];
  if (!env.DATABASE_URL) missing.push("DATABASE_URL");
  if (!env.MONGODB_URI) missing.push("MONGODB_URI");
  if (missing.length) {
    throw new Error(`Missing required env vars: ${missing.join(", ")}`);
  }
}

module.exports = { env, validateEnv };

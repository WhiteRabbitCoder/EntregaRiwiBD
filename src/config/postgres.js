const { Pool } = require("pg");
const { env } = require("./env");

const pool = new Pool({
  connectionString: env.DATABASE_URL,
});

async function query(text, params) {
  return pool.query(text, params);
}

async function getClient() {
  return pool.connect();
}

async function closePool() {
  await pool.end();
}

module.exports = { query, getClient, closePool };

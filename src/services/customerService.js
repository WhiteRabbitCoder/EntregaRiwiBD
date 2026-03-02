const { getMongoDb } = require("../config/mongodb");
const { query } = require("../config/postgres");
const { cacheGet, cacheSet } = require("../config/redis");
const { normalizeEmail } = require("../utils/normalize");

function buildSummary(transactions) {
  const totalTransactions = transactions.length;
  const totalSpent = transactions.reduce(
    (sum, transaction) => sum + (Number(transaction.transactionTotal) || 0),
    0
  );

  const categories = new Map();
  for (const transaction of transactions) {
    for (const item of transaction.items || []) {
      if (!item.category) continue;
      const current = categories.get(item.category) || 0;
      categories.set(item.category, current + 1);
    }
  }

  let mostFrequentCategory = null;
  let maxCount = 0;
  for (const [category, count] of categories.entries()) {
    if (count > maxCount) {
      maxCount = count;
      mostFrequentCategory = category;
    }
  }

  return { totalTransactions, totalSpent, mostFrequentCategory };
}

async function getCustomerHistoryByEmail(email) {
  const normalized = normalizeEmail(email);
  const cacheKey = `customer-history:${normalized}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return cached;

  const db = await getMongoDb();
  const collection = db.collection("customer_purchase_histories");
  const doc = await collection.findOne({ customerEmail: normalized });

  if (!doc) return null;

  const transactions = (doc.transactions || []).slice().sort((a, b) => {
    if (!a.date || !b.date) return 0;
    return a.date.localeCompare(b.date);
  });
  const summary = buildSummary(transactions);

  const result = {
    customer: {
      email: doc.customerEmail,
      name: doc.customerName,
    },
    transactions,
    summary,
  };
  await cacheSet(cacheKey, result, 120);
  return result;
}

async function listCustomers({ q, limit = 50, page = 1 } = {}) {
  const safeLimit = Math.min(Number(limit) || 50, 200);
  const safePage = Math.max(Number(page) || 1, 1);
  const offset = (safePage - 1) * safeLimit;

  const params = [];
  let where = "";
  if (q) {
    params.push(`%${q}%`);
    where = `WHERE name ILIKE $1 OR email ILIKE $1`;
  }

  params.push(safeLimit);
  params.push(offset);

  const result = await query(
    `SELECT id, name, email, phone, address
     FROM customers
     ${where}
     ORDER BY name
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return result.rows;
}

module.exports = { getCustomerHistoryByEmail, listCustomers };

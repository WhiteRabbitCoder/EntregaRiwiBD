const { query } = require("../config/postgres");
const { cacheGet, cacheSet } = require("../config/redis");

function parseNumber(value) {
  if (value === null || value === undefined) return 0;
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function formatDate(value) {
  if (!value) return null;
  if (typeof value === "string") return value;
  return value.toISOString().slice(0, 10);
}

function buildDateWhereClause({ startDate, endDate } = {}) {
  const conditions = [];
  const params = [];

  if (startDate) {
    params.push(startDate);
    conditions.push(`t.transaction_date >= $${params.length}`);
  }

  if (endDate) {
    params.push(endDate);
    conditions.push(`t.transaction_date <= $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  return { where, params };
}

async function getSalesReport({ startDate, endDate } = {}) {
  const cacheKey = `sales:${startDate || "all"}:${endDate || "all"}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return cached;

  const { where, params } = buildDateWhereClause({ startDate, endDate });

  const bySupplierResult = await query(
    `SELECT s.name AS supplier_name,
            COUNT(DISTINCT t.id)::int AS transaction_count,
            COALESCE(SUM(ti.total_line_value), 0) AS total_amount
     FROM transaction_items ti
     JOIN transactions t ON t.id = ti.transaction_id
     JOIN suppliers s ON s.id = ti.supplier_id
     ${where}
     GROUP BY s.name
     ORDER BY s.name`,
    params
  );

  const totalResult = await query(
    `SELECT COALESCE(SUM(ti.total_line_value), 0) AS total_amount
     FROM transaction_items ti
     JOIN transactions t ON t.id = ti.transaction_id
     ${where}`,
    params
  );

  const minMaxResult = await query(
    `SELECT MIN(transaction_date) AS min_date,
            MAX(transaction_date) AS max_date
     FROM transactions t
     ${where}`,
    params
  );

  const bySupplier = bySupplierResult.rows.map((row) => ({
    supplierName: row.supplier_name,
    totalAmount: parseNumber(row.total_amount),
    transactionCount: Number(row.transaction_count) || 0,
  }));

  const totalSales = parseNumber(totalResult.rows[0]?.total_amount);
  const period = {
    startDate: formatDate(startDate || minMaxResult.rows[0]?.min_date || null),
    endDate: formatDate(endDate || minMaxResult.rows[0]?.max_date || null),
  };

  const report = { totalSales, bySupplier, period };
  await cacheSet(cacheKey, report, 60);
  return report;
}

async function getSupplierAnalysis({ startDate, endDate } = {}) {
  const cacheKey = `supplier-analysis:${startDate || "all"}:${endDate || "all"}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return cached;

  const { where, params } = buildDateWhereClause({ startDate, endDate });
  const result = await query(
    `SELECT s.name AS supplier_name,
            COALESCE(SUM(ti.quantity), 0)::int AS total_items,
            COALESCE(SUM(ti.total_line_value), 0) AS total_inventory_value
     FROM transaction_items ti
     JOIN transactions t ON t.id = ti.transaction_id
     JOIN suppliers s ON s.id = ti.supplier_id
     ${where}
     GROUP BY s.name
     ORDER BY total_items DESC, total_inventory_value DESC, s.name`,
    params
  );

  const suppliers = result.rows.map((row) => ({
    supplierName: row.supplier_name,
    totalItems: Number(row.total_items) || 0,
    totalInventoryValue: parseNumber(row.total_inventory_value),
  }));
  await cacheSet(cacheKey, suppliers, 60);
  return suppliers;
}

async function getTopProductsByCategory({ category, limit = 10 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 50);
  const cacheKey = `top-products:${String(category).trim().toLowerCase()}:${safeLimit}`;
  const cached = await cacheGet(cacheKey);
  if (cached) return cached;

  const result = await query(
    `SELECT p.sku,
            p.name AS product_name,
            cat.name AS category_name,
            COALESCE(SUM(ti.quantity), 0)::int AS total_quantity,
            COALESCE(SUM(ti.total_line_value), 0) AS total_revenue
     FROM transaction_items ti
     JOIN products p ON p.id = ti.product_id
     JOIN categories cat ON cat.id = p.category_id
     WHERE LOWER(cat.name) = LOWER($1)
     GROUP BY p.id, p.sku, p.name, cat.name
     ORDER BY total_revenue DESC, total_quantity DESC, p.name
     LIMIT $2`,
    [String(category).trim(), safeLimit]
  );

  const products = result.rows.map((row) => ({
    sku: row.sku,
    productName: row.product_name,
    category: row.category_name,
    totalQuantity: Number(row.total_quantity) || 0,
    totalRevenue: parseNumber(row.total_revenue),
  }));
  await cacheSet(cacheKey, products, 60);
  return products;
}

module.exports = { getSalesReport, getSupplierAnalysis, getTopProductsByCategory };

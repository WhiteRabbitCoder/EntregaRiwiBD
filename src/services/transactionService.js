const { query } = require("../config/postgres");
const { normalizeEmail } = require("../utils/normalize");

async function listTransactionItems({
  customerEmail,
  supplierEmail,
  startDate,
  endDate,
  transactionId,
  limit = 50,
  page = 1,
} = {}) {
  const safeLimit = Math.min(Number(limit) || 50, 200);
  const safePage = Math.max(Number(page) || 1, 1);
  const offset = (safePage - 1) * safeLimit;

  const conditions = [];
  const params = [];

  if (transactionId) {
    params.push(transactionId.trim().toUpperCase());
    conditions.push(`t.transaction_id = $${params.length}`);
  }

  if (customerEmail) {
    params.push(normalizeEmail(customerEmail));
    conditions.push(`LOWER(c.email) = LOWER($${params.length})`);
  }

  if (supplierEmail) {
    params.push(normalizeEmail(supplierEmail));
    conditions.push(`LOWER(s.email) = LOWER($${params.length})`);
  }

  if (startDate) {
    params.push(startDate);
    conditions.push(`t.transaction_date >= $${params.length}`);
  }

  if (endDate) {
    params.push(endDate);
    conditions.push(`t.transaction_date <= $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  params.push(safeLimit);
  params.push(offset);

  const result = await query(
    `SELECT t.transaction_id AS "transactionId",
            t.transaction_date AS "date",
            c.name AS "customerName",
            c.email AS "customerEmail",
            s.name AS "supplierName",
            s.email AS "supplierEmail",
            p.sku AS "productSku",
            p.name AS "productName",
            cat.name AS "category",
            ti.unit_price AS "unitPrice",
            ti.quantity AS "quantity",
            ti.total_line_value AS "totalLineValue"
     FROM transaction_items ti
     JOIN transactions t ON t.id = ti.transaction_id
     JOIN customers c ON c.id = t.customer_id
     JOIN suppliers s ON s.id = ti.supplier_id
     JOIN products p ON p.id = ti.product_id
     JOIN categories cat ON cat.id = p.category_id
     ${where}
     ORDER BY t.transaction_date DESC, t.transaction_id, p.sku
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );

  return result.rows;
}

module.exports = { listTransactionItems };

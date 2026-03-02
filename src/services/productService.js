const { query } = require("../config/postgres");

async function listProducts({ q } = {}) {
  const params = [];
  let where = "";

  if (q && q.trim()) {
    params.push(`%${q.trim()}%`);
    where = "WHERE p.name ILIKE $1 OR p.sku ILIKE $1";
  }

  const result = await query(
    `SELECT p.id,
            p.sku,
            p.name,
            p.base_unit_price AS "baseUnitPrice",
            c.name AS "category"
     FROM products p
     JOIN categories c ON c.id = p.category_id
     ${where}
     ORDER BY p.name`,
    params
  );

  return result.rows;
}

module.exports = { listProducts };

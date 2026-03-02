const { query } = require("../config/postgres");

async function listCategories() {
  const result = await query(
    `SELECT id, name
     FROM categories
     ORDER BY name`
  );
  return result.rows;
}

module.exports = { listCategories };

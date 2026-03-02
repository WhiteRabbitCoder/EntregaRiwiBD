const { query } = require("../config/postgres");
const { getMongoDb } = require("../config/mongodb");
const { cacheDelByPattern } = require("../config/redis");
const { normalizeName, normalizeEmail } = require("../utils/normalize");

async function listSuppliers({ name } = {}) {
  const params = [];
  let where = "";
  if (name) {
    params.push(`%${name.trim()}%`);
    where = `WHERE name ILIKE $${params.length}`;
  }
  const result = await query(
    `SELECT id, name, email FROM suppliers ${where} ORDER BY name`,
    params
  );
  return result.rows;
}

async function getSupplierById(id) {
  const result = await query(
    `SELECT id, name, email, created_at AS "createdAt", updated_at AS "updatedAt"
     FROM suppliers WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

async function propagateSupplierChange(oldSupplier, newSupplier) {
  const db = await getMongoDb();
  const collection = db.collection("customer_purchase_histories");

  if (
    oldSupplier.email === newSupplier.email &&
    oldSupplier.name === newSupplier.name
  ) {
    return { matched: 0, modified: 0 };
  }

  const result = await collection.updateMany(
    { "transactions.items.supplierEmail": oldSupplier.email },
    {
      $set: {
        "transactions.$[].items.$[item].supplierName": newSupplier.name,
        "transactions.$[].items.$[item].supplierEmail": newSupplier.email,
      },
    },
    {
      arrayFilters: [{ "item.supplierEmail": oldSupplier.email }],
    }
  );

  return { matched: result.matchedCount, modified: result.modifiedCount };
}

async function logTableChange({ tableName, operation, recordId, before, after }) {
  const db = await getMongoDb();
  await db.collection("table_change_logs").insertOne({
    tableName,
    operation,
    recordId,
    before,
    after,
    changedAt: new Date(),
  });
}

async function listSupplierChangeLogs({ supplierId, limit = 50, page = 1 } = {}) {
  const safeLimit = Math.min(Number(limit) || 50, 200);
  const safePage = Math.max(Number(page) || 1, 1);
  const skip = (safePage - 1) * safeLimit;

  const db = await getMongoDb();
  const query = { tableName: "suppliers" };
  if (supplierId) {
    query.recordId = Number(supplierId);
  }

  const logs = await db
    .collection("table_change_logs")
    .find(query, {
      projection: {
        _id: 0,
        tableName: 1,
        operation: 1,
        recordId: 1,
        before: 1,
        after: 1,
        changedAt: 1,
      },
    })
    .sort({ changedAt: -1 })
    .skip(skip)
    .limit(safeLimit)
    .toArray();

  return logs;
}

async function updateSupplier(id, payload) {
  const existing = await getSupplierById(id);
  if (!existing) return null;

  const updated = {
    name: payload.name ? normalizeName(payload.name) : existing.name,
    email: payload.email ? normalizeEmail(payload.email) : existing.email,
  };

  const result = await query(
    `UPDATE suppliers
     SET name = $1,
         email = $2,
         updated_at = NOW()
     WHERE id = $3
     RETURNING id, name, email, created_at AS "createdAt", updated_at AS "updatedAt"`,
    [updated.name, updated.email, id]
  );

  await propagateSupplierChange(existing, updated);
  await logTableChange({
    tableName: "suppliers",
    operation: "UPDATE",
    recordId: id,
    before: existing,
    after: result.rows[0],
  });
  await cacheDelByPattern("customer-history:*");

  return result.rows[0];
}

module.exports = {
  listSuppliers,
  getSupplierById,
  updateSupplier,
  listSupplierChangeLogs,
};

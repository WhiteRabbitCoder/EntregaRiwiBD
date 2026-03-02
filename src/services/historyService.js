const { getMongoDb } = require("../config/mongodb");

async function listCustomerHistories({ q, limit = 50, page = 1 } = {}) {
  const safeLimit = Math.min(Number(limit) || 50, 200);
  const safePage = Math.max(Number(page) || 1, 1);
  const skip = (safePage - 1) * safeLimit;

  const db = await getMongoDb();
  const collection = db.collection("customer_purchase_histories");

  const query = {};
  if (q) {
    const regex = new RegExp(q, "i");
    query.$or = [{ customerEmail: regex }, { customerName: regex }];
  }

  const docs = await collection
    .find(query, {
      projection: { _id: 0, customerEmail: 1, customerName: 1, transactions: 1 },
    })
    .skip(skip)
    .limit(safeLimit)
    .toArray();

  return docs.map((doc) => ({
    customerEmail: doc.customerEmail,
    customerName: doc.customerName,
    transactions: (doc.transactions || []).slice().sort((a, b) => {
      if (!a.date || !b.date) return 0;
      return a.date.localeCompare(b.date);
    }),
  }));
}

module.exports = { listCustomerHistories };

const fs = require("fs/promises");
const path = require("path");
const { readCsv } = require("../utils/csv");
const {
  normalizeEmail,
  normalizeName,
  normalizePhone,
  normalizeAddress,
  normalizeTransactionId,
  normalizeCategory,
  normalizeSku,
  normalizeProductName,
} = require("../utils/normalize");
const { isValidEmail, isValidDate } = require("../utils/validators");
const { env } = require("../config/env");
const { getClient } = require("../config/postgres");
const { getMongoDb } = require("../config/mongodb");
const { cacheDelByPattern } = require("../config/redis");

async function ensureSchema(client) {
  const schemaPath = path.resolve(__dirname, "../db/schema.sql");
  const sql = await fs.readFile(schemaPath, "utf8");
  await client.query(sql);
}

async function ensureMongoIndexes() {
  const db = await getMongoDb();
  const collection = db.collection("customer_purchase_histories");
  await collection.createIndex({ customerEmail: 1 }, { unique: true });
  await collection.createIndex({ "transactions.transactionId": 1 });
}

function mergeLongest(current, incoming) {
  if (!current) return incoming;
  if (!incoming) return current;
  return incoming.length > current.length ? incoming : current;
}

function parseNumber(value) {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function parseInteger(value) {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

async function migrate({ clearBefore = false } = {}) {
  const csvPath = env.DATASET_CSV_PATH;
  const rows = await readCsv(csvPath);

  const customersMap = new Map();
  const suppliersMap = new Map();
  const categoriesMap = new Map();
  const productsMap = new Map();
  const transactionsMap = new Map();
  const transactionItems = [];
  const historiesMap = new Map();

  const warnings = [];

  for (const row of rows) {
    const transactionId = normalizeTransactionId(row.transaction_id);
    const transactionDate = row.date ? row.date.trim() : "";

    const customerEmail = normalizeEmail(row.customer_email);
    const customerName = normalizeName(row.customer_name);
    const customerPhone = normalizePhone(row.customer_phone);
    const customerAddress = normalizeAddress(row.customer_address);

    const supplierEmail = normalizeEmail(row.supplier_email);
    const supplierName = normalizeName(row.supplier_name);

    const categoryName = normalizeCategory(row.product_category);
    const sku = normalizeSku(row.product_sku);
    const productName = normalizeProductName(row.product_name);

    const unitPrice = parseNumber(row.unit_price);
    const quantity = parseInteger(row.quantity);
    const totalLineValue = parseNumber(row.total_line_value);

    if (!transactionId || !transactionDate || !customerEmail || !supplierEmail || !sku) {
      warnings.push("Skipping row with missing required fields");
      continue;
    }

    if (!isValidDate(transactionDate)) {
      warnings.push(`Invalid date for transaction ${transactionId}`);
      continue;
    }

    if (!isValidEmail(customerEmail) || !isValidEmail(supplierEmail)) {
      warnings.push(`Invalid email in transaction ${transactionId}`);
      continue;
    }

    if (quantity <= 0 || unitPrice < 0 || totalLineValue < 0) {
      warnings.push(`Invalid numeric values in transaction ${transactionId}`);
      continue;
    }

    const existingCustomer = customersMap.get(customerEmail) || {};
    customersMap.set(customerEmail, {
      name: mergeLongest(existingCustomer.name, customerName),
      email: customerEmail,
      phone: mergeLongest(existingCustomer.phone, customerPhone),
      address: mergeLongest(existingCustomer.address, customerAddress),
    });

    const existingSupplier = suppliersMap.get(supplierEmail) || {};
    suppliersMap.set(supplierEmail, {
      name: mergeLongest(existingSupplier.name, supplierName),
      email: supplierEmail,
    });

    const categoryKey = categoryName.toLowerCase();
    categoriesMap.set(categoryKey, { name: categoryName });

    const existingProduct = productsMap.get(sku) || {};
    productsMap.set(sku, {
      sku,
      name: mergeLongest(existingProduct.name, productName),
      categoryName,
      unitPrice: unitPrice || existingProduct.unitPrice || 0,
    });

    if (!transactionsMap.has(transactionId)) {
      transactionsMap.set(transactionId, {
        transactionId,
        transactionDate,
        customerEmail,
      });
    }

    transactionItems.push({
      transactionId,
      supplierEmail,
      sku,
      unitPrice,
      quantity,
      totalLineValue,
    });

    let history = historiesMap.get(customerEmail);
    if (!history) {
      history = {
        customerEmail,
        customerName,
        transactionsById: new Map(),
      };
      historiesMap.set(customerEmail, history);
    } else if (customerName.length > history.customerName.length) {
      history.customerName = customerName;
    }

    let historyTransaction = history.transactionsById.get(transactionId);
    if (!historyTransaction) {
      historyTransaction = {
        transactionId,
        date: transactionDate,
        items: [],
        transactionTotal: 0,
      };
      history.transactionsById.set(transactionId, historyTransaction);
    }

    historyTransaction.items.push({
      sku,
      productName,
      category: categoryName,
      supplierName,
      supplierEmail,
      unitPrice,
      quantity,
      totalLineValue,
    });
    historyTransaction.transactionTotal += totalLineValue;
  }

  const client = await getClient();
  try {
    await client.query("BEGIN");
    await ensureSchema(client);

    if (clearBefore) {
      await client.query(
        "TRUNCATE TABLE transaction_items, transactions, products, categories, suppliers, customers RESTART IDENTITY CASCADE"
      );
    }

    const customerIds = new Map();
    for (const customer of customersMap.values()) {
      const result = await client.query(
        `INSERT INTO customers (name, email, address, phone)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (email) DO UPDATE
           SET name = EXCLUDED.name,
               address = EXCLUDED.address,
               phone = EXCLUDED.phone,
               updated_at = NOW()
         RETURNING id, email`,
        [customer.name, customer.email, customer.address, customer.phone]
      );
      customerIds.set(result.rows[0].email, result.rows[0].id);
    }

    const supplierIds = new Map();
    for (const supplier of suppliersMap.values()) {
      const result = await client.query(
        `INSERT INTO suppliers (name, email)
         VALUES ($1, $2)
         ON CONFLICT (email) DO UPDATE
           SET name = EXCLUDED.name,
               updated_at = NOW()
         RETURNING id, email`,
        [supplier.name, supplier.email]
      );
      supplierIds.set(result.rows[0].email, result.rows[0].id);
    }

    const categoryIds = new Map();
    for (const category of categoriesMap.values()) {
      const result = await client.query(
        `INSERT INTO categories (name)
         VALUES ($1)
         ON CONFLICT (name) DO UPDATE
           SET name = EXCLUDED.name
         RETURNING id, name`,
        [category.name]
      );
      categoryIds.set(result.rows[0].name.toLowerCase(), result.rows[0].id);
    }

    const productIds = new Map();
    for (const product of productsMap.values()) {
      const categoryId = categoryIds.get(product.categoryName.toLowerCase());
      if (!categoryId) {
        warnings.push(`Skipping product ${product.sku} due to missing category`);
        continue;
      }

      const result = await client.query(
        `INSERT INTO products (sku, name, category_id, base_unit_price)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (sku) DO UPDATE
           SET name = EXCLUDED.name,
               category_id = EXCLUDED.category_id,
               base_unit_price = EXCLUDED.base_unit_price,
               updated_at = NOW()
         RETURNING id, sku`,
        [product.sku, product.name, categoryId, product.unitPrice]
      );
      productIds.set(result.rows[0].sku, result.rows[0].id);
    }

    const transactionRowsIds = new Map();
    for (const transaction of transactionsMap.values()) {
      const customerId = customerIds.get(transaction.customerEmail);
      if (!customerId) {
        warnings.push(
          `Skipping transaction ${transaction.transactionId} due to missing customer`
        );
        continue;
      }

      const result = await client.query(
        `INSERT INTO transactions (transaction_id, transaction_date, customer_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (transaction_id) DO UPDATE
           SET transaction_date = EXCLUDED.transaction_date,
               customer_id = EXCLUDED.customer_id
         RETURNING id, transaction_id`,
        [transaction.transactionId, transaction.transactionDate, customerId]
      );
      transactionRowsIds.set(result.rows[0].transaction_id, result.rows[0].id);
    }

    let transactionItemsInserted = 0;
    for (const item of transactionItems) {
      const transactionRowId = transactionRowsIds.get(item.transactionId);
      const productId = productIds.get(item.sku);
      const supplierId = supplierIds.get(item.supplierEmail);

      if (!transactionRowId || !productId || !supplierId) {
        warnings.push(
          `Skipping line of ${item.transactionId} due to missing references`
        );
        continue;
      }

      await client.query(
        `INSERT INTO transaction_items (
          transaction_id,
          product_id,
          supplier_id,
          unit_price,
          quantity,
          total_line_value
        ) VALUES ($1,$2,$3,$4,$5,$6)
        ON CONFLICT (transaction_id, product_id, supplier_id) DO UPDATE
          SET unit_price = EXCLUDED.unit_price,
              quantity = EXCLUDED.quantity,
              total_line_value = EXCLUDED.total_line_value`,
        [
          transactionRowId,
          productId,
          supplierId,
          item.unitPrice,
          item.quantity,
          item.totalLineValue,
        ]
      );
      transactionItemsInserted += 1;
    }

    await client.query("COMMIT");

    await ensureMongoIndexes();
    const db = await getMongoDb();
    const collection = db.collection("customer_purchase_histories");

    if (clearBefore) {
      await collection.deleteMany({});
    }

    for (const history of historiesMap.values()) {
      const transactions = Array.from(history.transactionsById.values()).sort((a, b) =>
        a.date.localeCompare(b.date)
      );

      await collection.updateOne(
        { customerEmail: history.customerEmail },
        {
          $set: {
            customerName: history.customerName,
            transactions,
            updatedAt: new Date(),
          },
          $setOnInsert: {
            createdAt: new Date(),
          },
        },
        { upsert: true }
      );
    }

    await cacheDelByPattern("customer-history:*");
    await cacheDelByPattern("sales:*");

    return {
      customers: customersMap.size,
      suppliers: suppliersMap.size,
      categories: categoriesMap.size,
      products: productsMap.size,
      transactions: transactionsMap.size,
      transactionItems: transactionItemsInserted,
      histories: historiesMap.size,
      csvPath,
      warnings: warnings.length,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { migrate };

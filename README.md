# Megastore datahub · Hybrid Persistence API

## Overview
Proyecto Node.js + Express para migrar y consultar datos de ventas desde `data-set.csv` en arquitectura híbrida:
- **PostgreSQL** for normalized transactional data.
- **MongoDB** for customer purchase histories and supplier change logs.
- **Redis** for cache of expensive queries.

## Quick Start
```bash
docker compose up --build -d
```
Open: `http://localhost:3000`

Run migration from UI or API:
```bash
curl -X POST http://localhost:3000/api/simulacro/migrate \
  -H "Content-Type: application/json" \
  -d '{"clearBefore": true}'
```

## Environment Variables
- `PORT=3000`
- `DATABASE_URL=postgresql://.../megastore_datahub`
- `MONGODB_URI=mongodb://...`
- `MONGODB_DB=megastore_datahub`
- `REDIS_URL=redis://...` (optional)
- `DATASET_CSV_PATH=./data-set.csv`

## Data Model (Normalization based on MER)
### SQL tables
1. `customers` (master customer data, unique email)
2. `suppliers` (master supplier data, unique email)
3. `categories` (product categories)
4. `products` (SKU catalog, FK to category)
5. `transactions` (header with transaction/date/customer)
6. `transaction_items` (line detail with product, supplier, quantity, value)

### Why this normalization
- **1NF**: atomic fields (`quantity`, `unit_price`, `total_line_value` in line items).
- **2NF**: line attributes depend on full line identity (`transaction_id + product_id + supplier_id`).
- **3NF**: customer/supplier/category/product master data moved out of transaction lines to avoid transitive duplication.
- Supplier is kept in `transaction_items` because dataset shows the same SKU sold by multiple suppliers.

## MongoDB document model
Collection: `customer_purchase_histories`
```json
{
  "customerEmail": "andres.lopez@gmail.com",
  "customerName": "Andres Lopez",
  "transactions": [
    {
      "transactionId": "TXN-2001",
      "date": "2024-02-21",
      "transactionTotal": 4130000,
      "items": [
        {
          "sku": "MSE-LOG-502",
          "productName": "Mouse Logitech M502",
          "category": "Accessories",
          "supplierName": "TechWorld SAS",
          "supplierEmail": "ventas@techworld.com",
          "unitPrice": 150000,
          "quantity": 3,
          "totalLineValue": 450000
        }
      ]
    }
  ]
}
```

## API
- `GET /api/simulacro`
- `POST /api/simulacro/migrate`
- `GET /api/suppliers`
- `GET /api/suppliers/:id`
- `PUT /api/suppliers/:id`
- `GET /api/customers`
- `GET /api/customers/:email/history`
- `GET /api/categories`
- `GET /api/products`
- `GET /api/transactions`
- `GET /api/histories`
- `GET /api/suppliers/changes?supplierId=1&limit=50&page=1`
- `GET /api/reports/sales`
- `GET /api/reports/supplier-analysis`
- `GET /api/reports/top-products?category=Accessories&limit=10`

## Code-book (by module)
### `src/config/env.js`
Loads `.env`, validates DB connection vars, and resolves dataset path (`DATASET_CSV_PATH`).

### `src/db/schema.sql`
Defines normalized relational schema, PK/FK constraints, and indexes for common filters.

### `src/services/migrationService.js`
1. Reads CSV.
2. Normalizes fields (email, names, SKUs, dates, amounts).
3. Deduplicates masters with maps (`customers`, `suppliers`, `categories`, `products`).
4. Persists SQL entities in dependency order.
5. Builds/upserts Mongo customer history documents.
6. Clears Redis cache patterns.

### `src/services/customerService.js`
Now handles customers: list/search customers and retrieve a customer purchase history with summary (total transactions, total spent, most frequent category).

### `src/services/supplierService.js`
Now handles suppliers: list/get/update suppliers, logs supplier updates in MongoDB (`table_change_logs`), and propagates supplier changes into embedded Mongo line items.

### `src/services/productService.js`
Exposes product listing with category and base price to support direct frontend queries.

### `src/services/transactionService.js`
Now handles transaction line queries with SQL joins (customer, supplier, product, category) and optional filters.

### `src/services/reportService.js`
Builds cached sales report aggregated by supplier and date range.

### `src/routes/*`
HTTP input validation and wiring to service layer for suppliers, customers, transactions, categories, histories, migration, and reports.

### `public/index.html` + `public/app.js`
Frontend for migration trigger and data exploration (suppliers, products, customers, categories, transaction lines, Mongo histories, supplier change logs) with a tech-oriented UI style.

## Docker adaptation
`docker-compose.yml` uses provider-focused names and variables:
- DB: `megastore_datahub`
- API env: `DATASET_CSV_PATH=/app/data-set.csv`
- Containers: `megastore-datahub-*`
# EntregaRiwiBD

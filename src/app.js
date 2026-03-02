const path = require("path");
const express = require("express");
const suppliersRoutes = require("./routes/suppliers");
const reportsRoutes = require("./routes/reports");
const customersRoutes = require("./routes/customers");
const simulacroRoutes = require("./routes/simulacro");
const transactionsRoutes = require("./routes/transactions");
const categoriesRoutes = require("./routes/categories");
const historiesRoutes = require("./routes/histories");
const productsRoutes = require("./routes/products");

const app = express();

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.use("/api/suppliers", suppliersRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/customers", customersRoutes);
app.use("/api/simulacro", simulacroRoutes);
app.use("/api/transactions", transactionsRoutes);
app.use("/api/categories", categoriesRoutes);
app.use("/api/histories", historiesRoutes);
app.use("/api/products", productsRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ ok: false, error: "Internal server error" });
});

module.exports = app;

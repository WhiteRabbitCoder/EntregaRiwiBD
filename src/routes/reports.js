const express = require("express");
const {
  getSalesReport,
  getSupplierAnalysis,
  getTopProductsByCategory,
} = require("../services/reportService");
const { isValidDate } = require("../utils/validators");

const router = express.Router();

router.get("/sales", async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    if (startDate && !isValidDate(startDate)) {
      return res.status(400).json({ ok: false, error: "Invalid startDate" });
    }

    if (endDate && !isValidDate(endDate)) {
      return res.status(400).json({ ok: false, error: "Invalid endDate" });
    }

    const report = await getSalesReport({ startDate, endDate });
    res.json({ ok: true, report });
  } catch (error) {
    next(error);
  }
});

router.get("/supplier-analysis", async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;

    if (startDate && !isValidDate(startDate)) {
      return res.status(400).json({ ok: false, error: "Invalid startDate" });
    }

    if (endDate && !isValidDate(endDate)) {
      return res.status(400).json({ ok: false, error: "Invalid endDate" });
    }

    const suppliers = await getSupplierAnalysis({ startDate, endDate });
    res.json({ ok: true, suppliers });
  } catch (error) {
    next(error);
  }
});

router.get("/top-products", async (req, res, next) => {
  try {
    const { category, limit } = req.query;
    if (!category || !String(category).trim()) {
      return res.status(400).json({ ok: false, error: "category is required" });
    }
    const products = await getTopProductsByCategory({ category, limit });
    res.json({ ok: true, products });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

const express = require("express");
const { listProducts } = require("../services/productService");

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const products = await listProducts({ q: req.query.q });
    res.json({ ok: true, products });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

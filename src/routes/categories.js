const express = require("express");
const { listCategories } = require("../services/categoryService");

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const categories = await listCategories();
    res.json({ ok: true, categories });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

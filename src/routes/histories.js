const express = require("express");
const { listCustomerHistories } = require("../services/historyService");

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const { q, limit, page } = req.query;
    const histories = await listCustomerHistories({ q, limit, page });
    res.json({ ok: true, histories });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

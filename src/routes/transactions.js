const express = require("express");
const { listTransactionItems } = require("../services/transactionService");
const { isValidDate, isValidEmail } = require("../utils/validators");

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const {
      customerEmail,
      supplierEmail,
      startDate,
      endDate,
      transactionId,
      limit,
      page,
    } = req.query;

    if (customerEmail && !isValidEmail(customerEmail)) {
      return res
        .status(400)
        .json({ ok: false, error: "Invalid customerEmail" });
    }

    if (supplierEmail && !isValidEmail(supplierEmail)) {
      return res
        .status(400)
        .json({ ok: false, error: "Invalid supplierEmail" });
    }

    if (startDate && !isValidDate(startDate)) {
      return res.status(400).json({ ok: false, error: "Invalid startDate" });
    }

    if (endDate && !isValidDate(endDate)) {
      return res.status(400).json({ ok: false, error: "Invalid endDate" });
    }

    const transactions = await listTransactionItems({
      customerEmail,
      supplierEmail,
      startDate,
      endDate,
      transactionId,
      limit,
      page,
    });

    res.json({ ok: true, transactions });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

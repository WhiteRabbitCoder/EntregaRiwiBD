const express = require("express");
const {
  getCustomerHistoryByEmail,
  listCustomers,
} = require("../services/customerService");
const { isValidEmail } = require("../utils/validators");

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const { q, limit, page } = req.query;
    const customers = await listCustomers({ q, limit, page });
    res.json({ ok: true, customers });
  } catch (error) {
    next(error);
  }
});

router.get("/:email/history", async (req, res, next) => {
  try {
    const customerEmail = req.params.email;
    if (!isValidEmail(customerEmail)) {
      return res.status(400).json({ ok: false, error: "Invalid email" });
    }

    const history = await getCustomerHistoryByEmail(customerEmail);
    if (!history) {
      return res.status(404).json({ ok: false, error: "Customer not found" });
    }

    res.json({ ok: true, ...history });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

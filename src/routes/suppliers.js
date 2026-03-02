const express = require("express");
const {
  listSuppliers,
  getSupplierById,
  updateSupplier,
  listSupplierChangeLogs,
} = require("../services/supplierService");
const { isValidEmail } = require("../utils/validators");

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const suppliers = await listSuppliers({ name: req.query.name });
    res.json({ ok: true, suppliers });
  } catch (error) {
    next(error);
  }
});

router.get("/changes", async (req, res, next) => {
  try {
    const { supplierId, limit, page } = req.query;
    if (supplierId && !/^[1-9]\d*$/.test(String(supplierId))) {
      return res.status(400).json({ ok: false, error: "Invalid supplierId" });
    }
    const logs = await listSupplierChangeLogs({
      supplierId: supplierId ? Number(supplierId) : undefined,
      limit,
      page,
    });
    res.json({ ok: true, logs });
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ ok: false, error: "Invalid supplier id" });
    }
    const supplier = await getSupplierById(id);
    if (!supplier) {
      return res.status(404).json({ ok: false, error: "Supplier not found" });
    }
    res.json({ ok: true, supplier });
  } catch (error) {
    next(error);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ ok: false, error: "Invalid supplier id" });
    }

    const { name, email } = req.body || {};

    if (!name && !email) {
      return res.status(400).json({ ok: false, error: "No fields provided" });
    }

    if (email && !isValidEmail(email)) {
      return res.status(400).json({ ok: false, error: "Invalid email" });
    }

    const supplier = await updateSupplier(id, { name, email });
    if (!supplier) {
      return res.status(404).json({ ok: false, error: "Supplier not found" });
    }

    res.json({
      ok: true,
      message: "Supplier updated successfully",
      supplier,
    });
  } catch (error) {
    if (error && error.code === "23505") {
      return res
        .status(400)
        .json({ ok: false, error: "Supplier email already exists" });
    }
    next(error);
  }
});

module.exports = router;

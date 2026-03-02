const express = require("express");
const { migrate } = require("../services/migrationService");
const { env } = require("../config/env");

const router = express.Router();

router.get("/", (req, res) => {
  res.json({
    ok: true,
    message: "Megastore datahub migration API",
    csvPath: env.DATASET_CSV_PATH,
  });
});

router.post("/migrate", async (req, res, next) => {
  try {
    let clearBefore = false;
    if (req.body && typeof req.body.clearBefore === "boolean") {
      clearBefore = req.body.clearBefore;
    } else if (req.body && req.body.clearBefore !== undefined) {
      clearBefore = String(req.body.clearBefore).toLowerCase() === "true";
    }
    const result = await migrate({ clearBefore });
    res.json({
      ok: true,
      message: "Migration completed successfully",
      result,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

const { migrate } = require("../src/services/migrationService");
const { validateEnv } = require("../src/config/env");

(async () => {
  try {
    validateEnv();
    const result = await migrate({ clearBefore: false });
    console.log("Migration completed", result);
    process.exit(0);
  } catch (error) {
    console.error("Migration failed", error);
    process.exit(1);
  }
})();

const app = require("./app");
const { env, validateEnv } = require("./config/env");

try {
  validateEnv();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

app.listen(env.PORT, () => {
  console.log(`Megastore datahub API listening on port ${env.PORT}`);
});

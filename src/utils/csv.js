const fs = require("fs/promises");
const { parse } = require("csv-parse/sync");

async function readCsv(filePath) {
  const content = await fs.readFile(filePath, "utf8");
  const sanitized = content.replace(/^\uFEFF/, "");
  return parse(sanitized, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });
}

module.exports = { readCsv };

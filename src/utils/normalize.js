function toTitleCase(value) {
  if (!value) return "";
  return value
    .trim()
    .split(/\s+/)
    .map((word) => {
      const cleaned = word.trim();
      if (!cleaned) return "";
      if (/\d/.test(cleaned)) return cleaned;
      const lower = cleaned.toLowerCase();
      if (/[A-Z]/.test(cleaned.slice(1))) return cleaned;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .filter(Boolean)
    .join(" ");
}

function normalizeEmail(value) {
  return value ? value.trim().toLowerCase() : "";
}

function normalizeName(value) {
  return toTitleCase(value);
}

function normalizePhone(value) {
  if (!value) return "";
  return value.toString().replace(/[^\d+]/g, "").trim();
}

function normalizeAddress(value) {
  return value ? value.trim() : "";
}

function normalizeTransactionId(value) {
  return value ? value.trim().toUpperCase() : "";
}

function normalizeCategory(value) {
  return toTitleCase(value);
}

function normalizeSku(value) {
  return value ? value.trim().toUpperCase() : "";
}

function normalizeProductName(value) {
  return toTitleCase(value);
}

module.exports = {
  toTitleCase,
  normalizeEmail,
  normalizeName,
  normalizePhone,
  normalizeAddress,
  normalizeTransactionId,
  normalizeCategory,
  normalizeSku,
  normalizeProductName,
};

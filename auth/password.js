const { scrypt, timingSafeEqual } = require("node:crypto");
const { promisify } = require("node:util");
const scryptAsync = promisify(scrypt);

async function hashPassword(password, salt, config) {
  return (await scryptAsync(password, salt, config.passwordKeyLength, { N: config.scryptN })).toString("hex");
}

function passwordsMatch(storedHash, suppliedHash) {
  const stored = Buffer.from(storedHash, "hex");
  const supplied = Buffer.from(suppliedHash, "hex");
  return stored.length === supplied.length && timingSafeEqual(stored, supplied);
}

module.exports = { hashPassword, passwordsMatch };

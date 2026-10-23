const fs = require("node:fs");
const path = require("node:path");

function readEnvFile(filename) {
  if (!fs.existsSync(filename)) return {};
  const values = {};
  for (const line of fs.readFileSync(filename, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match || line.trimStart().startsWith("#")) continue;
    values[match[1]] = match[2].replace(/^(?:"(.*)"|'(.*)')$/, "$1$2");
  }
  return values;
}

function positiveInteger(value, fallback) {
  const number = Number(value ?? fallback);
  if (!Number.isSafeInteger(number) || number < 1) throw new Error("Configuration contains an invalid positive number.");
  return number;
}

function scryptCost(value) {
  const cost = positiveInteger(value, 16384);
  if (cost < 16384 || cost > 65536 || (cost & (cost - 1)) !== 0) {
    throw new Error("PASSWORD_SCRYPT_N must be a power of two between 16384 and 65536.");
  }
  return cost;
}

function loadConfig() {
  const env = { ...readEnvFile(path.join(__dirname, ".env")), ...process.env };
  const apiBasePath = (env.API_BASE_PATH || "/api").replace(/\/$/, "");
  if (!/^\/[a-z0-9/-]*$/i.test(apiBasePath) || apiBasePath === "/") throw new Error("API_BASE_PATH must be a path such as /api.");
  return {
    host: env.HOST || "127.0.0.1",
    port: positiveInteger(env.PORT, 3000),
    apiBasePath,
    userDataFile: path.resolve(__dirname, env.USER_DATA_FILE || "data/users.json"),
    databaseFile: path.resolve(__dirname, env.DATABASE_FILE || "data/careerconnect.sqlite"),
    scryptN: scryptCost(env.PASSWORD_SCRYPT_N),
    passwordKeyLength: (() => {
      const length = positiveInteger(env.PASSWORD_KEY_LENGTH, 64);
      if (length > 128) throw new Error("PASSWORD_KEY_LENGTH must not be greater than 128.");
      return length;
    })(),
    authMaxAttempts: positiveInteger(env.AUTH_MAX_ATTEMPTS, 10),
    authWindowMs: positiveInteger(env.AUTH_WINDOW_MS, 900000),
    requestMaxBytes: positiveInteger(env.REQUEST_MAX_BYTES, 32768),
    openAiApiKey: env.OPENAI_API_KEY || "",
    openAiModel: env.OPENAI_MODEL || "gpt-4.1-mini",
    aiRequestTimeoutMs: positiveInteger(env.AI_REQUEST_TIMEOUT_MS, 20000),
  };
}

module.exports = { loadConfig };

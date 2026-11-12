const fs = require("node:fs");
const { X509Certificate } = require("node:crypto");
const { loadConfig } = require("../config");
const { Database } = require("../database");
const { databaseError } = require("../database-error");

async function main() {
  if (Number(process.versions.node.split('.')[0]) < 24) throw new Error("Node.js 24 or newer is required.");
  console.log("Node.js version: OK");
  const config = loadConfig();
  if (!config.databaseUrl) throw new Error("Set DATABASE_URL");
  const url = new URL(config.databaseUrl);
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.password) {
    const error = new Error(); error.code = "ERR_INVALID_URL"; throw error;
  }
  if (config.databaseCaFile) {
    const pem = fs.readFileSync(config.databaseCaFile, "utf8");
    const certificate = new X509Certificate(pem);
    if (!certificate.ca || /PRIVATE KEY/.test(pem) || Date.parse(certificate.validTo) < Date.now()) throw new Error("Invalid CA certificate");
    console.log("Public CA certificate: OK");
  }
  const db = new Database(config);
  try {
    await db.initialize();
    await db.sql.query("SELECT 1 FROM careerconnect.profiles LIMIT 1");
    console.log("Supabase connection and application tables: OK");
  } finally { await db.close(); }
  console.log(config.openAiApiKey ? "AI key: configured (not validated; no paid request sent)" : "AI key: missing (login works; live AI feedback requires OPENAI_API_KEY)");
  console.log("Ready. Run npm start and open http://127.0.0.1:" + config.port);
}
main().catch(error => { console.error(databaseError(error)); process.exitCode = 1; });

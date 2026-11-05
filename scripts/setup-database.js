const fs = require("node:fs");
const path = require("node:path");
const { Postgres } = require("../postgres");
const { loadConfig } = require("../config");

async function setup(sql) {
  await sql.transaction(async () => {
    await sql.query("SELECT pg_advisory_xact_lock(734193)");
    await sql.exec(fs.readFileSync(path.join(__dirname, "../schema.sql"), "utf8"));
  });
}
async function main() {
  const sql = new Postgres(loadConfig());
  try { await setup(sql); console.log("Supabase schema is ready. Existing records were preserved; no sample jobs were inserted."); }
  finally { await sql.close(); }
}
if (require.main === module) main().catch(error => {
  console.error("Database setup failed:", error.code || "check DATABASE_URL and DATABASE_CA_FILE in .env");
  process.exitCode = 1;
});
module.exports = { setup };

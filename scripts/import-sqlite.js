// One-time, read-only legacy importer. The running website never imports SQLite.
const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { Postgres } = require("../postgres");
const { loadConfig } = require("../config");
const tables = ["users", "profiles", "jobs", "resumes", "applications", "application_notes", "saved_jobs"];

async function importData(sql, source) {
  return sql.transaction(async () => {
    await sql.query("SELECT pg_advisory_xact_lock(734192)");
    if ((await sql.query("SELECT 1 FROM migrations WHERE name = 'sqlite-import-v1'")).rows.length) {
      return { alreadyImported: true };
    }
    // Never merge ambiguous IDs or overwrite accounts in a populated target.
    for (const table of tables) {
      if ((await sql.query(`SELECT 1 FROM ${table} LIMIT 1`)).rows.length) throw new Error("TARGET_NOT_EMPTY");
    }
    const counts = {};
    for (const table of tables) {
      const rows = source.prepare(`SELECT * FROM ${table}`).all();
      for (const row of rows) {
        const columns = Object.keys(row);
        if (table === "users") row.email = row.email.toLowerCase();
        if (table === "resumes") row.content = Buffer.from(row.content);
        await sql.query(`INSERT INTO ${table} (${columns.map(c => '"' + c + '"').join(',')}) VALUES (${columns.map((_, i) => '$' + (i + 1)).join(',')})`, columns.map(c => row[c]));
      }
      counts[table] = rows.length;
    }
    await sql.query("INSERT INTO migrations(name) VALUES ('sqlite-import-v1')");
    return counts;
  });
}
async function main() {
  const filename = path.resolve(process.argv[2] || path.join(__dirname, "../data/careerconnect.sqlite"));
  if (!fs.existsSync(filename)) throw new Error("SOURCE_MISSING");
  const source = new DatabaseSync(filename, { readOnly: true });
  let sql;
  try {
    source.exec("BEGIN"); // Consistent snapshot, including committed WAL records.
    sql = new Postgres(loadConfig());
    console.log(await importData(sql, source));
    console.log("Import complete. Existing passwords are preserved. Sign in again; old sessions were not imported.");
  } finally { source.close(); if (sql) await sql.close(); }
}
if (require.main === module) main().catch(error => {
  const known = ["TARGET_NOT_EMPTY", "SOURCE_MISSING"];
  console.error("Import failed; target transaction rolled back:", known.includes(error.message) ? error.message : error.code || "check database configuration and run db:setup first");
  process.exitCode = 1;
});
module.exports = { importData };

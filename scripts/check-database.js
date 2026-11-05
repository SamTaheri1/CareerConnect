const { Database } = require("../database");
const { loadConfig } = require("../config");
async function main() {
  const db = new Database(loadConfig());
  try {
    await db.initialize();
    for (const table of ["users", "profiles", "jobs", "resumes", "applications", "application_notes", "saved_jobs"]) {
      const result = await db.sql.query(`SELECT count(*) AS count FROM careerconnect.${table}`);
      console.log(`${table}: ${result.rows[0].count}`);
    }
    console.log("Connected to the shared PostgreSQL database.");
  } finally { await db.close(); }
}
main().catch(error => {
  console.error("Database check failed:", error.code || "check DATABASE_URL and run npm run db:setup");
  process.exitCode = 1;
});

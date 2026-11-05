const { test } = require("node:test");
const assert = require("node:assert/strict");
const { Database } = require("../database");
const { createTestDatabase } = require("./postgres-helper");
const { importData } = require("../scripts/import-sqlite");
const { setup } = require("../scripts/setup-database");

test("startup requires remote credentials and never falls back to SQLite", () => {
  assert.throws(() => new Database({}), /Set DATABASE_URL/);
  assert.throws(() => new Database({ databaseUrl: "file:local.sqlite" }), /PostgreSQL connection string/);
});

test("public Supabase roles cannot read accounts, sessions, or private resumes", async () => {
  const db = await createTestDatabase({ seed: false });
  try {
    for (const role of ["anon", "authenticated"]) {
      await db.sql.exec(`SET ROLE ${role}`);
      for (const table of ["users", "sessions", "resumes"]) {
        await assert.rejects(db.sql.query(`SELECT * FROM careerconnect.${table}`), error => error.code === "42501");
      }
      await db.sql.exec("RESET ROLE");
    }
  } finally { await db.sql.exec("RESET ROLE"); await db.close(); }
});

test("schema setup preserves data and legacy import is atomic and repeatable", async () => {
  const db = await createTestDatabase({ seed: false });
  const user = { id: "legacy", name: "Legacy", email: "LEGACY@example.com", role: "seeker", salt: "salt", password_hash: "hash" };
  const profile = { user_id: "legacy", bio: "Existing biography" };
  const resume = { id: "resume", user_id: "legacy", name: "cv.pdf", size: 5, content: Buffer.from("%PDF-"), created_at: "2026-01-01" };
  const rows = { users: [user], profiles: [profile], resumes: [resume] };
  const source = { prepare(sql) { return { all: () => structuredClone(rows[sql.split(' ').at(-1)] || []) }; } };
  try {
    assert.equal((await db.state(null)).jobs.length, 0);
    resume.user_id = "missing";
    await assert.rejects(importData(db.sql, source), error => error.code === "23503");
    assert.equal(await db.findByEmail("legacy@example.com"), null);
    resume.user_id = "legacy";
    const counts = await importData(db.sql, source);
    assert.equal(counts.users, 1);
    assert.equal(counts.resumes, 1);
    assert.equal((await db.findByEmail("LEGACY@example.com")).passwordHash, "hash");
    assert.equal((await db.state({ ...user, email: user.email.toLowerCase() })).users[0].profile.bio, "Existing biography");
    const file = await db.file(user, "get", "resume");
    assert.equal(Buffer.from(file.content).toString(), "%PDF-");
    assert.deepEqual(await importData(db.sql, source), { alreadyImported: true });
    await setup(db.sql);
    assert.equal((await db.findByEmail("legacy@example.com")).salt, "salt");
  } finally { await db.close(); }
});

test("legacy import refuses a populated target without overwriting accounts", async () => {
  const db = await createTestDatabase({ seed: false });
  try {
    await db.add({ user: { id: "new", name: "New", email: "new@example.com", role: "seeker" }, salt: "s", passwordHash: "h" });
    await assert.rejects(importData(db.sql, { prepare() { throw new Error("must not read source"); } }), /TARGET_NOT_EMPTY/);
    assert.equal((await db.findByEmail("new@example.com")).user.name, "New");
  } finally { await db.close(); }
});

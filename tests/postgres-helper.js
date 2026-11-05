const { PGlite } = require("@electric-sql/pglite");
const { Database } = require("../database");
const { setup } = require("../scripts/setup-database");
const { seedJobs } = require("../data");
const { createServer: realCreateServer } = require("../server");
const stores = new Map();

async function createTestDatabase({ seed = true } = {}) {
  const engine = new PGlite();
  await engine.exec("CREATE ROLE anon; CREATE ROLE authenticated;");
  let tail = Promise.resolve();
  const query = async (text, values = []) => {
    const result = values.length ? await engine.query(text, values) : (await engine.exec(text)).at(-1);
    return { rows: result?.rows || [], rowCount: result?.affectedRows ?? 0 };
  };
  const pool = {
    async connect() {
      const previous = tail;
      let release;
      tail = new Promise(resolve => { release = resolve; });
      await previous;
      return { query, release };
    },
    async query(text, values) {
      const client = await this.connect();
      try { return await client.query(text, values); } finally { client.release(); }
    },
    async end() { await tail; await engine.close(); },
  };
  const database = new Database({}, pool);
  await setup(database.sql);
  await database.sql.exec("SET search_path = careerconnect, pg_catalog");
  if (seed) for (const job of seedJobs) await database.saveJob({ ...job, ownerId: null, status: "Open",
    createdAt: new Date().toISOString(), deadline: "2099-12-31" });
  return database;
}
async function createServer(options = {}) {
  const key = options.databaseFile || options.dataFile || Symbol();
  if (!stores.has(key)) stores.set(key, await createTestDatabase());
  return realCreateServer({ ...options, store: stores.get(key), config: { openAiApiKey: "", ...options.config } });
}
async function closeStores() {
  for (const store of stores.values()) await store.close();
  stores.clear();
}
module.exports = { createTestDatabase, createServer, closeStores, stores };

const fs = require("node:fs");
const { AsyncLocalStorage } = require("node:async_hooks");
const { Pool } = require("pg");

// Each transaction keeps one connection, including nested database operations.
class Postgres {
  constructor(config, pool) {
    if (!pool && !config.databaseUrl) throw new Error("Set DATABASE_URL in .env to your Supabase Session pooler connection string. The public API key cannot replace a database password.");
    if (!pool) {
      const url = new URL(config.databaseUrl);
      if (!["postgres:", "postgresql:"].includes(url.protocol)) throw new Error("DATABASE_URL must be a PostgreSQL connection string.");
      for (const key of ["sslmode", "sslcert", "sslkey", "sslrootcert"]) url.searchParams.delete(key);
      pool = new Pool({ connectionString: url.toString(), max: 5, connectionTimeoutMillis: 10000,
        ssl: { rejectUnauthorized: true, ...(config.databaseCaFile ? { ca: fs.readFileSync(config.databaseCaFile, "utf8") } : {}) },
        options: "-c search_path=careerconnect,pg_catalog" });
      pool.on("error", () => console.error("Supabase database connection interrupted."));
    }
    this.pool = pool;
    this.context = new AsyncLocalStorage();
  }
  query(sql, values = []) { return (this.context.getStore() || this.pool).query(sql, values); }
  exec(sql) { return this.query(sql); }
  prepare(sql) {
    let index = 0;
    const statement = sql.replace(/\?/g, () => `$${++index}`);
    return {
      get: async (...values) => (await this.query(statement, values)).rows[0],
      all: async (...values) => (await this.query(statement, values)).rows,
      run: async (...values) => ({ changes: (await this.query(statement, values)).rowCount }),
    };
  }
  async transaction(work) {
    if (this.context.getStore()) return work();
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await this.context.run(client, work);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally { client.release(); }
  }
  close() { return this.pool.end(); }
}
module.exports = { Postgres };

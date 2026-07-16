import fs from "node:fs/promises";
import path from "node:path";
import { loadConfig } from "../src/config.js";
import { createPool } from "../src/db.js";

const config = loadConfig();
const pool = createPool(config);

try {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  const directory = path.join(process.cwd(), "migrations");
  const files = (await fs.readdir(directory)).filter((file) => file.endsWith(".sql")).sort();
  for (const file of files) {
    const exists = await pool.query(
      "SELECT 1 FROM schema_migrations WHERE filename = $1",
      [file],
    );
    if (exists.rowCount) continue;
    const sql = await fs.readFile(path.join(directory, file), "utf8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [file]);
      await client.query("COMMIT");
      console.log(`Applied ${file}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
} finally {
  await pool.end();
}

import pg from "pg";
import type { AppConfig } from "./config.js";

const { Pool } = pg;

export function createPool(config: AppConfig): pg.Pool {
  return new Pool({
    connectionString: config.DATABASE_URL,
    ssl: config.DATABASE_SSL ? { rejectUnauthorized: false } : false,
    max: 10,
  });
}

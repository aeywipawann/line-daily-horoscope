import fs from "node:fs/promises";
import path from "node:path";
import { DateTime } from "luxon";
import { loadConfig } from "../src/config.js";
import { createPool } from "../src/db.js";
import { Repository } from "../src/repositories.js";
import type { Horoscope } from "../src/types.js";

const config = loadConfig();
const pool = createPool(config);
const repository = new Repository(pool);

try {
  const json = await fs.readFile(
    path.join(process.cwd(), "seeds", "horoscopes.json"),
    "utf8",
  );
  const rows = JSON.parse(json) as Omit<Horoscope, "horoscopeDate" | "status">[];
  const today = DateTime.now().setZone("Asia/Bangkok").toISODate()!;
  for (const row of rows) {
    await repository.upsertHoroscope({
      ...row,
      horoscopeDate: today,
      status: "published",
    });
  }
  console.log(`Seeded ${rows.length} published horoscopes for ${today}`);
} finally {
  await pool.end();
}

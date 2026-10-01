/* Datenbank-Migrationen beim Start (Server/Docker) – ohne drizzle-kit.
   Liest DATABASE_URL und spielt alle Migrationen aus ./drizzle ein, die noch fehlen. */
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("[migrate] DATABASE_URL fehlt");
  process.exit(1);
}
const pool = new pg.Pool({ connectionString: url, max: 1, options: "-c TimeZone=UTC" });
try {
  await migrate(drizzle({ client: pool }), { migrationsFolder: "./drizzle" });
  console.log("[migrate] Datenbank ist aktuell");
} catch (e) {
  console.error("[migrate] fehlgeschlagen:", e);
  process.exitCode = 1;
} finally {
  await pool.end();
}

import "server-only";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

/* Datenbankverbindung (PostgreSQL über DATABASE_URL).
   - Server/Produktion: echtes PostgreSQL; Migrationen per `npm run db:migrate`.
   - Lokal: `npm run dev` startet eine PostgreSQL-kompatible Datei-Datenbank
     (PGlite unter .data/pglite, Port 5433), spielt die Migrationen ein und setzt
     DATABASE_URL für die App automatisch.
   Die Verbindung entsteht erst bei der ersten Abfrage – der Build braucht keine Datenbank. */

export type Db = NodePgDatabase<typeof schema>;

const MISSING = "DATABASE_URL fehlt – lokal die App mit `npm run dev` starten (startet die Datenbank mit).";

function createPool(): Pool {
  const url = process.env.DATABASE_URL;
  if (url) return new Pool({ connectionString: url, max: Number(process.env.DB_POOL_MAX || 10) });
  /* Ohne DATABASE_URL (z. B. beim Build): jede Abfrage schlägt mit klarer Meldung fehl */
  const pool = new Pool();
  const fail = () => Promise.reject(new Error(MISSING));
  Object.assign(pool, { connect: fail, query: fail });
  return pool;
}

/* Ein Pool pro Prozess – auch über Hot-Reloads im Dev-Modus hinweg. */
const KEY = Symbol.for("energyengel.db");
const holder = process as unknown as Record<symbol, Db | undefined>;
holder[KEY] ??= drizzle({ client: createPool(), schema });

export const db: Db = holder[KEY];
export { schema };

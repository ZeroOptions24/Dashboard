/* Test-Datenbank: PGlite im Speicher mit den echten Migrationen aus ./drizzle.
   Wird per vi.mock("@/server/db") statt der node-postgres-Verbindung eingesetzt. */
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "@/server/db/schema";

export async function createTestDb() {
  const client = new PGlite();
  await client.exec("SET TIME ZONE 'UTC'");
  const db = drizzle({ client, schema });
  await migrate(db, { migrationsFolder: "drizzle" });
  return { db, schema };
}

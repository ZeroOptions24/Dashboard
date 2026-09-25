import { defineConfig } from "drizzle-kit";

/* Migrationen erzeugen: npm run db:generate  (nach Änderungen an src/server/db/schema.ts)
   Auf dem Server einspielen: DATABASE_URL=… npm run db:migrate
   Lokal (PGlite) werden Migrationen beim Start der App automatisch eingespielt. */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
});

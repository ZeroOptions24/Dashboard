import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/* Automatische Tests: npm test
   - reine Logik (Rollen, IBAN, Kennzahlen, Kalender, Pipedrive-Zuordnung)
   - Rechteprüfungen des Servers gegen eine In-Memory-Datenbank (PGlite + echte Migrationen) */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      /* „server-only“ schützt im Next-Build vor Browser-Importen – in Tests ohne Bedeutung */
      "server-only": fileURLToPath(new URL("./tests/stubs/empty.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});

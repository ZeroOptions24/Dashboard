import { sql } from "drizzle-orm";
import { db } from "@/server/db";

/* Erreichbarkeit für Coolify und die Ausfall-Überwachung: 200, wenn App und Datenbank antworten. */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return Response.json({ ok: true }, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ ok: false, error: "Datenbank nicht erreichbar" }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}

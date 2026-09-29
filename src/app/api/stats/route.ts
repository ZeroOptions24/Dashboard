import { eq } from "drizzle-orm";
import { getSession } from "@/server/auth";
import { db, schema } from "@/server/db";
import { PipedriveNotConfigured } from "@/server/pipedrive/client";
import { statsForUser } from "@/server/stats";

/* Kennzahlen aus Pipedrive für die angemeldete Person (je Rolle gefiltert). */

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ error: "Nicht angemeldet" }, { status: 401 });
  try {
    const [p] = await db
      .select({ pipedriveSetterName: schema.profile.pipedriveSetterName })
      .from(schema.profile)
      .where(eq(schema.profile.userId, session.user.id));
    const stats = await statsForUser({ role: session.user.role || "setter", name: session.user.name, pipedriveSetterName: p?.pipedriveSetterName ?? null });
    return Response.json(stats, { headers: { "cache-control": "private, no-store" } });
  } catch (e) {
    if (e instanceof PipedriveNotConfigured) return Response.json({ error: e.message }, { status: 503 });
    console.error(e);
    return Response.json({ error: "Pipedrive nicht erreichbar" }, { status: 502 });
  }
}

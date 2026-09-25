import { eq } from "drizzle-orm";
import { getSession } from "@/server/auth";
import { db, schema } from "@/server/db";
import { PipedriveNotConfigured } from "@/server/pipedrive/client";
import { loadLeadsForUser } from "@/server/pipedrive/leads";

/* Leads aus Pipedrive für die angemeldete Person – serverseitig gefiltert:
   Setter nur ihre eigenen, Admins alle. Ohne Anmeldung: nichts. */

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ error: "Nicht angemeldet" }, { status: 401 });
  try {
    const [p] = await db
      .select({ pipedriveSetterName: schema.profile.pipedriveSetterName })
      .from(schema.profile)
      .where(eq(schema.profile.userId, session.user.id));
    const result = await loadLeadsForUser({
      role: session.user.role || "setter",
      name: session.user.name,
      pipedriveSetterName: p?.pipedriveSetterName ?? null,
    });
    return Response.json(result, { headers: { "cache-control": "private, no-store" } });
  } catch (e) {
    if (e instanceof PipedriveNotConfigured) return Response.json({ error: e.message }, { status: 503 });
    console.error(e);
    return Response.json({ error: "Pipedrive nicht erreichbar" }, { status: 502 });
  }
}

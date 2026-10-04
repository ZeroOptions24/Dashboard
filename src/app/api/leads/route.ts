import { parseRoles } from "@/lib/roles";
import { effectiveRoles } from "@/server/academy";
import { getSession } from "@/server/auth";
import { leadContext } from "@/server/lead-context";
import { PipedriveNotConfigured } from "@/server/pipedrive/client";
import { loadLeadsForUser } from "@/server/pipedrive/leads";

/* Leads aus Pipedrive für die angemeldete Person – serverseitig gefiltert:
   Setter nur ihre eigenen, Admins alle. Ohne Anmeldung: nichts. */

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ error: "Nicht angemeldet" }, { status: 401 });
  try {
    const result = await loadLeadsForUser({ id: session.user.id, roles: await effectiveRoles(session.user.id, parseRoles(session.user.role)) }, await leadContext(session.user.id));
    return Response.json(result, { headers: { "cache-control": "private, no-store" } });
  } catch (e) {
    if (e instanceof PipedriveNotConfigured) return Response.json({ error: e.message }, { status: 503 });
    console.error(e);
    return Response.json({ error: "Pipedrive nicht erreichbar" }, { status: 502 });
  }
}

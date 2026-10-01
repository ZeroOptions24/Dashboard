import { parseRoles } from "@/lib/roles";
import { getSession } from "@/server/auth";
import { leadContext } from "@/server/lead-context";
import { PipedriveNotConfigured } from "@/server/pipedrive/client";
import { statsForUser } from "@/server/stats";

/* Kennzahlen aus Pipedrive für die angemeldete Person (je Rolle gefiltert). */

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ error: "Nicht angemeldet" }, { status: 401 });
  try {
    const stats = await statsForUser({ id: session.user.id, roles: parseRoles(session.user.role) }, await leadContext(session.user.id));
    return Response.json(stats, { headers: { "cache-control": "private, no-store" } });
  } catch (e) {
    if (e instanceof PipedriveNotConfigured) return Response.json({ error: e.message }, { status: 503 });
    console.error(e);
    return Response.json({ error: "Pipedrive nicht erreichbar" }, { status: 502 });
  }
}

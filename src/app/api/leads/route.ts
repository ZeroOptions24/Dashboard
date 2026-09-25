import { PipedriveNotConfigured } from "@/server/pipedrive/client";
import { loadLeadsFromPipedrive } from "@/server/pipedrive/leads";

/* Leads aus Pipedrive für das Dashboard.
   ACHTUNG: Es gibt noch keinen Login. Bis Login und Rollenrechte stehen, liefert
   dieser Endpunkt nur im lokalen Entwicklungsmodus Daten – nie auf einem Server. */

export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return Response.json({ error: "Nur lokal verfügbar, bis Login und Rollenrechte umgesetzt sind." }, { status: 403 });
  }
  try {
    const leads = await loadLeadsFromPipedrive();
    return Response.json({ leads }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    if (e instanceof PipedriveNotConfigured) return Response.json({ error: e.message }, { status: 503 });
    console.error(e);
    return Response.json({ error: "Pipedrive nicht erreichbar" }, { status: 502 });
  }
}

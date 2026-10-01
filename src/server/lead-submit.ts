import "server-only";
import { eq } from "drizzle-orm";
import { isAdmin } from "@/lib/roles";
import type { FormValues } from "@/lib/vq";
import { db, schema } from "./db";
import { invalidateLeadCache } from "./pipedrive/leads";
import type { Viewer } from "./workspace";

/* „Lead erfassen“ im Dashboard → derselbe n8n-Webhook wie das bisherige Setter-Formular (wp-lead).
   Gleiches Format, damit n8n unverändert den Deal in Pipedrive anlegt und den Setter über den
   Setter-Link-Code zuordnet. Adresse: N8N_WP_LEAD_URL (Server-Einstellung). */

const s = (v: FormValues, k: string) => String(v[k] ?? "").trim().slice(0, 300);
const list = (v: FormValues, k: string) => (Array.isArray(v[k]) ? (v[k] as string[]).map((x) => String(x).slice(0, 80)).slice(0, 20) : []);

/** Gleiche Struktur wie buildPayload() im Formular waermepumpe-lead-formular.html */
export function buildLeadPayload(v: FormValues, setterCode: string, standort: unknown, now = new Date()) {
  const rueckruf = [s(v, "rueckruf_datum"), s(v, "rueckruf_uhrzeit") && `${s(v, "rueckruf_uhrzeit")} Uhr`].filter(Boolean).join(" ");
  const fenster = list(v, "zeitfenster");
  return {
    kunde: {
      anrede: s(v, "anrede"),
      vorname: s(v, "vorname"),
      nachname: s(v, "nachname"),
      name: `${s(v, "vorname")} ${s(v, "nachname")}`.trim(),
      telefon: s(v, "telefon"),
      email: s(v, "email"),
      strasse: s(v, "strasse"),
      hausnummer: s(v, "hausnummer"),
      plz: s(v, "plz"),
      stadt: s(v, "stadt"),
      adresse: `${s(v, "strasse")} ${s(v, "hausnummer")}, ${s(v, "plz")} ${s(v, "stadt")}`.trim(),
    },
    termin: {
      thema: list(v, "thema"),
      thema_text: list(v, "thema").join(", "),
      alle_entscheider: s(v, "alle_entscheider"),
    },
    rueckruf: {
      datum: s(v, "rueckruf_datum"),
      uhrzeit: s(v, "rueckruf_uhrzeit"),
      zeitfenster: fenster,
      zeitfenster_text: fenster.join(" / "),
      text: [rueckruf, fenster.length ? `Erreichbar: ${fenster.join(" / ")}` : ""].filter(Boolean).join(" · "),
    },
    notizen: s(v, "notizen"),
    meta: { quelle: "MB-Dashboard", setter: setterCode, standort: standort ?? null, datum: now.toISOString() },
  };
}

export async function submitLead(v: Viewer, values: FormValues, standort: unknown): Promise<{ dealId: number | null }> {
  if (!v.roles.includes("setter") && !isAdmin(v.roles)) throw new Error("Nur Setter erfassen Leads");
  for (const k of ["vorname", "nachname", "telefon", "email", "strasse", "hausnummer", "plz", "stadt"])
    if (!s(values, k)) throw new Error("Bitte alle Pflichtfelder ausfüllen");
  const url = process.env.N8N_WP_LEAD_URL?.trim();
  if (!url) throw new Error("Die Übertragung nach Pipedrive ist noch nicht eingerichtet (N8N_WP_LEAD_URL fehlt)");
  const [p] = await db.select({ code: schema.profile.setterCode }).from(schema.profile).where(eq(schema.profile.userId, v.id));
  const code = p?.code ?? "";
  if (!code && !isAdmin(v.roles)) throw new Error("Für dich ist noch kein Setter-Link-Code hinterlegt – bitte kurz beim Admin melden");
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(buildLeadPayload(values, code, standort)),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Lead konnte nicht übertragen werden (n8n: HTTP ${res.status})`);
  let dealId: number | null = null;
  try {
    const body = (await res.json()) as { dealId?: unknown };
    dealId = Number(body.dealId) || null;
  } catch {
    /* ältere n8n-Antwort ohne JSON */
  }
  await db.insert(schema.auditLog).values({ actorId: v.id, action: "lead.submitted", detail: dealId ? `Deal ${dealId}` : "ohne Deal-ID" });
  invalidateLeadCache();
  return { dealId };
}

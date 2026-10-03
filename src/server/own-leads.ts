import "server-only";
import { randomBytes } from "node:crypto";
import { desc, eq, gte, isNotNull, isNull, or } from "drizzle-orm";
import { normStatus, STATUS } from "@/lib/domain";
import { isCalling } from "@/lib/leads";
import type { HistoryEntry, Lead, StatusKey } from "@/lib/types";
import type { FormValues } from "@/lib/vq";
import { db, schema } from "./db";
import { createDeal, createPerson, deleteDeal, patchDeal } from "./pipedrive/client";
import { getPipelineConfig, PIPELINE_STAGES, stageFor, type PipelineConfig } from "./pipedrive/dashboard-pipeline";
import { maskPhone } from "./pipedrive/leads";

/* Leads aus „Lead erfassen“: vollständig in der eigenen Datenbank (jedes Feld einzeln) und als Person + Deal
   in der Dashboard-Pipeline in Pipedrive. Das Dashboard ist die Quelle der Wahrheit – jede Änderung wird
   nach Pipedrive geschrieben (syncOwnLead). Lead-IDs: „MB-…“. */

type Row = typeof schema.ownLead.$inferSelect;

const s = (v: FormValues, k: string) => String(v[k] ?? "").trim().slice(0, 300);
const list = (v: FormValues, k: string) => (Array.isArray(v[k]) ? (v[k] as string[]).map((x) => String(x).slice(0, 80)).slice(0, 20) : []);
const json = <T>(x: string | null | undefined, d: T): T => {
  try {
    return x ? (JSON.parse(x) as T) : d;
  } catch {
    return d;
  }
};
const TZ = "Europe/Berlin";
const part = (d: Date, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("de-DE", { timeZone: TZ, ...o }).format(d);
const fmtDate = (d: Date) => part(d, { day: "2-digit", month: "2-digit", year: "numeric" });
/** „02.10. 18:05“ wie im Pipedrive-Verlauf */
const stamp = (d: Date) => `${part(d, { day: "2-digit", month: "2-digit" })} ${part(d, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" })}`;
const isoToDe = (k: string) => (/^\d{4}-\d{2}-\d{2}$/.test(k) ? `${k.slice(8)}.${k.slice(5, 7)}.${k.slice(0, 4)}` : k);

export const isOwnLeadId = (id: string) => /^MB-[a-f0-9]{10}$/.test(id);

/** Rückrufwunsch als Text, wie im Formular */
const rueckrufText = (r: Pick<Row, "rueckrufDatum" | "rueckrufUhrzeit" | "zeitfenster">) =>
  [r.rueckrufDatum ? isoToDe(r.rueckrufDatum) : "", r.rueckrufUhrzeit ? `${r.rueckrufUhrzeit} Uhr` : "", json<string[]>(r.zeitfenster, []).length ? `Zeitfenster: ${json<string[]>(r.zeitfenster, []).join(" / ")}` : ""]
    .filter(Boolean)
    .join(", ");

/* ---------- Anlegen ---------- */

export async function createOwnLead(setterId: string, values: FormValues, standort: { lat?: unknown; lon?: unknown } | null) {
  const required = ["vorname", "nachname", "telefon", "strasse", "hausnummer", "plz", "stadt"];
  for (const k of required) if (!s(values, k)) throw new Error("Bitte alle Pflichtfelder ausfüllen");
  const lat = Number(standort?.lat),
    lon = Number(standort?.lon);
  const id = `MB-${randomBytes(5).toString("hex")}`;
  await db.insert(schema.ownLead).values({
    id,
    setterId,
    anrede: s(values, "anrede") || null,
    vorname: s(values, "vorname"),
    nachname: s(values, "nachname"),
    telefon: s(values, "telefon"),
    email: s(values, "email") || null,
    strasse: s(values, "strasse"),
    hausnummer: s(values, "hausnummer"),
    plz: s(values, "plz"),
    ort: s(values, "stadt"),
    themen: JSON.stringify(list(values, "thema")),
    entscheider: s(values, "alle_entscheider") || null,
    rueckrufDatum: s(values, "rueckruf_datum") || null,
    rueckrufUhrzeit: s(values, "rueckruf_uhrzeit") || null,
    zeitfenster: JSON.stringify(list(values, "zeitfenster")),
    notizen: s(values, "notizen") || null,
    gpsLat: Number.isFinite(lat) ? lat : null,
    gpsLon: Number.isFinite(lon) ? lon : null,
  });
  const sync = await syncOwnLead(id);
  return { id, dealId: sync.dealId, syncError: sync.error };
}

/** Status/Grund/Vorqualifizierung ändern und nach Pipedrive schreiben */
export async function updateOwnLead(id: string, patch: { status?: StatusKey; reason?: string | null; reasonNote?: string | null; vq?: Record<string, string> }) {
  const set: Partial<Row> = { updatedAt: new Date() };
  if (patch.status) set.status = patch.status;
  if (patch.reason !== undefined) set.reason = patch.reason;
  if (patch.reasonNote !== undefined) set.reasonNote = patch.reasonNote;
  if (patch.vq) set.vq = JSON.stringify(patch.vq);
  await db.update(schema.ownLead).set(set).where(eq(schema.ownLead.id, id));
  return syncOwnLead(id);
}

/* ---------- Abgleich mit Pipedrive ---------- */

async function nameOf(userId: string | null | undefined) {
  if (!userId) return "";
  const [u] = await db.select({ name: schema.user.name, pd: schema.profile.pipedriveSetterName }).from(schema.user).leftJoin(schema.profile, eq(schema.profile.userId, schema.user.id)).where(eq(schema.user.id, userId));
  return u ? u.pd || u.name.split(" ")[0] : "";
}

/** Alle Felder für den Deal aus dem aktuellen Stand im Dashboard */
async function dealFields(row: Row, cfg: PipelineConfig) {
  const f = cfg.fields;
  const acts = await db.select().from(schema.leadActivity).where(eq(schema.leadActivity.leadId, row.id)).orderBy(desc(schema.leadActivity.createdAt));
  const presetterId = acts.find((a) => a.role === "presetter")?.userId;
  const versuche = acts.filter((a) => a.kind === "attempt").length;
  const [appt] = await db.select().from(schema.appointment).where(eq(schema.appointment.leadId, row.id)).orderBy(desc(schema.appointment.createdAt)).limit(1);
  /* vorgemerkt (Setter) = noch kein Closer; im Feld „MB Termin“ als „vorgemerkt …“ */
  const termin = appt ? `${appt.reserved ? "vorgemerkt " : ""}${isoToDe(appt.date)} ${String(Math.floor(appt.start)).padStart(2, "0")}:${appt.start % 1 ? "30" : "00"}` : "";
  const custom: Record<string, unknown> = {
    [f.setter]: await nameOf(row.setterId),
    [f.thema]: json<string[]>(row.themen, []).join(", "),
    [f.entscheider]: row.entscheider ?? "",
    [f.rueckruf]: rueckrufText(row),
    [f.setterNotiz]: row.notizen ?? "",
    [f.strasse]: `${row.strasse} ${row.hausnummer}`.trim(),
    [f.plz]: row.plz,
    [f.ort]: row.ort,
    [f.presetter]: await nameOf(presetterId),
    [f.closer]: appt && !appt.reserved ? await nameOf(appt.closerId) : "",
    [f.termin]: termin,
    [f.versuche]: versuche,
    [f.gps]: row.gpsLat != null && row.gpsLon != null ? `${row.gpsLat}, ${row.gpsLon}` : "",
    [f.dashboardId]: row.id,
  };
  for (const [name, val] of Object.entries(json<Record<string, string>>(row.vq, {}))) if (cfg.vq[name]) custom[cfg.vq[name]] = val;
  return custom;
}

/** Stufe/Status in Pipedrive aus dem Dashboard-Status */
function dealState(row: Row, cfg: PipelineConfig, versuche: number) {
  const st = normStatus(row.status);
  if (st === "abgesagt" || st === "verloren") return { status: "lost" as const, lost_reason: [row.reason, row.reasonNote].filter(Boolean).join(" – ") || STATUS[st].label };
  const stage_id = cfg.stages[stageFor(st, versuche)];
  return { status: st === "verkauft" || st === "ausgezahlt" ? ("won" as const) : ("open" as const), stage_id };
}

/** Person + Deal anlegen bzw. aktualisieren. Fehler werden am Lead vermerkt (syncError) und beim nächsten Abgleich erneut versucht. */
export async function syncOwnLead(id: string): Promise<{ dealId: number | null; error: string | null }> {
  const [row] = await db.select().from(schema.ownLead).where(eq(schema.ownLead.id, id));
  if (!row) throw new Error("Lead nicht gefunden");
  const cfg = await getPipelineConfig();
  const fail = async (error: string) => {
    await db.update(schema.ownLead).set({ syncError: error.slice(0, 300) }).where(eq(schema.ownLead.id, id));
    return { dealId: row.pdDealId, error };
  };
  if (!cfg) return fail("Die Dashboard-Pipeline in Pipedrive ist noch nicht eingerichtet");
  if (PIPELINE_STAGES.some(([k]) => !cfg.stages[k])) return fail("Die Stufen der Dashboard-Pipeline sind veraltet – bitte unter Team „Pipeline anlegen“ erneut ausführen");
  try {
    const custom = await dealFields(row, cfg);
    const state = dealState(row, cfg, Number(custom[cfg.fields.versuche]) || 0);
    let { pdPersonId: personId, pdDealId: dealId } = row;
    if (!personId) {
      personId = await createPerson({
        name: `${row.vorname} ${row.nachname}`.trim(),
        phone: row.telefon,
        email: row.email,
        address: { value: `${row.strasse} ${row.hausnummer}, ${row.plz} ${row.ort}`, route: row.strasse, street_number: row.hausnummer, postal_code: row.plz, locality: row.ort },
      });
      await db.update(schema.ownLead).set({ pdPersonId: personId }).where(eq(schema.ownLead.id, id));
    }
    if (!dealId) {
      dealId = await createDeal({
        title: `${json<string[]>(row.themen, [])[0] || "Wärmepumpe"} – ${row.vorname} ${row.nachname}`.trim(),
        personId,
        pipelineId: cfg.pipelineId,
        stageId: cfg.stages.eingereicht,
        customFields: custom,
      });
      await db.update(schema.ownLead).set({ pdDealId: dealId }).where(eq(schema.ownLead.id, id));
      if (state.status !== "open" || state.stage_id !== cfg.stages.eingereicht) await patchDeal(dealId, state);
    } else {
      await patchDeal(dealId, { ...state, custom_fields: custom });
    }
    await db.update(schema.ownLead).set({ syncedAt: new Date(), syncError: null }).where(eq(schema.ownLead.id, id));
    return { dealId, error: null };
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Pipedrive nicht erreichbar");
  }
}

/** Leads, deren letzter Abgleich fehlgeschlagen ist oder noch fehlt, erneut abgleichen (z. B. täglich per Cron) */
export async function retryOwnLeadSync() {
  const rows = await db.select({ id: schema.ownLead.id }).from(schema.ownLead).where(or(isNull(schema.ownLead.pdDealId), isNotNull(schema.ownLead.syncError)));
  const res = [];
  for (const r of rows) res.push({ id: r.id, ...(await syncOwnLead(r.id)) });
  return res;
}

/* ---------- Für die Ansichten ---------- */

export function ownLeadToLead(r: Row): Lead {
  const kunde = `${r.vorname} ${r.nachname}`.trim();
  const created = r.createdAt;
  const wunsch = rueckrufText(r);
  const hist: HistoryEntry[] = [["Lead eingereicht (an der Tür im Dashboard erfasst)", stamp(created)]];
  return {
    id: r.id,
    pd: r.pdDealId,
    kunde,
    anrede: `${r.anrede || "Familie"} ${r.nachname}`.trim(),
    tel: maskPhone(r.telefon),
    telFull: r.telefon,
    ort: r.ort,
    adresse: `${r.strasse} ${r.hausnummer}, ${r.plz} ${r.ort}`,
    email: r.email ?? undefined,
    produkt: "wp",
    status: normStatus(r.status),
    setter: r.setterId ?? "unbekannt",
    datum: fmtDate(created),
    setNote: r.notizen ?? "",
    preNote: "",
    hist,
    attempts: 0,
    nextTry: isCalling(normStatus(r.status)) && r.rueckrufDatum ? `Rückruf ${isoToDe(r.rueckrufDatum)}${r.rueckrufUhrzeit ? ` ${r.rueckrufUhrzeit}` : ""}` : null,
    reason: r.reason,
    reasonNote: r.reasonNote ?? "",
    eigenlead: true,
    entscheider: r.entscheider ?? undefined,
    themen: json<string[]>(r.themen, []),
    rueckrufWunsch: wunsch || undefined,
    gps: r.gpsLat != null && r.gpsLon != null ? { lat: r.gpsLat, lon: r.gpsLon } : undefined,
    vq: Object.keys(json<Record<string, string>>(r.vq, {})).length ? json<Record<string, string>>(r.vq, {}) : undefined,
    pdAddTime: created.toISOString(),
    pdChangedAt: r.updatedAt.toISOString(),
  };
}

/** Eigene Leads der letzten 18 Monate (neueste zuerst) */
export async function loadOwnLeads(): Promise<Lead[]> {
  const rows = await db
    .select()
    .from(schema.ownLead)
    .where(gte(schema.ownLead.createdAt, new Date(Date.now() - 548 * 864e5)))
    .orderBy(desc(schema.ownLead.createdAt));
  return rows.map(ownLeadToLead);
}

export async function getOwnLead(id: string) {
  const [r] = await db.select().from(schema.ownLead).where(eq(schema.ownLead.id, id));
  return r ? ownLeadToLead(r) : null;
}

/** Überblick für Admins: wie viele Leads im Dashboard erfasst, wie viele (noch) nicht in Pipedrive */
export async function ownLeadStats() {
  const rows = await db.select({ dealId: schema.ownLead.pdDealId, err: schema.ownLead.syncError }).from(schema.ownLead);
  return { total: rows.length, inPipedrive: rows.filter((r) => r.dealId).length, fehler: rows.filter((r) => r.err).length };
}

/** Im Dashboard erfassten Lead löschen (z. B. Testlauf oder Fehleingabe): Deal in Pipedrive in den Papierkorb,
 *  Lead samt Aktionen und Terminen im Dashboard entfernen. Nur Admins (Aufrufer prüft). */
export async function deleteOwnLead(id: string, adminId: string) {
  const [row] = await db.select().from(schema.ownLead).where(eq(schema.ownLead.id, id));
  if (!row) throw new Error("Lead nicht gefunden");
  if (row.pdDealId) await deleteDeal(row.pdDealId);
  await db.delete(schema.appointment).where(eq(schema.appointment.leadId, id));
  await db.delete(schema.leadActivity).where(eq(schema.leadActivity.leadId, id));
  await db.delete(schema.leadLock).where(eq(schema.leadLock.leadId, id));
  await db.delete(schema.ownLead).where(eq(schema.ownLead.id, id));
  await db.insert(schema.auditLog).values({ actorId: adminId, action: "lead.deleted", detail: `${id} (${row.vorname} ${row.nachname})${row.pdDealId ? ` · Deal ${row.pdDealId}` : ""}` });
}

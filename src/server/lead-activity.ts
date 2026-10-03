import "server-only";
import { gte } from "drizzle-orm";
import { STATUS } from "@/lib/domain";
import type { ActivityKind, ActivityRow } from "@/lib/lead-activity";
import { nextTryText } from "@/lib/lead-activity";
import { isAdmin } from "@/lib/roles";
import type { Lead, Role, StatusKey } from "@/lib/types";
import { vqSummary } from "@/lib/vq";
import { db, schema } from "./db";
import { addDealNote, pipedriveWriteMode, updateDeal, type DealUpdate } from "./pipedrive/client";
import { invalidateLeadCache, loadLeadsFromPipedrive, withAssignments } from "./pipedrive/leads";
import { getOwnLead, isOwnLeadId, updateOwnLead } from "./own-leads";
import { loadSetterAssignments } from "./setter-assignment";
import { leadIdsForCloser, notify, setterIdMap, type Viewer } from "./workspace";

/* Aktionen an Pipedrive-Leads aus dem Dashboard (Presetter-Pool, Closer, Admin):
   speichern (lead_activity) und – wenn PIPEDRIVE_WRITE=true – nach Pipedrive zurückschreiben. */

const DAY = 864e5;

/** Aktivitäten der letzten 120 Tage (für Verlauf, Pool und Kennzahlen) */
export async function loadActivities(): Promise<ActivityRow[]> {
  const rows = await db.select().from(schema.leadActivity).where(gte(schema.leadActivity.createdAt, new Date(Date.now() - 120 * DAY)));
  return rows.map((r) => ({
    leadId: r.leadId,
    userId: r.userId,
    role: r.role as Role,
    kind: r.kind as ActivityKind,
    text: r.text,
    data: JSON.parse(r.data) as Record<string, unknown>,
    createdAt: r.createdAt.toISOString(),
  }));
}

export type LeadAction =
  | { type: "status"; status: StatusKey | "nicht_erreicht"; reason?: string; note?: string; silent?: boolean }
  | { type: "callback"; date: string; time: string; note?: string }
  | { type: "vq"; answers: Record<string, string> }
  | { type: "note"; text: string };

/** Pipedrive-Stufen der bisherigen Pipeline „Empfehlung kommt“ – siehe config.ts (Verkaufstermin gibt es dort nicht → Checks) */
const STAGE = { kontaktieren: 245, kontaktieren2: 249, uebergeben: 181, checks: 183, verkauf: 184 };

const clean = (s: unknown, max = 500) => String(s ?? "").trim().slice(0, max);
const fmtDate = (k: string) => (/^\d{4}-\d{2}-\d{2}$/.test(k) ? `${k.slice(8)}.${k.slice(5, 7)}.` : k);

export interface ActionResult {
  /** Hinweis, wenn Pipedrive nicht aktualisiert werden konnte */
  warning?: string;
  /** neuer Stand des Leads (Versuche, nächster Versuch) */
  attempts?: number;
  nextTry?: string | null;
}

export async function recordLeadAction(v: Viewer & { name: string }, role: Role, leadId: string, action: LeadAction): Promise<ActionResult> {
  /* Rolle muss zur Person gehören; Admins dürfen jede Ansicht nutzen */
  if (!isAdmin(v.roles) && !v.roles.includes(role)) throw new Error("Keine Berechtigung");
  /* Zwei Arten von Leads: „MB-…“ = im Dashboard erfasst (Dashboard ist Quelle der Wahrheit),
     „PD-…“ = aus der bisherigen Pipedrive-Pipeline */
  const isOwn = isOwnLeadId(leadId);
  if (!isOwn && !/^PD-\d+$/.test(leadId)) throw new Error("Lead ist noch nicht in Pipedrive");
  let lead: Lead;
  if (isOwn) {
    const own = await getOwnLead(leadId);
    if (!own) throw new Error("Lead nicht gefunden");
    lead = own;
  } else {
    const raw = (await loadLeadsFromPipedrive()).find((l) => l.id === leadId);
    if (!raw) throw new Error("Lead nicht gefunden");
    /* Setter aus Pipedrive oder – wenn dort leer – aus der Zuweisung im Dashboard */
    [lead] = withAssignments([raw], await loadSetterAssignments());
  }
  /* Nutzer-ID des Setters (eigene Leads speichern sie direkt, Pipedrive-Leads über den Setter-Namen) */
  const setterUserId = isOwn ? lead.setter : ((await setterIdMap()).get(lead.setter) ?? null);
  /* Setter: nur an eigenen Leads – Vorqualifizierung/Notiz an der Tür und Absage (K.-o.-Kriterium) */
  if (role === "setter") {
    const own = setterUserId === v.id;
    const allowed = action.type === "vq" || action.type === "note" || (action.type === "status" && action.status === "abgesagt");
    if (!own || !allowed) throw new Error("Nur Presetter, Closer und Admins bearbeiten Leads");
  } else if (!["presetter", "closer", "admin"].includes(role)) throw new Error("Nur Presetter, Closer und Admins bearbeiten Leads");
  /* Closer nur an Leads mit Termin bei ihnen; Presetter im gemeinsamen Pool (alle Leads der Pipeline) */
  if (role === "closer" && !isAdmin(v.roles) && !(await leadIdsForCloser(v.id)).has(leadId)) throw new Error("Keine Berechtigung für diesen Lead");

  const past = (await loadActivities()).filter((a) => a.leadId === leadId);
  const first = v.name.split(" ")[0];
  let kind: ActivityKind,
    text: string,
    data: Record<string, unknown>,
    patch: DealUpdate | null = null,
    pdNote: string | null = null;
  const result: ActionResult = {};

  if (action.type === "status" && action.status === "nicht_erreicht") {
    const n = Math.max(lead.attempts, ...past.filter((a) => a.kind === "attempt").map((a) => Number(a.data.attempt) || 0)) + 1;
    const detail = clean(action.reason, 40);
    kind = "attempt";
    text = `Nicht erreicht (Versuch ${n})${detail ? ` – ${detail}` : ""}`;
    data = { attempt: n, detail };
    patch = { stage_id: n === 1 ? STAGE.kontaktieren : STAGE.kontaktieren2 };
    pdNote = `${text} – ${first} (MB-Dashboard)`;
    result.attempts = n;
    result.nextTry = nextTryText(n);
  } else if (action.type === "status") {
    const status = action.status as StatusKey;
    if (!STATUS[status]) throw new Error("Status ungültig");
    const reason = clean(action.reason, 120),
      note = clean(action.note, 1000);
    if ((status === "abgesagt" || status === "verloren") && !reason) throw new Error("Bitte einen Grund wählen");
    kind = "status";
    text = STATUS[status].label + (reason ? ` – ${reason}` : "");
    data = { status, reason, note };
    patch =
      status === "aufmass"
        ? { stage_id: STAGE.uebergeben }
        : status === "checks" || status === "verkaufstermin"
          ? { stage_id: STAGE.checks }
          : status === "verkauft"
            ? { stage_id: STAGE.verkauf, status: "won" }
            : status === "abgesagt" || status === "verloren"
              ? { status: "lost", lost_reason: note ? `${reason} – ${note}` : reason }
              : null;
    /* Gesprächsnotiz und Vorqualifizierung gehen mit dem Ergebnis als eine Notiz nach Pipedrive */
    const lastNote = [...past].reverse().find((a) => a.kind === "note")?.data.text as string | undefined;
    const lastVq = [...past].reverse().find((a) => a.kind === "vq")?.data.answers as Record<string, string> | undefined;
    const vq = lastVq ? vqSummary(lastVq) : "";
    pdNote = [`${text} – ${first} (MB-Dashboard)`, note && `Notiz: ${note}`, lastNote && `Gespräch: ${lastNote}`, vq && `Vorqualifizierung: ${vq}`].filter(Boolean).join("\n");
    result.nextTry = null;
  } else if (action.type === "callback") {
    const when = `${fmtDate(clean(action.date, 10))} ${clean(action.time, 5)}`.trim();
    const note = clean(action.note, 1000);
    kind = "callback";
    text = `Rückruf vereinbart: ${when}${note ? ` – ${note}` : ""}`;
    data = { date: action.date, time: action.time, note, when };
    pdNote = `${text} – ${first} (MB-Dashboard)`;
    result.nextTry = `Rückruf ${when}`;
  } else if (action.type === "note") {
    kind = "note";
    text = "Notiz";
    data = { text: clean(action.text, 2000) };
  } else {
    kind = "vq";
    text = "Vorqualifizierung";
    const answers = Object.fromEntries(
      Object.entries(action.answers ?? {})
        .slice(0, 80)
        .map(([k, val]) => [clean(k, 60), clean(val, 300)]),
    );
    data = { answers };
  }

  /* Eigene Leads: Dashboard ist Quelle der Wahrheit – Stand speichern und Deal immer aktualisieren */
  if (isOwn) {
    await db.insert(schema.leadActivity).values({ leadId, userId: v.id, role, kind, text, data: JSON.stringify(data) });
    const upd =
      kind === "status"
        ? { status: data.status as StatusKey, reason: (data.reason as string) || null, reasonNote: (data.note as string) || null }
        : kind === "vq"
          ? { vq: data.answers as Record<string, string> }
          : /* erster Anrufversuch bzw. Rückruf: Presetter ist in Kontakt */
            (kind === "attempt" || kind === "callback") && lead.status === "eingereicht"
            ? { status: "terminierung" as StatusKey }
            : {};
    const sync = await updateOwnLead(leadId, upd);
    if (!sync.error && pdNote && sync.dealId) await addDealNote(sync.dealId, pdNote).catch(() => {});
    if (sync.error) result.warning = `In Pipedrive noch nicht übernommen (${sync.error}) – im Dashboard gespeichert, wird erneut versucht`;
    await notifySetter(kind, action, text, lead, setterUserId, v.id);
    return result;
  }

  /* Bisherige Pipeline: Zurückschreiben nach Pipedrive nur, wenn eingeschaltet */
  let pd: string | null = null;
  const mode = pipedriveWriteMode();
  if (mode !== "aus" && (patch || pdNote) && lead.pd) {
    try {
      /* Stufe/Status nur im Modus „alles“ – vorerst verschiebt das Dashboard nichts in Pipedrive */
      if (patch && mode === "alles") await updateDeal(lead.pd, patch);
      if (pdNote) await addDealNote(lead.pd, pdNote);
      pd = "ok";
      invalidateLeadCache();
    } catch (e) {
      pd = e instanceof Error ? e.message : "Fehler";
      result.warning = `In Pipedrive nicht übernommen (${pd}) – im Dashboard gespeichert`;
    }
  }

  await db.insert(schema.leadActivity).values({ leadId, userId: v.id, role, kind, text, data: JSON.stringify(data), pipedrive: pd });

  await notifySetter(kind, action, text, lead, setterUserId, v.id);
  return result;
}

/** Setter über Ergebnisse und Rückrufe informieren (nicht bei Closer-Rückmeldungen – das macht saveFeedback) */
async function notifySetter(kind: ActivityKind, action: LeadAction, text: string, lead: Lead, setterUserId: string | null, actorId: string) {
  if (!setterUserId || setterUserId === actorId) return;
  if (action.type === "status" && !action.silent && kind === "status") await notify([setterUserId], `${lead.kunde}: ${text}`, action.status as StatusKey);
  else if (action.type === "callback") await notify([setterUserId], `${lead.kunde}: ${text}`, "terminierung");
}

import "server-only";
import { AFTER_TERMIN, STATUS } from "@/lib/domain";
import { isCalling } from "@/lib/leads";
import { normalizeVq } from "@/lib/vq";
import { isAdmin } from "@/lib/roles";
import type { HistoryEntry, Lead, Role, StatusKey } from "@/lib/types";
import { applyActivities, type ActivityRow } from "@/lib/lead-activity";
import { getDeals, getPersons, getRecentNotes, type PdDeal, type PdPerson } from "./client";
import { isLeadNote, parseLeadNote, type LeadNote } from "./note";
import { DEAL_FIELDS, PIPEDRIVE_PIPELINE_ID, STAGE_ATTEMPTS, STAGE_TO_STATUS, VQ_DEAL_FIELDS, WP_TITLE_PREFIXES } from "./config";

/* Pipedrive-Deals → Dashboard-Leads. */

/** Zeitpunkt in deutscher Zeit als Teile */
function berlin(iso: string) {
  const parts = new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z"));
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  return { d: p.day, m: p.month, y: p.year, time: `${p.hour}:${p.minute}` };
}
const stamp = (iso: string) => {
  const b = berlin(iso);
  return `${b.d}.${b.m}. ${b.time}`;
};
const date = (iso: string) => {
  const b = berlin(iso);
  return `${b.d}.${b.m}.${b.y}`;
};

/** Telefonnummer maskieren, bis Login und Rollenrechte stehen. */
export const maskPhone = (tel: string) => {
  const t = tel.replace(/\s+/g, " ").trim();
  const digits = t.replace(/\s/g, "");
  return digits.length > 8 ? `${t.slice(0, 4)} •••• ${digits.slice(-4)}` : t;
};

/** Setter-Name → Schlüssel für den Vergleich (klein, ohne doppelte Leerzeichen).
 *  Gleiche Funktion für das Deal-Feld und den im Dashboard hinterlegten Namen. */
export const setterKey = (name: unknown) =>
  typeof name === "string" && name.trim() ? name.trim().replace(/\s+/g, " ").toLowerCase() : "unbekannt";

export function statusOf(deal: PdDeal): StatusKey {
  if (deal.status === "won") return "verkauft";
  const s = STAGE_TO_STATUS[deal.stage_id] ?? "eingereicht";
  /* Verloren nach einem Termin, sonst abgesagt */
  if (deal.status === "lost") return AFTER_TERMIN.includes(s) ? "verloren" : "abgesagt";
  /* schon angerufen (Kontaktieren 2 …) → Terminierung */
  if (s === "eingereicht" && STAGE_ATTEMPTS[deal.stage_id]) return "terminierung";
  return s;
}

/** Vorqualifizierung aus den Pipedrive-Feldern (von n8n wp-vorqual) */
function vqFromDeal(deal: PdDeal): Record<string, string> | undefined {
  const cf = deal.custom_fields ?? {};
  const vq: Record<string, string> = {};
  for (const [name, key] of Object.entries(VQ_DEAL_FIELDS)) {
    const v = cf[key];
    const s = v && typeof v === "object" && "label" in v ? String((v as { label: unknown }).label) : v == null ? "" : String(v);
    if (s.trim()) vq[name] = s.trim();
  }
  /* Antworten aus dem bisherigen Formular auf die TMVT-Optionen übersetzen */
  return Object.keys(vq).length ? normalizeVq(vq) : undefined;
}

export function dealToLead(deal: PdDeal, person: PdPerson | undefined, note?: LeadNote): Lead {
  const status = statusOf(deal);
  const [, kundeAusTitel] = deal.title.split(/\s+[–-]\s+/, 2);
  const kunde = person?.name || kundeAusTitel || deal.title;
  const phone = person?.phones?.find((p) => p.primary)?.value || person?.phones?.[0]?.value || note?.telefon || "";
  /* Rückrufwunsch mit Datum wird zum vereinbarten Rückruf (erscheint in der Anrufliste zur richtigen Zeit) */
  const wunschMitDatum = note?.rueckruf && /\d{1,2}\.\d{1,2}\./.test(note.rueckruf) ? note.rueckruf : null;
  const hist: HistoryEntry[] = [["Lead eingereicht", stamp(deal.add_time)]];
  const changed = deal.lost_time || deal.won_time || deal.stage_change_time;
  if (status !== "eingereicht" && changed)
    hist.unshift([STATUS[status].label + (deal.lost_reason ? ` – ${deal.lost_reason}` : ""), stamp(changed)]);
  return {
    id: `PD-${deal.id}`,
    pd: deal.id,
    kunde,
    anrede: kunde,
    tel: phone ? maskPhone(phone) : "–",
    /* volle Nummer – loadLeadsForUser gibt sie nur an Rollen weiter, die anrufen */
    telFull: phone ? phone.replace(/\s+/g, " ").trim() : undefined,
    ort: person?.postal_address?.locality || note?.ort || "",
    adresse: person?.postal_address?.value || note?.adresse,
    email: person?.emails?.find((e) => e.primary)?.value || person?.emails?.[0]?.value || note?.email,
    entscheider: note?.entscheider,
    themen: note?.thema ? note.thema.split(/,\s*/) : undefined,
    rueckrufWunsch: note?.rueckruf,
    gps: note?.gps,
    vq: vqFromDeal(deal),
    /* Vorqualifizierung in Pipedrive kommt aus dem Formular an der Tür (n8n wp-vorqual) */
    door: Object.keys(vqFromDeal(deal) ?? {}),
    produkt: "wp",
    status,
    setter: setterKey(deal.custom_fields?.[DEAL_FIELDS.setter]),
    datum: date(deal.add_time),
    setNote: note?.setterNotiz ?? "",
    preNote: "",
    hist,
    attempts: STAGE_ATTEMPTS[deal.stage_id] ?? 0,
    nextTry: isCalling(status) && wunschMitDatum ? `Rückruf ${wunschMitDatum}` : null,
    reason: deal.lost_reason,
    reasonNote: "",
    eigenlead: true,
    pdAddTime: utc(deal.add_time),
    pdChangedAt: utc(changed || deal.add_time),
  };
}

/** Pipedrive-Zeit („2026-09-28 08:00:00“ oder ISO) → ISO in UTC */
const utc = (iso: string) => new Date(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z").toISOString();

/** Alle Wärmepumpen-Leads der Pipeline, neueste zuerst. */
async function fetchAllLeads(): Promise<Lead[]> {
  const deals = (await getDeals(PIPEDRIVE_PIPELINE_ID)).filter((d) =>
    WP_TITLE_PREFIXES.some((p) => d.title.startsWith(p)),
  );
  const personIds = [...new Set(deals.map((d) => d.person_id).filter((id): id is number => !!id))];
  const [personList, notes] = await Promise.all([getPersons(personIds), loadLeadNotes()]);
  const persons = new Map(personList.map((p) => [p.id, p]));
  return deals
    .sort((a, b) => b.add_time.localeCompare(a.add_time))
    .map((d) => dealToLead(d, d.person_id ? persons.get(d.person_id) : undefined, notes.get(d.id)));
}

/* Kurzer Zwischenspeicher: nicht bei jedem Seitenaufruf alle Deals aus Pipedrive laden. */
/* Lead-Notizen (von n8n) ändern sich nicht mehr – länger zwischenspeichern als die Deals */
const NOTES_CACHE_MS = 5 * 60_000;
let notesCache: { at: number; notes: Promise<Map<number, LeadNote>> } | null = null;

/** Deal-ID → zerlegte Lead-Notiz (die erste „NEUER LEAD“-Notiz je Deal). Fehler → leer, Leads laden trotzdem. */
function loadLeadNotes(): Promise<Map<number, LeadNote>> {
  if (!notesCache || Date.now() - notesCache.at > NOTES_CACHE_MS) {
    const notes = Promise.resolve()
      .then(() => getRecentNotes())
      .then((list) => {
        const map = new Map<number, LeadNote>();
        for (const n of list) if (n.deal_id && !map.has(n.deal_id) && isLeadNote(n.content)) map.set(n.deal_id, parseLeadNote(n.content));
        return map;
      })
      .catch((e) => {
        console.error("Pipedrive-Notizen nicht geladen:", e);
        notesCache = null;
        return new Map<number, LeadNote>();
      });
    notesCache = { at: Date.now(), notes };
  }
  return notesCache.notes;
}

const CACHE_MS = 60_000;
let cache: { at: number; leads: Promise<Lead[]> } | null = null;

/** Nach dem Schreiben nach Pipedrive: beim nächsten Laden frisch holen */
export const invalidateLeadCache = () => {
  cache = null;
  notesCache = null;
};

export function loadLeadsFromPipedrive(): Promise<Lead[]> {
  if (!cache || Date.now() - cache.at > CACHE_MS) {
    const leads = fetchAllLeads();
    cache = { at: Date.now(), leads };
    leads.catch(() => (cache = null)); /* Fehler nicht zwischenspeichern */
  }
  return cache.leads;
}

export interface LeadsForUser {
  leads: Lead[];
  /** Schlüssel der angemeldeten Person je Rolle (z. B. setter → „florian“) für „Meine Leads“ */
  keys: Partial<Record<Role, string>>;
  /** Hinweis, wenn für eine Rolle noch keine Zuordnung existiert */
  note?: string;
}

export interface LeadUser {
  id: string;
  roles: Role[];
}

/** Setter-Namen aus Pipedrive durch Nutzer-IDs ersetzen (unbekannte Namen bleiben stehen) */
export const withSetterIds = (leads: Lead[], ids: Map<string, string>) => leads.map((l) => (ids.has(l.setter) ? { ...l, setter: ids.get(l.setter)! } : l));

/** Setter-Zuweisungen aus dem Dashboard (Deal-ID → Setter-Name). Haben Vorrang vor dem Pipedrive-Feld
 *  (entschieden 01.10.2026 – z. B. Leads, die über den Link eines anderen Setters kamen). Pipedrive bleibt unverändert. */
export const withAssignments = (leads: Lead[], assignments: Map<string, string>) =>
  leads.map((l) => (assignments.has(l.id) ? { ...l, setter: setterKey(assignments.get(l.id)), setterFromDashboard: true } : l));

/** Alles, was zusätzlich zu Pipedrive in die Leads einfließt (aus der Dashboard-Datenbank) */
export interface LeadContext {
  /** Pipedrive-Setter-Name (Schlüssel) → Nutzer-ID */
  setterIds: Map<string, string>;
  /** Setter-Zuweisungen im Dashboard: Lead-ID → Setter-Name */
  assignments?: Map<string, string>;
  /** Leads mit Termin bei dieser Person (Closer) */
  closerLeadIds?: Set<string>;
  activities?: ActivityRow[];
  /** Standard-Presetter für Leads ohne Dashboard-Aktion */
  defaultPresetter?: string | null;
  /** im Dashboard erfasste Leads (Dashboard-Pipeline, „MB-…“) */
  ownLeads?: Lead[];
}

/** Pipedrive-Leads mit allen Dashboard-Ergänzungen (Zuweisung → Konto → Aktionen) */
export const enrichLeads = (leads: Lead[], ctx: LeadContext) =>
  applyActivities(
    [...(ctx.ownLeads ?? []), ...withSetterIds(withAssignments(leads, ctx.assignments ?? new Map()), ctx.setterIds)].sort((a, b) =>
      (b.pdAddTime ?? "").localeCompare(a.pdAddTime ?? ""),
    ),
    ctx.activities ?? [],
    ctx.defaultPresetter ?? null,
  );

/** Nur die Leads, die diese Person sehen darf – die Filterung passiert hier auf dem Server.
 *  Personen-Schlüssel = Nutzer-ID. Dashboard-Aktionen werden vorher angewendet.
 *  - Admin: alle
 *  - Setter: eigene (Pipedrive-Feld „Setter“ bzw. Zuweisung im Dashboard), Nummer maskiert
 *  - Presetter: gemeinsamer Pool aller offenen Leads + Leads, die sie selbst bearbeitet haben – volle Nummer
 *  - Closer: Leads mit Termin bei ihnen – volle Nummer */
export async function loadLeadsForUser(user: LeadUser, ctx: LeadContext): Promise<LeadsForUser> {
  const all = enrichLeads(await loadLeadsFromPipedrive(), ctx);
  const closerLeadIds = ctx.closerLeadIds ?? new Set<string>();
  const activities = ctx.activities ?? [];
  const keys: Partial<Record<Role, string>> = {};
  if (user.roles.includes("setter")) keys.setter = user.id;
  if (user.roles.includes("presetter")) keys.presetter = user.id;
  if (user.roles.includes("closer")) keys.closer = user.id;
  const touched = new Set(activities.filter((a) => a.userId === user.id && a.role === "presetter").map((a) => a.leadId));
  const inPool = (l: Lead) => !!keys.presetter && (isCalling(l.status) || touched.has(l.id) || l.presetter === user.id);
  if (isAdmin(user.roles)) return { leads: all, keys };
  const leads = all
    .filter((l) => (keys.setter && l.setter === keys.setter) || closerLeadIds.has(l.id) || inPool(l))
    .map((l) => (closerLeadIds.has(l.id) || inPool(l) ? l : { ...l, telFull: undefined }));
  return { leads, keys };
}

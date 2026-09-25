import "server-only";
import { STATUS } from "@/lib/domain";
import type { HistoryEntry, Lead, StatusKey } from "@/lib/types";
import { getDeals, getPersons, type PdDeal, type PdPerson } from "./client";
import { DEAL_FIELDS, PIPEDRIVE_PIPELINE_ID, PRODUCT_TITLE_PREFIX, STAGE_ATTEMPTS, STAGE_TO_STATUS } from "./config";

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
  if (deal.status === "lost") return ["termin", "checks", "verkauft"].includes(s) ? "verloren" : "abgesagt";
  return s;
}

export function dealToLead(deal: PdDeal, person: PdPerson | undefined): Lead {
  const status = statusOf(deal);
  const [, kundeAusTitel] = deal.title.split(/\s+[–-]\s+/, 2);
  const kunde = person?.name || kundeAusTitel || deal.title;
  const phone = person?.phones?.find((p) => p.primary)?.value || person?.phones?.[0]?.value || "";
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
    ort: person?.postal_address?.locality || "",
    produkt: "wp",
    status,
    setter: setterKey(deal.custom_fields?.[DEAL_FIELDS.setter]),
    datum: date(deal.add_time),
    setNote: "",
    preNote: "",
    hist,
    attempts: STAGE_ATTEMPTS[deal.stage_id] ?? 0,
    nextTry: null,
    reason: deal.lost_reason,
    reasonNote: "",
    eigenlead: true,
  };
}

/** Alle Wärmepumpen-Leads der Pipeline, neueste zuerst. */
async function fetchAllLeads(): Promise<Lead[]> {
  const deals = (await getDeals(PIPEDRIVE_PIPELINE_ID, Object.values(DEAL_FIELDS))).filter((d) =>
    d.title.startsWith(PRODUCT_TITLE_PREFIX.wp),
  );
  const personIds = [...new Set(deals.map((d) => d.person_id).filter((id): id is number => !!id))];
  const persons = new Map((await getPersons(personIds)).map((p) => [p.id, p]));
  return deals
    .sort((a, b) => b.add_time.localeCompare(a.add_time))
    .map((d) => dealToLead(d, d.person_id ? persons.get(d.person_id) : undefined));
}

/* Kurzer Zwischenspeicher: nicht bei jedem Seitenaufruf alle Deals aus Pipedrive laden. */
const CACHE_MS = 60_000;
let cache: { at: number; leads: Promise<Lead[]> } | null = null;

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
  /** Schlüssel der angemeldeten Person in lead.setter (für die Anzeige „Meine Leads“) */
  userKey: string;
  /** Hinweis, wenn für die Rolle noch keine Zuordnung existiert */
  note?: string;
}

/** Nur die Leads, die diese Person sehen darf – die Filterung passiert hier auf dem Server. */
export async function loadLeadsForUser(user: { role: string; pipedriveSetterName: string | null; name: string }): Promise<LeadsForUser> {
  const all = await loadLeadsFromPipedrive();
  if (user.role === "admin") return { leads: all, userKey: "admin" };
  if (user.role === "setter") {
    const key = setterKey(user.pipedriveSetterName || user.name.split(" ")[0]);
    return { leads: all.filter((l) => l.setter === key), userKey: key };
  }
  /* TODO: Zuordnung für Presetter/Closer in Pipedrive klären (Deal-Owner? Feld „VQ Berater“?) */
  return { leads: [], userKey: user.role, note: "Die Zuordnung von Presetter- und Closer-Leads aus Pipedrive ist noch offen." };
}

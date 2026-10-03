/* Dashboard-Aktionen an Pipedrive-Leads (Anrufversuch, Rückruf, Status, Notiz, Vorqualifizierung)
   auf die Leads anwenden und daraus Presetter-Kennzahlen berechnen. Reine Funktionen – laufen auf dem Server. */

import { normStatus } from "./domain";
import { isCalling } from "./leads";
import type { Lead, PersonKey, Role } from "./types";

export type ActivityKind = "attempt" | "callback" | "status" | "note" | "vq";

export interface ActivityRow {
  leadId: string;
  userId: string | null;
  role: Role;
  kind: ActivityKind;
  text: string;
  /** attempt: {attempt} · callback: {date, time, note} · status: {status, reason, note} · note: {text} · vq: {answers} */
  data: Record<string, unknown>;
  /** ISO (UTC) */
  createdAt: string;
}

/** Nächster Anrufversuch nach n erfolglosen Versuchen */
export const nextTryText = (n: number) =>
  n <= 1 ? "in 2 Std. erneut anrufen" : n === 2 ? "morgen erneut anrufen" : n < 5 ? "in 2 Tagen erneut anrufen" : "letzter Versuch, danach absagen";

const TZ = "Europe/Berlin";
/** „TT.MM. hh:mm“ in deutscher Zeit (wie der Pipedrive-Verlauf) */
export function stamp(iso: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("de-DE", { timeZone: TZ, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date(iso))
      .map((x) => [x.type, x.value]),
  );
  return `${p.day}.${p.month}. ${p.hour}:${p.minute}`;
}
/** „JJJJ-MM-TT“ in deutscher Zeit */
export function berlinDay(d: Date) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("de-DE", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}`;
}

/** Aktivitäten (beliebige Reihenfolge) auf die Leads anwenden. Leads werden kopiert, nicht verändert.
 *  Status aus dem Dashboard gilt, solange Pipedrive seitdem nicht selbst geändert wurde. */
export function applyActivities(leads: Lead[], rows: ActivityRow[], defaultPresetter?: PersonKey | null): Lead[] {
  const byLead = new Map<string, ActivityRow[]>();
  for (const r of rows) (byLead.get(r.leadId) ?? byLead.set(r.leadId, []).get(r.leadId)!).push(r);
  return leads.map((lead) => {
    const acts = (byLead.get(lead.id) ?? []).slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    /* Standard-Presetter (z. B. die eine Presetterin, die alle bisherigen Leads betreut) */
    if (!acts.length) return defaultPresetter && !lead.presetter ? { ...lead, presetter: defaultPresetter } : lead;
    const l: Lead = { ...lead, hist: lead.hist.slice() };
    const attempts = acts.filter((a) => a.kind === "attempt");
    const lastAttempt = attempts[attempts.length - 1];
    l.attempts = Math.max(l.attempts, attempts.length ? Number(lastAttempt.data.attempt) || attempts.length : 0);
    const callbacks = acts.filter((a) => a.kind === "callback");
    const lastCallback = callbacks[callbacks.length - 1];
    if (lastCallback && (!lastAttempt || lastCallback.createdAt > lastAttempt.createdAt)) l.nextTry = `Rückruf ${String(lastCallback.data.when ?? "")}`.trim();
    else if (lastAttempt) l.nextTry = nextTryText(l.attempts);
    const statuses = acts.filter((a) => a.kind === "status");
    const lastStatus = statuses[statuses.length - 1];
    if (lastStatus && (!l.pdChangedAt || lastStatus.createdAt > l.pdChangedAt)) {
      l.status = normStatus(String(lastStatus.data.status));
      if (lastStatus.data.reason) {
        l.reason = String(lastStatus.data.reason);
        l.reasonNote = String(lastStatus.data.note ?? "");
      }
      if (!isCalling(l.status)) l.nextTry = null;
    }
    /* angerufen, aber noch kein Ergebnis → Terminierung */
    if (l.status === "eingereicht" && (attempts.length || callbacks.length)) l.status = "terminierung";
    const notes = acts.filter((a) => a.kind === "note");
    if (notes.length) l.preNote = String(notes[notes.length - 1].data.text ?? "");
    const vqs = acts.filter((a) => a.kind === "vq");
    if (vqs.length) l.vq = { ...(vqs[vqs.length - 1].data.answers as Record<string, string>) };
    /* an der Tür beantwortet = Vorqualifizierung, die der Setter gespeichert hat */
    const door = new Set(l.door ?? []);
    for (const a of vqs.filter((x) => x.role === "setter"))
      for (const [k, v] of Object.entries(a.data.answers as Record<string, string>)) if (String(v ?? "").trim()) door.add(k);
    if (door.size) l.door = [...door];
    const pre = acts.filter((a) => a.role === "presetter" && a.userId);
    if (pre.length) l.presetter = pre[pre.length - 1].userId!;
    else if (defaultPresetter && !l.presetter) l.presetter = defaultPresetter;
    /* Verlauf: Aktionen mit sichtbarem Text, neueste oben */
    const shown = acts.filter((a) => a.kind === "attempt" || a.kind === "callback" || a.kind === "status");
    for (const a of shown) l.hist.unshift([a.text, stamp(a.createdAt)]);
    return l;
  });
}

export interface PresetterStats {
  /** Anrufe (Versuch, Rückruf, Ergebnis) heute */
  callsToday: number;
  /** Ø Stunden vom Eingang bis zum ersten Anruf (Leads, die diese Person als erste angerufen hat, laufender Monat) */
  firstCallH: number | null;
  /** Anteil der angerufenen Leads mit gelegtem Termin (laufender Monat) in % */
  terminQuote: number | null;
  teamFirstCallH: number | null;
  teamTerminQuote: number | null;
  /** Anrufe je Wochentag Mo–Sa dieser Woche (Zukunft = null) */
  callsWeek: [string, number | null][];
  /** Tage in Folge (ohne heute und Sonntage) mit erreichtem Anrufziel */
  streak: number;
  /** heute gelegte Aufmaßtermine */
  termineToday: number;
  /** Anteil der angerufenen Leads, die erreicht wurden (Rückruf oder Ergebnis), laufender Monat in % */
  reachQuote: number | null;
  teamReachQuote: number | null;
  /** Presetter-Rangliste: gelegte Aufmaßtermine im laufenden Monat je Person */
  boardRows: [PersonKey, number][];
  /** heute erledigt (neueste oben) */
  doneToday: DoneItem[];
}

/** Erledigte Aufgabe für „Heute erledigt“ */
export interface DoneItem {
  what: string;
  /** Kunde bzw. Lead-ID (der Client setzt den Namen ein) */
  leadId?: string;
  who?: string;
  /** „hh:mm“ */
  time: string;
}

const WOCHENTAGE = ["Mo", "Di", "Mi", "Do", "Fr", "Sa"];
/** „JJJJ-MM-TT“ ± n Tage */
const addDays = (key: string, n: number) => {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const weekdayOf = (key: string) => new Date(`${key}T12:00:00Z`).getUTCDay();
/** Mo–Sa der laufenden Woche als „JJJJ-MM-TT“ */
export function weekKeys(today: string) {
  const mon = addDays(today, -((weekdayOf(today) + 6) % 7));
  return WOCHENTAGE.map((label, i) => [label, addDays(mon, i)] as const);
}
/** Tage in Folge vor heute (Sonntage übersprungen), an denen count(tag) ≥ goal */
export function streakBefore(today: string, count: (day: string) => number, goal: number) {
  let streak = 0;
  for (let d = addDays(today, -1), i = 0; i < 90; d = addDays(d, -1), i++) {
    if (weekdayOf(d) === 0) continue;
    if (goal > 0 && count(d) >= goal) streak++;
    else break;
  }
  return streak;
}
const hhmm = (iso: string) => stamp(iso).split(" ")[1];

const CALL_KINDS: ActivityKind[] = ["attempt", "callback", "status"];

export function presetterStats(leads: Lead[], rows: ActivityRow[], userId: PersonKey, now: Date, goal = 0): PresetterStats {
  const today = berlinDay(now);
  const month = today.slice(0, 7);
  const calls = rows.filter((r) => r.role === "presetter" && r.userId && CALL_KINDS.includes(r.kind));
  const received = new Map(leads.map((l) => [l.id, l.pdAddTime]));

  /* erster Presetter-Anruf je Lead → wem er zählt und wie lange es gedauert hat */
  const first = new Map<string, ActivityRow>();
  for (const r of calls.slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt))) if (!first.has(r.leadId)) first.set(r.leadId, r);
  const delays = (who?: string) => {
    const hs = [...first.values()]
      .filter((r) => berlinDay(new Date(r.createdAt)).startsWith(month) && (!who || r.userId === who) && received.get(r.leadId))
      .map((r) => (new Date(r.createdAt).getTime() - new Date(received.get(r.leadId)!).getTime()) / 36e5)
      .filter((h) => h >= 0);
    return hs.length ? Math.round((hs.reduce((a, b) => a + b, 0) / hs.length) * 10) / 10 : null;
  };
  const quote = (who?: string) => {
    const mine = calls.filter((r) => berlinDay(new Date(r.createdAt)).startsWith(month) && (!who || r.userId === who));
    const called = new Set(mine.map((r) => r.leadId));
    const termin = new Set(mine.filter((r) => r.kind === "status" && normStatus(String(r.data.status)) === "aufmass").map((r) => r.leadId));
    return called.size ? Math.round((termin.size / called.size) * 100) : null;
  };
  const dayOf = (r: ActivityRow) => berlinDay(new Date(r.createdAt));
  const mineCalls = calls.filter((r) => r.userId === userId);
  const callsOn = (day: string) => mineCalls.filter((r) => dayOf(r) === day).length;
  const isTermin = (r: ActivityRow) => r.kind === "status" && normStatus(String(r.data.status)) === "aufmass";
  /* erreicht = Rückruf vereinbart oder ein Ergebnis (Termin, Absage …) */
  const reach = (who?: string) => {
    const mine = calls.filter((r) => dayOf(r).startsWith(month) && (!who || r.userId === who));
    const called = new Set(mine.map((r) => r.leadId));
    const reached = new Set(mine.filter((r) => r.kind !== "attempt").map((r) => r.leadId));
    return called.size ? Math.round((reached.size / called.size) * 100) : null;
  };
  const board = new Map<PersonKey, number>();
  for (const r of calls) if (isTermin(r) && dayOf(r).startsWith(month)) board.set(r.userId!, (board.get(r.userId!) ?? 0) + 1);
  if (!board.has(userId)) board.set(userId, 0);
  return {
    callsToday: callsOn(today),
    firstCallH: delays(userId),
    terminQuote: quote(userId),
    teamFirstCallH: delays(),
    teamTerminQuote: quote(),
    callsWeek: weekKeys(today).map(([label, day]) => [label, day > today ? null : callsOn(day)]),
    streak: streakBefore(today, callsOn, goal),
    termineToday: mineCalls.filter((r) => isTermin(r) && dayOf(r) === today).length,
    reachQuote: reach(userId),
    teamReachQuote: reach(),
    boardRows: [...board.entries()],
    doneToday: mineCalls
      .filter((r) => dayOf(r) === today)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((r) => ({ what: r.text, leadId: r.leadId, time: hhmm(r.createdAt) })),
  };
}

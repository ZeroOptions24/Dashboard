/* Regeln rund um Leads: Sichtbarkeit je Rolle, Fälligkeit von Anrufen,
   Provision je Lead. Reine Funktionen – dieselben Regeln gelten später
   serverseitig für echte Daten. */

import { PROV, STATUS } from "./domain";
import { eur, parseKey } from "./format";
import type { Appointment, Lead, PersonKey, Role, StatusKey } from "./types";

/** Leads, die eine Person in ihrer Rolle sehen darf. */
export function leadsForUser(leads: Lead[], role: Role, user: PersonKey): Lead[] {
  if (role === "setter") return leads.filter((l) => l.setter === user);
  if (role === "presetter") return leads.filter((l) => l.presetter === user);
  if (role === "closer") return leads.filter((l) => l.closer === user);
  return leads;
}

export const isLost = (l: Lead) => !!STATUS[l.status].fail;
export const activeLeads = (leads: Lead[]) => leads.filter((l) => !isLost(l));
/** Abgesagt und Verloren werden in der Pipeline gemeinsam als „verloren“ geführt. */
export const stageOf = (l: Lead): StatusKey => (isLost(l) ? "verloren" : l.status);

/* ---------- Eingangsalter & Anruf-Fälligkeit ---------- */

/** „TT.MM. hh:mm“ → Date (Jahr des Bezugszeitpunkts) */
function parseStamp(t: string, now: Date) {
  const m = String(t).match(/(\d{2})\.(\d{2})\.\s+(\d{2}):(\d{2})/);
  return m ? new Date(now.getFullYear(), +m[2] - 1, +m[1], +m[3], +m[4]) : now;
}

/** Zeitpunkt, an dem der Lead eingereicht wurde (ältester Verlaufseintrag). */
const eingang = (l: Lead, now: Date) => parseStamp(l.hist[l.hist.length - 1][1], now);

/** Alter des Leads in Stunden. */
export const ageH = (l: Lead, now: Date) => (now.getTime() - eingang(l, now).getTime()) / 36e5;

/** Überfällig: eingereicht, noch nie angerufen und älter als 24 Std. */
export const isOverdue = (l: Lead, now: Date) =>
  l.status === "eingereicht" && !l.attempts && !l.nextTry && ageH(l, now) >= 24;

/** Fälligkeit aus „nextTry“ (z. B. „Rückruf heute 18:00“, „Do 24.09. ab 18:00“, „Fr 25.09. vormittags“) */
function dueAt(l: Lead, now: Date): Date | null {
  const t = l.nextTry || "";
  if (!t) return null;
  const d = t.match(/(\d{2})\.(\d{2})\./),
    h = t.match(/(\d{1,2}):(\d{2})/);
  const day = d ? new Date(now.getFullYear(), +d[2] - 1, +d[1]) : new Date(now.getFullYear(), now.getMonth(), now.getDate());
  day.setHours(h ? +h[1] : /vormittag/.test(t) ? 10 : 17, h ? +h[2] : 0);
  return day;
}

export const isCallback = (l: Lead) => /^Rückruf/.test(l.nextTry || "");
export const callbackLate = (l: Lead, now: Date) => {
  const due = dueAt(l, now);
  return isCallback(l) && !!due && due < now;
};

/* ---------- Termine ---------- */

export const apptStart = (a: Appointment) => {
  const d = parseKey(a.date);
  d.setMinutes(Math.round(a.start * 60));
  return d;
};

/* ---------- Provision ---------- */

export interface Provision {
  txt: string;
  /** noch möglicher Betrag; 0 = bereits verdient oder entfallen */
  amount: number;
}

/** Provision je Lead aus Sicht einer Rolle (Admin sieht die Setter-Provision). */
export function provFor(l: Lead, role: Role): Provision {
  const r = role === "admin" ? "setter" : role;
  if (STATUS[l.status].fail) return { txt: "–", amount: 0 };
  if (r === "presetter") {
    const t = PROV.presetter.termin;
    if (["termin", "checks", "verkauft", "ausgezahlt"].includes(l.status)) return { txt: `${eur(t)} verdient`, amount: 0 };
    return { txt: `+${eur(t)} bei Termin`, amount: t };
  }
  const a = PROV[r].abschluss; /* Setter und Closer: pauschal je Abschluss */
  if (l.status === "verkauft") return { txt: `${eur(a)} vorläufig`, amount: 0 };
  if (l.status === "ausgezahlt") return { txt: `${eur(a)} ausgezahlt`, amount: 0 };
  return { txt: `+${eur(a)} bei Verkauf`, amount: a };
}

/** Offene Anrufe: überfällige Rückrufe und neue Leads zuerst (älteste oben), dann nach Fälligkeit. */
export function urgencySort(now: Date) {
  const grp = (l: Lead) => (callbackLate(l, now) ? 0 : !l.attempts && !l.nextTry ? 1 : 2);
  const due = (l: Lead) => dueAt(l, now)?.getTime() ?? 0;
  return (a: Lead, b: Lead) => grp(a) - grp(b) || (grp(a) === 1 ? ageH(b, now) - ageH(a, now) : due(a) - due(b));
}

/** Lead hatte bereits einen Termin (für Terminquoten). */
export const hadTermin = (s: StatusKey) => ["termin", "checks", "verkauft", "ausgezahlt", "verloren"].includes(s);

/** PROTOTYP: volle Nummer aus der maskierten Demo-Nummer. Später liefert der Server
 *  die volle Nummer nur an Rollen, die sie sehen dürfen (Presetter, Closer). */
export const telFull = (l: Lead) => l.tel.replace("••••", "4418");
export const telHref = (l: Lead) => "tel:" + telFull(l).replace(/\s/g, "");

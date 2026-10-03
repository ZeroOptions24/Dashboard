/* Kennzahlen aus Leads berechnen (Übersicht, Quoten, Ranglisten, Tagesziel).
   Reine Funktion – läuft auf dem Server über ALLE Leads; ausgeliefert wird je
   Rolle nur, was die Person sehen darf (src/server/stats.ts). */

import { TARGETS } from "./domain";
import { pad } from "./format";
import { hadTermin, isLost } from "./leads";
import type { AdminKpi, Lead, MbStats, PersonKey } from "./types";

export const MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
const WOCHENTAGE = ["Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const DAY = 864e5;

/** „TT.MM.JJJJ“ → Date */
export const parseDatum = (s: string) => {
  const [d, m, y] = s.split(".").map(Number);
  return new Date(y, m - 1, d);
};
const fmtDatum = (d: Date) => `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
/** Montag der Woche */
const startOfWeek = (d: Date) => {
  const s = startOfDay(d);
  s.setDate(s.getDate() - ((s.getDay() + 6) % 7));
  return s;
};
/** Kalenderwoche nach ISO 8601 */
export function isoWeek(d: Date) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - yearStart.getTime()) / DAY + 1) / 7);
}

const reachedChecks = (l: Lead) => ["checks", "verkaufstermin", "verkauft", "ausgezahlt"].includes(l.status);
const reachedVerkaufstermin = (l: Lead) => ["verkaufstermin", "verkauft", "ausgezahlt"].includes(l.status);
const isSold = (l: Lead) => ["verkauft", "ausgezahlt"].includes(l.status);
/** „TT.MM. hh:mm“ des letzten Verlaufseintrags → Date (Jahr aus dem Eingangsdatum) */
const lastChange = (l: Lead) => {
  const m = l.hist[0]?.[1].match(/(\d{2})\.(\d{2})\./);
  return m ? new Date(parseDatum(l.datum).getFullYear(), +m[2] - 1, +m[1]) : parseDatum(l.datum);
};

export interface LeadStats {
  adminKpi: AdminKpi;
  /** je Setter im laufenden Monat (ohne Leads ohne Setter) */
  perSetter: MbStats[];
  /** Teamschnitt: Leads je Setter, Terminquote in % */
  bench: { setterLeads: number; setterTermin: number };
  /** eingereichte Leads der letzten 8 Kalenderwochen */
  weekly: [string, number][];
  /** Verlustgründe im laufenden Monat */
  lossStats: [string, number][];
  /** Setter-Rangliste: gelegte Termine im laufenden Monat */
  setterBoardRows: [PersonKey, number][];
  /** Tagesziel je Setter: Leads je Wochentag dieser Woche (Zukunft = null) und Serie */
  dayGoal: Record<PersonKey, { week: [string, number | null][]; streak: number }>;
  /** Monatsende „TT.MM.JJJJ“ (Ende der Rangliste) */
  monatsende: string;
}

export function computeStats(leads: Lead[], now: Date): LeadStats {
  const y = now.getFullYear(),
    m = now.getMonth();
  const inMonth = (l: Lead, yy = y, mm = m) => {
    const d = parseDatum(l.datum);
    return d.getFullYear() === yy && d.getMonth() === mm;
  };
  const month = leads.filter((l) => inMonth(l));
  const prev = new Date(y, m - 1, 1);
  const weekStart = startOfWeek(now);
  const today = startOfDay(now);

  const adminKpi: AdminKpi = {
    monat: MONATE[m],
    vormonat: MONATE[prev.getMonth()],
    leads: month.length,
    leadsVormonat: leads.filter((l) => inMonth(l, prev.getFullYear(), prev.getMonth())).length,
    termin: month.filter((l) => hadTermin(l.status)).length,
    checks: month.filter(reachedChecks).length,
    verkaufstermin: month.filter(reachedVerkaufstermin).length,
    verkauft: month.filter(isSold).length,
    checksWoche: leads.filter((l) => l.status === "checks" && lastChange(l) >= weekStart).length,
  };

  /* je Setter */
  const setters = [...new Set(leads.map((l) => l.setter))].filter((k) => k !== "unbekannt");
  const perSetter: MbStats[] = setters
    .map((key) => {
      const own = month.filter((l) => l.setter === key);
      const last = leads
        .filter((l) => l.setter === key)
        .map((l) => parseDatum(l.datum))
        .sort((a, b) => b.getTime() - a.getTime())[0];
      return {
        key,
        leads: own.length,
        termin: own.filter((l) => hadTermin(l.status)).length,
        checks: own.filter(reachedChecks).length,
        verkauft: own.filter(isSold).length,
        last: last ? fmtDatum(last) : "–",
        days: last ? Math.max(0, Math.round((today.getTime() - startOfDay(last).getTime()) / DAY)) : 99,
      };
    })
    .sort((a, b) => b.leads - a.leads);
  const active = perSetter.filter((s) => s.leads > 0);
  const sum = (k: "leads" | "termin") => active.reduce((t, s) => t + s[k], 0);
  const bench = {
    setterLeads: active.length ? Math.round(sum("leads") / active.length) : 0,
    setterTermin: sum("leads") ? Math.round((sum("termin") / sum("leads")) * 100) : 0,
  };

  /* letzte 8 Kalenderwochen */
  const weekly: [string, number][] = [];
  for (let i = 7; i >= 0; i--) {
    const from = new Date(weekStart.getTime() - i * 7 * DAY),
      to = new Date(from.getTime() + 7 * DAY);
    weekly.push([`KW ${isoWeek(from)}`, leads.filter((l) => parseDatum(l.datum) >= from && parseDatum(l.datum) < to).length]);
  }

  /* Verlustgründe */
  const reasons: Record<string, number> = {};
  for (const l of month.filter(isLost)) reasons[l.reason || "Ohne Grund"] = (reasons[l.reason || "Ohne Grund"] || 0) + 1;
  const lossStats = Object.entries(reasons)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  /* Tagesziel: Mo–Sa dieser Woche und Serie (Tage in Folge mit erreichtem Ziel, ohne heute und Sonntage) */
  const countOn = (key: string, day: Date) => leads.filter((l) => l.setter === key && parseDatum(l.datum).getTime() === day.getTime()).length;
  const dayGoal: LeadStats["dayGoal"] = {};
  for (const key of setters) {
    const week = WOCHENTAGE.map((label, i): [string, number | null] => {
      const day = new Date(weekStart.getTime() + i * DAY);
      return [label, day > today ? null : countOn(key, day)];
    });
    let streak = 0;
    for (let d = new Date(today.getTime() - DAY); streak < 60; d = new Date(d.getTime() - DAY)) {
      if (d.getDay() === 0) continue;
      if (countOn(key, d) >= TARGETS.leadsProTag) streak++;
      else break;
    }
    dayGoal[key] = { week, streak };
  }

  return {
    adminKpi,
    perSetter,
    bench,
    weekly,
    lossStats,
    setterBoardRows: perSetter.map((s) => [s.key, s.termin]),
    dayGoal,
    monatsende: fmtDatum(new Date(y, m + 1, 0)),
  };
}

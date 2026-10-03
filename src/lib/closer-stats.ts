/* Kennzahlen für Closer aus den Terminen (Rückmeldungen): Tag, Woche, Serie, Quoten.
   Reine Funktionen – laufen auf dem Server. */

import { berlinDay, stamp, weekKeys, type DoneItem } from "./lead-activity";
import type { PersonKey } from "./types";

export interface CloserAppt {
  closerId: string | null;
  leadId: string;
  kind: string;
  /** „JJJJ-MM-TT“ */
  date: string;
  kunde: string | null;
  feedbackResult: string | null;
  /** ISO (UTC) */
  feedbackAt: string | null;
}

export interface CloserStats {
  /** heute gegebene Rückmeldungen */
  doneToday: DoneItem[];
  /** je Wochentag Mo–Sa: [Tag, erledigte Rückmeldungen, Termine an dem Tag] (Zukunft = null) */
  week: [string, number | null, number][];
  /** Tage in Folge mit allen Rückmeldungen (Tage ohne Termine zählen nicht und brechen nicht ab) */
  streak: number;
  /** Anteil verkaufter Kunden an stattgefundenen Aufmaßterminen (laufender Monat) in % */
  verkaufQuote: number | null;
  teamVerkaufQuote: number | null;
  /** Anteil Aufmaß → Checks an stattgefundenen Aufmaßterminen in % */
  checksQuote: number | null;
  teamChecksQuote: number | null;
}

const KIND_LABEL: Record<string, string> = { erst: "Aufmaßtermin", closing: "Verkaufstermin" };

export function closerStats(appts: CloserAppt[], userId: PersonKey, now: Date): CloserStats {
  const today = berlinDay(now);
  const month = today.slice(0, 7);
  const mine = appts.filter((a) => a.closerId === userId);
  const fbDay = (a: CloserAppt) => (a.feedbackAt ? berlinDay(new Date(a.feedbackAt)) : null);
  const doneOn = (day: string) => mine.filter((a) => fbDay(a) === day).length;
  const dueOn = (day: string) => mine.filter((a) => a.date === day).length;

  /* Serie: ein Tag mit Terminen zählt, wenn jeder Termin spätestens am Folgetag eine Rückmeldung hatte */
  const okOn = (day: string) => {
    const xs = mine.filter((a) => a.date === day);
    if (!xs.length) return -1;
    return xs.every((a) => a.feedbackAt && fbDay(a)! <= nextDay(day)) ? 1 : 0;
  };
  let streak = 0;
  for (let d = prevDay(today), i = 0; i < 90; d = prevDay(d), i++) {
    const r = okOn(d);
    if (r === -1) continue;
    if (r === 0) break;
    streak++;
  }

  const quotes = (who?: string) => {
    const held = appts.filter((a) => a.kind === "erst" && a.date.startsWith(month) && (!who || a.closerId === who) && a.feedbackResult && a.feedbackResult !== "nicht_angetroffen");
    if (!held.length) return { v: null, c: null };
    const leads = new Set(held.map((a) => a.leadId));
    const sold = new Set(appts.filter((a) => a.feedbackResult === "verkauft" && leads.has(a.leadId)).map((a) => a.leadId));
    const checks = held.filter((a) => a.feedbackResult === "checks" || a.feedbackResult === "verkauft").length;
    return { v: Math.round((sold.size / leads.size) * 100), c: Math.round((checks / held.length) * 100) };
  };
  const me = quotes(userId),
    team = quotes();
  return {
    doneToday: mine
      .filter((a) => fbDay(a) === today)
      .sort((a, b) => b.feedbackAt!.localeCompare(a.feedbackAt!))
      .map((a) => ({ what: `Rückmeldung ${KIND_LABEL[a.kind] ?? "Termin"}`, leadId: a.leadId, who: a.kunde ?? undefined, time: stamp(a.feedbackAt!).split(" ")[1] })),
    week: weekKeys(today).map(([label, day]) => [label, day > today ? null : doneOn(day), dueOn(day)]),
    streak,
    verkaufQuote: me.v,
    teamVerkaufQuote: team.v,
    checksQuote: me.c,
    teamChecksQuote: team.c,
  };
}

const shift = (key: string, n: number) => {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const nextDay = (k: string) => shift(k, 1);
const prevDay = (k: string) => shift(k, -1);

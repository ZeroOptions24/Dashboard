import "server-only";
import { computeStats, type LeadStats } from "@/lib/stats";
import type { AdminKpi, MbStats, PersonKey } from "@/lib/types";
import { isAdmin } from "@/lib/roles";
import { applyActivities, presetterStats, type ActivityRow, type PresetterStats } from "@/lib/lead-activity";
import { loadLeadsFromPipedrive, withSetterIds, type LeadUser } from "./pipedrive/leads";

/* Kennzahlen je Rolle: berechnet über ALLE Leads, ausgeliefert nur das Erlaubte.
   - Admin: alles
   - Setter: eigene Zahlen, Teamschnitt, Setter-Rangliste (Namen + Anzahl Termine), eigenes Tagesziel
   - Presetter/Closer: noch nichts (Zuordnung in Pipedrive offen) */

export interface StatsForUser {
  monat: string;
  monatsende: string;
  adminKpi?: AdminKpi;
  mbStats?: MbStats[];
  weekly?: LeadStats["weekly"];
  lossStats?: LeadStats["lossStats"];
  bench?: LeadStats["bench"];
  setterBoardRows?: [PersonKey, number][];
  dayGoal?: LeadStats["dayGoal"][string];
  presetter?: PresetterStats;
}

export async function statsForUser(user: LeadUser, setterIds: Map<string, string>, activities: ActivityRow[] = [], defaultPresetter: string | null = null): Promise<StatsForUser> {
  const now = new Date();
  const leads = applyActivities(withSetterIds(await loadLeadsFromPipedrive(), setterIds), activities, defaultPresetter);
  const s = computeStats(leads, now);
  const base: StatsForUser = { monat: s.adminKpi.monat, monatsende: s.monatsende };
  /* Presetter (auch Admins mit Presetter-Rolle): eigene Anrufe, Ø bis Erstanruf, Terminquote + Teamschnitt */
  if (user.roles.includes("presetter") || isAdmin(user.roles)) base.presetter = presetterStats(leads, activities, user.id, now);
  const key = user.roles.includes("setter") ? user.id : null;
  const setterPart = key ? { bench: s.bench, setterBoardRows: s.setterBoardRows, dayGoal: s.dayGoal[key] ?? { week: [], streak: 0 } } : {};
  if (isAdmin(user.roles))
    return { ...base, ...setterPart, adminKpi: s.adminKpi, mbStats: s.perSetter, weekly: s.weekly, lossStats: s.lossStats, bench: s.bench, setterBoardRows: s.setterBoardRows };
  if (key) return { ...base, ...setterPart, mbStats: s.perSetter.filter((x) => x.key === key) };
  return base;
}

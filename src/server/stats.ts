import "server-only";
import { computeStats, type LeadStats } from "@/lib/stats";
import type { AdminKpi, MbStats, PersonKey } from "@/lib/types";
import { loadLeadsFromPipedrive, setterKey } from "./pipedrive/leads";

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
}

export async function statsForUser(user: { role: string; pipedriveSetterName: string | null; name: string }): Promise<StatsForUser> {
  const s = computeStats(await loadLeadsFromPipedrive(), new Date());
  const base = { monat: s.adminKpi.monat, monatsende: s.monatsende };
  if (user.role === "admin")
    return { ...base, adminKpi: s.adminKpi, mbStats: s.perSetter, weekly: s.weekly, lossStats: s.lossStats, bench: s.bench, setterBoardRows: s.setterBoardRows };
  if (user.role === "setter") {
    const key = setterKey(user.pipedriveSetterName || user.name.split(" ")[0]);
    return {
      ...base,
      mbStats: s.perSetter.filter((x) => x.key === key),
      bench: s.bench,
      setterBoardRows: s.setterBoardRows,
      dayGoal: s.dayGoal[key] ?? { week: [], streak: 0 },
    };
  }
  return base;
}

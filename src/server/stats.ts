import "server-only";
import { computeStats, type LeadStats } from "@/lib/stats";
import type { AdminKpi, CloserRow, MbStats, PersonKey, PresetterRow } from "@/lib/types";
import { parseRoles } from "@/lib/roles";
import { isAdmin } from "@/lib/roles";
import { gte } from "drizzle-orm";
import { closerStats, type CloserStats } from "@/lib/closer-stats";
import { calledLeadsMonth, presetterStats, type PresetterStats } from "@/lib/lead-activity";
import { db, schema } from "./db";
import { getTargets } from "./targets";
import { enrichLeads, loadLeadsFromPipedrive, type LeadContext, type LeadUser } from "./pipedrive/leads";

/* Kennzahlen je Rolle: berechnet über ALLE Leads, ausgeliefert nur das Erlaubte.
   - Admin: alles
   - Setter: eigene Zahlen, Teamschnitt, Setter-Rangliste (Namen + Anzahl Termine), eigenes Tagesziel
   - Presetter: eigene Anrufe, Woche, Serie, Quoten + Teamschnitt, Presetter-Rangliste (Namen + Anzahl Termine)
   - Closer: Rückmeldungen, Woche, Serie, Verkaufs- und Checks-Quote + Teamschnitt */

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
  closer?: CloserStats;
  /** nur Admin: Quoten aller Presetter und Closer */
  presetterRows?: PresetterRow[];
  closerRows?: CloserRow[];
}

/** Termine der letzten 120 Tage (für Closer-Kennzahlen) */
async function recentAppointments() {
  const since = new Date(Date.now() - 120 * 864e5).toISOString().slice(0, 10);
  const rows = (await db.select().from(schema.appointment).where(gte(schema.appointment.date, since))).filter((a) => !a.reserved);
  return rows.map((a) => ({ closerId: a.closerId, leadId: a.leadId, kind: a.kind, date: a.date, kunde: a.kunde, feedbackResult: a.feedbackResult, feedbackAt: a.feedbackAt?.toISOString() ?? null }));
}

export async function statsForUser(user: LeadUser, ctx: LeadContext): Promise<StatsForUser> {
  const now = new Date();
  const targets = await getTargets(); /* aktuelle Zielwerte (z. B. Leads pro Tag für die Serie) */
  const activities = ctx.activities ?? [];
  const leads = enrichLeads(await loadLeadsFromPipedrive(), ctx);
  const s = computeStats(leads, now);
  const base: StatsForUser = { monat: s.adminKpi.monat, monatsende: s.monatsende };
  /* Presetter (auch Admins mit Presetter-Rolle): eigene Anrufe, Ø bis Erstanruf, Terminquote + Teamschnitt */
  if (user.roles.includes("presetter") || isAdmin(user.roles)) base.presetter = presetterStats(leads, activities, user.id, now, targets.anrufeProTag);
  /* Closer: Rückmeldungen heute/Woche, Serie, Verkaufs- und Checks-Quote + Teamschnitt */
  if (user.roles.includes("closer") || isAdmin(user.roles)) base.closer = closerStats(await recentAppointments(), user.id, now);
  const key = user.roles.includes("setter") ? user.id : null;
  const setterPart = key ? { bench: s.bench, setterBoardRows: s.setterBoardRows, dayGoal: s.dayGoal[key] ?? { week: [], streak: 0 } } : {};
  if (isAdmin(user.roles)) {
    /* Quoten je Presetter und Closer (laufender Monat) für die Admin-Übersicht */
    const people = (await db.select({ id: schema.user.id, role: schema.user.role, banned: schema.user.banned }).from(schema.user)).filter((u) => !u.banned);
    const withRole = (r: "presetter" | "closer") => people.filter((u) => parseRoles(u.role).includes(r)).map((u) => u.id);
    const appts = await recentAppointments();
    base.presetterRows = withRole("presetter").map((id) => {
      const p = presetterStats(leads, activities, id, now, targets.anrufeProTag);
      return { key: id, leads: calledLeadsMonth(activities, id, now), reachQuote: p.reachQuote, terminQuote: p.terminQuote, firstCallH: p.firstCallH };
    });
    base.closerRows = withRole("closer").map((id) => {
      const c = closerStats(appts, id, now);
      return { key: id, termine: c.heldMonth, checksQuote: c.checksQuote, verkaufQuote: c.verkaufQuote };
    });
    return { ...base, ...setterPart, adminKpi: s.adminKpi, mbStats: s.perSetter, weekly: s.weekly, lossStats: s.lossStats, bench: s.bench, setterBoardRows: s.setterBoardRows };
  }
  if (key) return { ...base, ...setterPart, mbStats: s.perSetter.filter((x) => x.key === key) };
  return base;
}

import "server-only";
import { and, eq, ne } from "drizzle-orm";
import { isStoredLeadId } from "@/lib/leads";
import { db, schema } from "./db";
import type { Viewer } from "./workspace";

/* „Wird gerade bearbeitet“: Wer einen Lead im Telefonleitfaden öffnet, hält ihn 10 Minuten;
   das Fenster verlängert sich, solange der Lead offen bleibt. Nur ein Hinweis, keine harte Sperre. */

const HOLD_MS = 10 * 60_000;

export interface LockInfo {
  /** jemand anderes hat den Lead gerade offen */
  other: { name: string; since: string } | null;
}

export async function claimLead(v: Viewer, leadId: string, force = false): Promise<LockInfo> {
  if (!isStoredLeadId(leadId)) return { other: null };
  const now = new Date();
  const [cur] = await db
    .select({ userId: schema.leadLock.userId, since: schema.leadLock.since, until: schema.leadLock.until, name: schema.user.name })
    .from(schema.leadLock)
    .innerJoin(schema.user, eq(schema.user.id, schema.leadLock.userId))
    .where(eq(schema.leadLock.leadId, leadId));
  if (cur && cur.userId !== v.id && cur.until > now && !force)
    return { other: { name: cur.name.split(" ")[0], since: cur.since.toISOString() } };
  /* eigene andere Sperren freigeben – man hat immer nur einen Lead offen */
  await db.delete(schema.leadLock).where(and(eq(schema.leadLock.userId, v.id), ne(schema.leadLock.leadId, leadId)));
  const until = new Date(now.getTime() + HOLD_MS);
  await db
    .insert(schema.leadLock)
    .values({ leadId, userId: v.id, since: now, until })
    .onConflictDoUpdate({
      target: schema.leadLock.leadId,
      set: cur && cur.userId === v.id ? { until } : { userId: v.id, since: now, until },
    });
  return { other: null };
}

export async function releaseLeads(v: Viewer) {
  await db.delete(schema.leadLock).where(eq(schema.leadLock.userId, v.id));
}

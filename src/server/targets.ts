import "server-only";
import { eq } from "drizzle-orm";
import { TARGETS } from "@/lib/domain";
import { db, schema } from "./db";

/* Zielwerte – von Admins im Dashboard einstellbar (Team → Zielwerte). Gespeichert in app_setting „targets“. */

export interface Targets {
  terminQuote: number;
  checksQuote: number;
  verkaufQuote: number;
  verkaufMonat: number;
  leadsProTag: number;
  anrufeProTag: number;
  erstanrufStunden: number;
}

export const DEFAULT_TARGETS: Targets = { ...TARGETS, anrufeProTag: 30, erstanrufStunden: 2 };

const LIMITS: Record<keyof Targets, [number, number]> = {
  terminQuote: [0, 100],
  checksQuote: [0, 100],
  verkaufQuote: [0, 100],
  verkaufMonat: [0, 10000],
  leadsProTag: [0, 100],
  anrufeProTag: [0, 500],
  erstanrufStunden: [0, 168],
};

export async function getTargets(): Promise<Targets> {
  const [row] = await db.select().from(schema.appSetting).where(eq(schema.appSetting.key, "targets"));
  const t = { ...DEFAULT_TARGETS, ...(row ? (JSON.parse(row.value) as Partial<Targets>) : {}) };
  /* auch serverseitige Berechnungen (z. B. Serie im Tagesziel) nutzen die aktuellen Werte */
  Object.assign(TARGETS, { terminQuote: t.terminQuote, checksQuote: t.checksQuote, verkaufQuote: t.verkaufQuote, verkaufMonat: t.verkaufMonat, leadsProTag: t.leadsProTag });
  return t;
}

export async function setTargets(input: Partial<Targets>, adminId: string): Promise<Targets> {
  const cur = await getTargets();
  const next = { ...cur };
  for (const k of Object.keys(LIMITS) as (keyof Targets)[]) {
    if (input[k] == null) continue;
    const v = Number(input[k]);
    const [min, max] = LIMITS[k];
    if (!Number.isFinite(v) || v < min || v > max) throw new Error(`Ungültiger Wert für ${k}`);
    next[k] = Math.round(v * 10) / 10;
  }
  await db
    .insert(schema.appSetting)
    .values({ key: "targets", value: JSON.stringify(next) })
    .onConflictDoUpdate({ target: schema.appSetting.key, set: { value: JSON.stringify(next), updatedAt: new Date() } });
  await db.insert(schema.auditLog).values({ actorId: adminId, action: "settings.targets", detail: JSON.stringify(next) });
  await getTargets();
  return next;
}

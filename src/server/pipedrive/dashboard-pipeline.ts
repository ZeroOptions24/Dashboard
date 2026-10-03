import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "../db";
import { createDealField, createPipeline, createStage, listDealFields, listPipelines, listStages, updateStage } from "./client";
import type { StatusKey } from "@/lib/types";
import { DEAL_FIELDS, VQ_DEAL_FIELDS } from "./config";

/* Die Pipeline in Pipedrive, in die das Dashboard neue Leads legt (Dashboard = Quelle der Wahrheit).
   ensurePipeline() legt Pipeline, Stufen und fehlende Felder an – vorhandene (gleicher Name) werden wiederverwendet,
   mehrfaches Ausführen ist also unschädlich. Die Zuordnung wird in app_setting gespeichert. */

export const PIPELINE_NAME = "MB-Dashboard Wärmepumpe";

/** Stufen der neuen Pipeline – genau wie in Tims Ablauf „Wenn-Dann“ (Stand 03.10.2026).
 *  Abgesagt/Verloren = Deal verloren mit Grund. Zuordnung zum Dashboard-Status: stageFor() */
export const PIPELINE_STAGES = [
  ["eingereicht", "Lead eingereicht"],
  ["uebergeben", "An Presetter übergeben"],
  ["kontakt", "2.–4. Kontaktversuch"],
  ["anruf5", "5. Anruf +"],
  ["aufmass", "An Closer übergeben · Aufmaßtermin"],
  ["checks", "Checks"],
  ["verkaufstermin", "Verkaufstermin"],
  ["verkauft", "Verkauf"],
  ["auszahlung", "Auszahlung"],
] as const;
export type StageStatus = (typeof PIPELINE_STAGES)[number][0];

/** Stufennamen der ersten Einrichtung (4 Stufen, bis 03.10.2026) → heutige Stufe. Werden beim erneuten Einrichten umbenannt. */
const LEGACY_STAGE_NAMES: Record<string, StageStatus> = { "Termin gelegt": "aufmass", "In den Checks": "checks" };

/** Ab so vielen erfolglosen Anrufen: Stufe „5. Anruf +“ */
export const ANRUF5_AB = 5;

/** Dashboard-Status (+ Anrufversuche) → Stufe. Ein neuer Lead geht sofort an den Presetter (Stufe 2). */
export function stageFor(status: StatusKey, versuche: number): StageStatus {
  switch (status) {
    case "terminierung":
      return versuche >= ANRUF5_AB ? "anruf5" : "kontakt";
    case "aufmass":
    case "checks":
    case "verkaufstermin":
    case "verkauft":
      return status;
    case "ausgezahlt":
      return "auszahlung";
    default:
      return "uebergeben";
  }
}

/** Eigene Deal-Felder (Name in Pipedrive, Typ) – alles, was an der Tür und danach erfasst wird, als echte Eigenschaft */
export const OWN_FIELDS = {
  thema: ["MB Thema", "varchar"],
  entscheider: ["MB Alle Entscheider", "varchar"],
  rueckruf: ["MB Rückrufwunsch", "varchar"],
  setterNotiz: ["MB Setter-Notiz", "text"],
  strasse: ["MB Straße + Nr.", "varchar"],
  plz: ["MB PLZ", "varchar"],
  ort: ["MB Ort", "varchar"],
  presetter: ["MB Presetter", "varchar"],
  closer: ["MB Closer", "varchar"],
  termin: ["MB Termin", "varchar"],
  versuche: ["MB Anrufversuche", "double"],
  gps: ["MB GPS", "varchar"],
  dashboardId: ["MB Dashboard-ID", "varchar"],
  /** alle Antworten der Vorqualifizierung (TMVT) als Text – auch die ohne eigenes „VQ …“-Feld */
  vqAlle: ["MB Vorqualifizierung", "text"],
  /** Kunden-ID im Enpal-Partnerportal */
  eppId: ["MB EPP-ID", "varchar"],
} as const satisfies Record<string, readonly [string, "varchar" | "text" | "double"]>;
export type OwnField = keyof typeof OWN_FIELDS;

export interface PipelineConfig {
  pipelineId: number;
  stages: Record<StageStatus, number>;
  /** Felder, die nach der ersten Einrichtung dazukamen, fehlen in älteren Einrichtungen (→ „Prüfen & ergänzen“) */
  fields: Partial<Record<OwnField, string>> & Record<Exclude<OwnField, "vqAlle" | "eppId">, string> & { setter: string };
  /** Vorqualifizierung: Dashboard-Feldname → Pipedrive-Feld (nur die, die es in Pipedrive gibt) */
  vq: Record<string, string>;
  createdAt: string;
}

const KEY = "pipedrive.dashboard";

export async function getPipelineConfig(): Promise<PipelineConfig | null> {
  const [row] = await db.select().from(schema.appSetting).where(eq(schema.appSetting.key, KEY));
  return row ? (JSON.parse(row.value) as PipelineConfig) : null;
}

export interface SetupReport {
  config: PipelineConfig;
  created: string[];
  reused: string[];
  missingVq: string[];
}

export async function ensurePipeline(adminId: string): Promise<SetupReport> {
  const created: string[] = [];
  const reused: string[] = [];

  let pipelineId = (await listPipelines()).find((p) => p.name === PIPELINE_NAME)?.id;
  if (pipelineId) reused.push(`Pipeline „${PIPELINE_NAME}“`);
  else {
    pipelineId = await createPipeline(PIPELINE_NAME);
    created.push(`Pipeline „${PIPELINE_NAME}“`);
  }

  const existingStages = await listStages(pipelineId);
  const stages = {} as Record<StageStatus, number>;
  for (const [status, name] of PIPELINE_STAGES) {
    const hit = existingStages.find((s) => s.name === name);
    const legacy = existingStages.find((s) => LEGACY_STAGE_NAMES[s.name] === status);
    if (hit) {
      stages[status] = hit.id;
      reused.push(`Stufe „${name}“`);
    } else if (legacy) {
      const alt = legacy.name;
      await updateStage(legacy.id, { name });
      stages[status] = legacy.id;
      created.push(`Stufe „${alt}“ → „${name}“`);
    } else {
      stages[status] = await createStage(pipelineId, name);
      created.push(`Stufe „${name}“`);
    }
  }
  /* Reihenfolge wie im Ablauf (neue Stufen hängt Pipedrive sonst hinten an) */
  const order = new Map(existingStages.map((s) => [s.id, s.order_nr]));
  for (const [i, [status]] of PIPELINE_STAGES.entries()) if (order.get(stages[status]) !== i + 1) await updateStage(stages[status], { order_nr: i + 1 });

  const dealFields = await listDealFields();
  const fields = { setter: DEAL_FIELDS.setter } as PipelineConfig["fields"];
  for (const [id, [name, type]] of Object.entries(OWN_FIELDS) as [OwnField, readonly [string, "varchar" | "text" | "double"]][]) {
    const hit = dealFields.find((f) => f.name === name);
    if (hit) {
      fields[id] = hit.key;
      reused.push(`Feld „${name}“`);
    } else {
      fields[id] = await createDealField(name, type);
      created.push(`Feld „${name}“`);
    }
  }

  const keys = new Set(dealFields.map((f) => f.key));
  const vq = Object.fromEntries(Object.entries(VQ_DEAL_FIELDS).filter(([, k]) => keys.has(k)));
  const missingVq = Object.keys(VQ_DEAL_FIELDS).filter((n) => !(n in vq));
  if (!keys.has(DEAL_FIELDS.setter)) missingVq.push("Setter-Feld");

  const config: PipelineConfig = { pipelineId, stages, fields, vq, createdAt: new Date().toISOString() };
  await db
    .insert(schema.appSetting)
    .values({ key: KEY, value: JSON.stringify(config) })
    .onConflictDoUpdate({ target: schema.appSetting.key, set: { value: JSON.stringify(config), updatedAt: new Date() } });
  await db.insert(schema.auditLog).values({ actorId: adminId, action: "pipedrive.setup", detail: `Pipeline ${pipelineId}: ${created.length} angelegt, ${reused.length} vorhanden` });
  return { config, created, reused, missingVq };
}

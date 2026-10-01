import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "../db";
import { createDealField, createPipeline, createStage, listDealFields, listPipelines, listStages } from "./client";
import { DEAL_FIELDS, VQ_DEAL_FIELDS } from "./config";

/* Die Pipeline in Pipedrive, in die das Dashboard neue Leads legt (Dashboard = Quelle der Wahrheit).
   ensurePipeline() legt Pipeline, Stufen und fehlende Felder an – vorhandene (gleicher Name) werden wiederverwendet,
   mehrfaches Ausführen ist also unschädlich. Die Zuordnung wird in app_setting gespeichert. */

export const PIPELINE_NAME = "MB-Dashboard Wärmepumpe";

/** Dashboard-Status → Stufe in der neuen Pipeline (abgesagt/verloren = Deal verloren mit Grund) */
export const PIPELINE_STAGES = [
  ["eingereicht", "Lead eingereicht"],
  ["termin", "Termin gelegt"],
  ["checks", "In den Checks"],
  ["verkauft", "Verkauf"],
] as const;
export type StageStatus = (typeof PIPELINE_STAGES)[number][0];

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
} as const satisfies Record<string, readonly [string, "varchar" | "text" | "double"]>;
export type OwnField = keyof typeof OWN_FIELDS;

export interface PipelineConfig {
  pipelineId: number;
  stages: Record<StageStatus, number>;
  fields: Record<OwnField, string> & { setter: string };
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
    if (hit) {
      stages[status] = hit.id;
      reused.push(`Stufe „${name}“`);
    } else {
      stages[status] = await createStage(pipelineId, name);
      created.push(`Stufe „${name}“`);
    }
  }

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

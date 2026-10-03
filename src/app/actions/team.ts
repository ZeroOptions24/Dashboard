"use server";

import { headers } from "next/headers";
import { ALL_ROLES } from "@/lib/roles";
import type { Role } from "@/lib/types";
import { requireAdmin } from "@/server/auth";
import { deleteOwnLead, ownLeadStats, retryOwnLeadSync } from "@/server/own-leads";
import { ensurePipeline, getPipelineConfig, OWN_FIELDS, PIPELINE_NAME, PIPELINE_STAGES } from "@/server/pipedrive/dashboard-pipeline";
import * as sa from "@/server/setter-assignment";
import { getTargets, setTargets, type Targets } from "@/server/targets";
import * as team from "@/server/team";
import { setterIdMap } from "@/server/workspace";

/* Team-Verwaltung – jede Aktion prüft selbst, dass ein Admin angemeldet ist. */

type Result<T = null> = { ok: true; data: T } | { ok: false; error: string };

async function asAdmin<T>(fn: (adminId: string, h: Headers) => Promise<T>): Promise<Result<T>> {
  try {
    const s = await requireAdmin();
    return { ok: true, data: await fn(s.user.id, await headers()) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unbekannter Fehler" };
  }
}

const validRoles = (roles: Role[]) => roles.length > 0 && roles.every((r) => ALL_ROLES.includes(r));

export async function updateMemberAction(userId: string, input: { name: string; email: string; roles: Role[] }) {
  if (!validRoles(input.roles)) return { ok: false as const, error: "Bitte gültige Rollen wählen" };
  return asAdmin(async (adminId, h) => {
    await team.updateMember(userId, input, adminId, h);
    return null;
  });
}

export async function setBannedAction(userId: string, banned: boolean) {
  return asAdmin(async (adminId, h) => {
    await team.setBanned(userId, banned, adminId, h);
    return null;
  });
}

export async function deleteMemberAction(userId: string) {
  return asAdmin(async (adminId, h) => {
    await team.deleteMember(userId, adminId, h);
    return null;
  });
}

export async function memberDetailsAction(userId: string) {
  return asAdmin(() => team.memberDetails(userId));
}

export async function revealIbanAction(userId: string) {
  return asAdmin((adminId) => team.revealIban(userId, adminId));
}

/** Ohne SMTP: nicht versendete Mails mit Link */
export async function listUnsentMailAction() {
  return asAdmin(() => team.listUnsentMail());
}

export async function logMailLinkCopiedAction(mailId: number) {
  return asAdmin(async (adminId) => {
    await team.logMailLinkCopied(mailId, adminId);
    return null;
  });
}

/** Vorschau: wie die eingefügte Liste gelesen wird (nichts wird angelegt) */
export async function previewImportAction(text: string) {
  return asAdmin(async () => team.parseImport(text));
}

export async function importMembersAction(text: string, skipContract: boolean) {
  return asAdmin((adminId, h) => team.importMembers(text, skipContract, adminId, h));
}

/* ---------- Setter-Zuweisung im Dashboard (Pipedrive bleibt unverändert) ---------- */

const knownSetters = async () => new Set((await setterIdMap()).keys());

export async function assignSetterAction(leadId: string, name: string) {
  return asAdmin(async (adminId) => {
    await sa.assignSetter(leadId, name, adminId);
    return null;
  });
}

export async function previewAssignmentsAction(text: string) {
  return asAdmin(async () => sa.parseAssignments(text, await knownSetters()));
}

export async function importAssignmentsAction(text: string) {
  return asAdmin(async (adminId) => sa.importAssignments(text, await knownSetters(), adminId));
}

export async function listAuditAction() {
  return asAdmin(() => team.listAudit());
}

/* ---------- Dashboard-Pipeline in Pipedrive ---------- */

export async function pipelineStatusAction() {
  return asAdmin(async () => {
    const config = await getPipelineConfig();
    /* ältere Einrichtung (4 Stufen bzw. ohne neue „MB …“-Felder) → muss einmal aktualisiert werden */
    const veraltet = !!config && (PIPELINE_STAGES.some(([k]) => !config.stages[k]) || Object.keys(OWN_FIELDS).some((k) => !(config.fields as Record<string, string>)[k]));
    return { name: PIPELINE_NAME, config, veraltet, leads: await ownLeadStats() };
  });
}

/** Pipeline, Stufen und Felder in Pipedrive anlegen bzw. prüfen (vorhandene werden wiederverwendet) */
export async function ensurePipelineAction() {
  return asAdmin(async (adminId) => ensurePipeline(adminId));
}

export async function retryOwnLeadSyncAction() {
  return asAdmin(async () => {
    const r = await retryOwnLeadSync();
    return { ok: r.filter((x) => !x.error).length, fehler: r.filter((x) => x.error).map((x) => `${x.id}: ${x.error}`) };
  });
}

/** Im Dashboard erfassten Lead löschen (Testlauf, Fehleingabe) – auch den Deal in Pipedrive */
export async function deleteOwnLeadAction(leadId: string) {
  return asAdmin(async (adminId) => {
    await deleteOwnLead(leadId, adminId);
    return null;
  });
}

/* ---------- Zielwerte ---------- */

export async function getTargetsAction() {
  return asAdmin(() => getTargets());
}

export async function setTargetsAction(input: Partial<Targets>) {
  return asAdmin((adminId) => setTargets(input, adminId));
}

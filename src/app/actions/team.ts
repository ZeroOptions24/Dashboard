"use server";

import { headers } from "next/headers";
import { ALL_ROLES } from "@/lib/roles";
import type { Role } from "@/lib/types";
import { requireAdmin } from "@/server/auth";
import * as team from "@/server/team";

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

/** Vorschau: wie die eingefügte Liste gelesen wird (nichts wird angelegt) */
export async function previewImportAction(text: string) {
  return asAdmin(async () => team.parseImport(text));
}

export async function importMembersAction(text: string, skipContract: boolean) {
  return asAdmin((adminId, h) => team.importMembers(text, skipContract, adminId, h));
}

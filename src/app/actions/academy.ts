"use server";

import { parseRoles } from "@/lib/roles";
import type { MaRole } from "@/lib/academy-content";
import * as ac from "@/server/academy";
import { getSession, requireAdmin } from "@/server/auth";

/* Akademie. Wer handelt, kommt immer aus der Sitzung – hier bewusst mit den echten Rollen,
   nicht mit den „wirksamen“: Gesperrte Rollen müssen ja lernen und testen können. */

type Result<T = null> = { ok: true; data: T } | { ok: false; error: string };
const fail = (e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : "Fehler" });

async function me() {
  const s = await getSession();
  if (!s || s.user.banned) throw new Error("Nicht angemeldet");
  return { id: s.user.id, roles: parseRoles(s.user.role) };
}
async function admin() {
  const s = await requireAdmin();
  return { id: s.user.id, roles: parseRoles(s.user.role) };
}

export async function loadAcademyAction() {
  try {
    return { ok: true as const, data: await ac.loadAcademy(await me()) };
  } catch (e) {
    return fail(e);
  }
}
export async function answerModuleAction(moduleId: string, pick: number) {
  try {
    return { ok: true as const, data: await ac.answerModule(await me(), moduleId, pick) };
  } catch (e) {
    return fail(e);
  }
}
export async function submitTestAction(role: MaRole, answers: number[]) {
  try {
    return { ok: true as const, data: await ac.submitTest(await me(), role, answers) };
  } catch (e) {
    return fail(e);
  }
}
export async function requestRetryAction(role: MaRole): Promise<Result> {
  try {
    await ac.requestRetry(await me(), role);
    return { ok: true, data: null };
  } catch (e) {
    return fail(e);
  }
}

/* Admin */
export async function grantRetryAction(userId: string, role: MaRole): Promise<Result> {
  try {
    await ac.setRetry(await admin(), userId, role);
    return { ok: true, data: null };
  } catch (e) {
    return fail(e);
  }
}
export async function resetRoleAction(userId: string, role: MaRole): Promise<Result> {
  try {
    await ac.resetRole(await admin(), userId, role);
    return { ok: true, data: null };
  } catch (e) {
    return fail(e);
  }
}
export async function unlockRoleAction(userId: string, role: MaRole): Promise<Result> {
  try {
    await ac.unlockRole(await admin(), userId, role);
    return { ok: true, data: null };
  } catch (e) {
    return fail(e);
  }
}
export async function setLockAction(on: boolean): Promise<Result> {
  try {
    await ac.setLock(await admin(), on);
    return { ok: true, data: null };
  } catch (e) {
    return fail(e);
  }
}
export async function setVideoAction(moduleId: string, url: string): Promise<Result> {
  try {
    await ac.setVideo(await admin(), moduleId, url);
    return { ok: true, data: null };
  } catch (e) {
    return fail(e);
  }
}

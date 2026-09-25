"use server";

import { getSession } from "@/server/auth";
import * as profile from "@/server/profile";

/* Eigene Stammdaten. Die Nutzer-ID kommt immer aus der Sitzung, nie vom Browser –
   so kann niemand fremde Daten abrufen oder ändern. */

async function me() {
  const s = await getSession();
  if (!s) throw new Error("Nicht angemeldet");
  return s.user.id;
}

export async function getMyProfileAction() {
  try {
    return { ok: true as const, data: await profile.getMyProfile(await me()) };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Fehler" };
  }
}

export async function revealMyIbanAction() {
  try {
    return { ok: true as const, data: await profile.revealMyIban(await me()) };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Fehler" };
  }
}

export async function updateMyProfileAction(data: profile.ProfileUpdate) {
  try {
    return await profile.updateMyProfile(await me(), data);
  } catch (e) {
    return { ok: false as const, errors: {}, error: e instanceof Error ? e.message : "Fehler" };
  }
}

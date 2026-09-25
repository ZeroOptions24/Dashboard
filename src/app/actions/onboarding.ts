"use server";

import { headers } from "next/headers";
import { requireAdmin } from "@/server/auth";
import * as ob from "@/server/onboarding";

/* Server Actions für das Onboarding. Jede Admin-Aktion prüft selbst die
   Berechtigung – Server Actions sind auch direkt per POST erreichbar. */

type Result<T = null> = { ok: true; data: T } | { ok: false; error: string };

async function asAdmin<T>(fn: (adminId: string, h: Headers) => Promise<T>): Promise<Result<T>> {
  try {
    const s = await requireAdmin();
    return { ok: true, data: await fn(s.user.id, await headers()) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unbekannter Fehler" };
  }
}

export async function listOnboardingAction() {
  return asAdmin(() => ob.listOnboarding());
}

export async function inviteMemberAction(input: { name: string; email: string; role: "setter" | "presetter" | "closer"; telefon?: string }) {
  if (!["setter", "presetter", "closer"].includes(input.role)) return { ok: false as const, error: "Ungültige Rolle" };
  return asAdmin(async (adminId, h) => {
    await ob.inviteMember(input, adminId, h);
    return null;
  });
}

export async function onboardingStepAction(userId: string, step: "resend" | "contract" | "access" | "direct" | "withdraw") {
  return asAdmin(async (adminId, h) => {
    if (step === "resend") await ob.resendFormLink(userId, adminId);
    else if (step === "contract") await ob.sendContract(userId, adminId);
    else if (step === "access") await ob.resendAccess(userId, adminId);
    else if (step === "direct") await ob.activateDirectly(userId, adminId);
    else if (step === "withdraw") await ob.withdraw(userId, adminId, h);
    return null;
  });
}

/** Öffentlich (nur mit gültigem Formular-Link): Stammdaten absenden. */
export async function submitOnboardingFormAction(token: string, data: ob.OnboardingFormData) {
  try {
    return await ob.submitFormData(token, data);
  } catch (e) {
    return { ok: false as const, errors: {}, error: e instanceof Error ? e.message : "Fehler" };
  }
}

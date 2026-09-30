"use server";

import { ALL_TEMPLATES } from "@/server/contracts";
import { getSession, requireAdmin } from "@/server/auth";
import * as cs from "@/server/contract-service";

/* Verträge – die Person sieht ihre eigenen, Admins alle. Die Nutzer-ID kommt immer aus der Sitzung. */

type Result<T = null> = { ok: true; data: T } | { ok: false; error: string };
const fail = (e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : "Fehler" });

async function viewer() {
  const s = await getSession();
  if (!s) throw new Error("Nicht angemeldet");
  return { id: s.user.id, role: s.user.role ?? null };
}

export async function listContractsAction(scope: "mine" | "all"): Promise<Result<cs.ContractRow[]>> {
  try {
    return { ok: true, data: await cs.listContracts(await viewer(), scope) };
  } catch (e) {
    return fail(e);
  }
}

export async function contractSummaryAction() {
  try {
    return { ok: true as const, data: await cs.contractSummary(await viewer()) };
  } catch (e) {
    return fail(e);
  }
}

export async function askQuestionAction(id: string, text: string): Promise<Result> {
  try {
    await cs.askQuestion(id, (await viewer()).id, text);
    return { ok: true, data: null };
  } catch (e) {
    return fail(e);
  }
}

export async function resolveQuestionAction(id: string): Promise<Result> {
  try {
    const s = await requireAdmin();
    await cs.resolveQuestion(id, s.user.id);
    return { ok: true, data: null };
  } catch (e) {
    return fail(e);
  }
}

export async function remindContractAction(id: string): Promise<Result> {
  try {
    const s = await requireAdmin();
    await cs.remindContract(id, s.user.id);
    return { ok: true, data: null };
  } catch (e) {
    return fail(e);
  }
}

export async function contractSendOptionsAction() {
  try {
    await requireAdmin();
    return { ok: true as const, data: { recipients: await cs.contractRecipients(), templates: ALL_TEMPLATES } };
  } catch (e) {
    return fail(e);
  }
}

export async function sendContractAction(userId: string, documents: string[]): Promise<Result> {
  try {
    const s = await requireAdmin();
    if (!documents.length || documents.some((d) => !ALL_TEMPLATES.includes(d))) throw new Error("Bitte Vorlagen auswählen");
    await cs.createAndSendContract(userId, s.user.id, documents);
    return { ok: true, data: null };
  } catch (e) {
    return fail(e);
  }
}

"use server";

import { parseRoles } from "@/lib/roles";
import { getSession } from "@/server/auth";
import type { Role } from "@/lib/types";
import type { FormValues } from "@/lib/vq";
import { recordLeadAction, type LeadAction } from "@/server/lead-activity";
import { claimLead, releaseLeads } from "@/server/lead-lock";
import { findDuplicates, submitLead } from "@/server/lead-submit";
import * as ws from "@/server/workspace";

/* Team-Alltag (Events, Kalender, Wettbewerb, Auszahlungen, Benachrichtigungen).
   Wer handelt, kommt immer aus der Sitzung; die Rechte prüft src/server/workspace.ts. */

type Result<T = null> = { ok: true; data: T } | { ok: false; error: string };

async function run<T>(fn: (v: ws.Viewer & { name: string }) => Promise<T>): Promise<Result<T>> {
  try {
    const s = await getSession();
    if (!s || s.user.banned) throw new Error("Nicht angemeldet");
    return { ok: true, data: await fn({ id: s.user.id, roles: parseRoles(s.user.role), name: s.user.name }) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unbekannter Fehler" };
  }
}

export const loadWorkspaceAction = async () => run((v) => ws.loadWorkspace(v));
export const markNotificationsReadAction = async () => run((v) => ws.markNotificationsRead(v));
export const toggleRsvpAction = async (eventId: string) => run((v) => ws.toggleRsvp(v, eventId));
export const postEventAction = async (input: Parameters<typeof ws.postEvent>[1]) => run((v) => ws.postEvent(v, input));
export const addSlotsAction = async (list: { date: string; start: number }[]) => run((v) => ws.addSlots(v, list));
export const removeSlotAction = async (slotId: string) => run((v) => ws.removeSlot(v, slotId));
export const bookDirectAction = async (lead: { id: string; kunde: string; ort: string }, input: { date: string; start: number; closerId: string }) =>
  run((v) => ws.bookDirect(v, lead, input));
export const bookSlotAction = async (slotId: string, lead: { id: string; kunde: string; ort: string }) => run((v) => ws.bookSlot(v, slotId, lead));
export const saveFeedbackAction = async (apptId: string, input: Parameters<typeof ws.saveFeedback>[2]) => run((v) => ws.saveFeedback(v, apptId, input));
export const publishBoardAction = async (input: Parameters<typeof ws.publishBoard>[1]) => run((v) => ws.publishBoard(v, input));
export const releasePayoutAction = async (payoutId: string) => run((v) => ws.releasePayout(v, payoutId));
export const setMoneyGoalAction = async (euro: number) => run((v) => ws.setMoneyGoal(v, euro));

/** Lead an n8n/Pipedrive übertragen (wie das bisherige Setter-Formular) */
export const submitLeadAction = async (values: FormValues, standort: unknown) => run((v) => submitLead(v, values, standort));

/** Aktion an einem Pipedrive-Lead (Anrufversuch, Status, Rückruf, Notiz, Vorqualifizierung) */
export const leadAction = async (role: Role, leadId: string, action: LeadAction) => run((v) => recordLeadAction(v, role, leadId, action));

/** Lead im Leitfaden öffnen/halten („wird gerade bearbeitet“) */
export const claimLeadAction = async (leadId: string, force = false) => run((v) => claimLead(v, leadId, force));
export const releaseLeadsAction = async () => run((v) => releaseLeads(v));

/** Vor dem Anlegen: gibt es den Kunden schon in Pipedrive? */
export const checkDuplicatesAction = async (values: FormValues) => run((v) => findDuplicates(v, values));

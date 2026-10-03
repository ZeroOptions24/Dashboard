/* Regeln für Closer-Termine und freie Slots. */

import { FEEDBACK_FRIST_H } from "./domain";
import { dkey, pad, parseKey } from "./format";
import type { Appointment, PersonKey, Slot } from "./types";

export const apptEnd = (a: Appointment) => {
  const d = parseKey(a.date);
  d.setMinutes(Math.round((a.start + a.dur) * 60));
  return d;
};

/** Termin vorbei, aber noch keine Rückmeldung des Closers. */
export const needsFeedback = (a: Appointment, now: Date) => !a.reserved && !a.feedback && apptEnd(a) <= now;

/** Vom Setter vorgemerkter, noch nicht bestätigter Termin eines Leads */
export const reservationOf = (appts: Appointment[], leadId: string) => appts.find((a) => a.lead === leadId && a.reserved);

/** Frist für die Rückmeldung: Terminende + FEEDBACK_FRIST_H Stunden. */
export const feedbackDue = (a: Appointment) => new Date(apptEnd(a).getTime() + FEEDBACK_FRIST_H * 36e5);

export const pendingFeedback = (appts: Appointment[], closer: PersonKey, now: Date) =>
  appts.filter((a) => a.closer === closer && needsFeedback(a, now));

/** Closer ist für neue Leads pausiert, sobald eine Rückmeldung überfällig ist. */
export const closerPaused = (appts: Appointment[], closer: PersonKey, now: Date) =>
  pendingFeedback(appts, closer, now).some((a) => feedbackDue(a) < now);

export const kindLabel = (a: Pick<Appointment, "kind">) => (a.kind === "closing" ? "Verkaufstermin" : "Aufmaßtermin");

/** Freie, noch nicht vergangene Slots eines Closers – leer, wenn er pausiert ist. */
export function freeSlots(slots: Slot[], appts: Appointment[], closer: PersonKey, now: Date, ignorePause = false) {
  if (!ignorePause && closerPaused(appts, closer, now)) return [];
  const today = dkey(now);
  return slots
    .filter((s) => s.closer === closer && (s.date > today || (s.date === today && s.start > now.getHours())))
    .sort((a, b) => (a.date + pad(a.start)).localeCompare(b.date + pad(b.start)));
}

/** Buchbare Slots aller Closer (pausierte ausgenommen), sortiert; dazu wer anbietet und wer pausiert ist. */
export function bookableSlots(slots: Slot[], appts: Appointment[], now: Date) {
  const all = [...new Set([...slots.map((s) => s.closer), ...appts.map((a) => a.closer)])];
  const paused = all.filter((c) => closerPaused(appts, c, now));
  const free = all
    .filter((c) => !paused.includes(c))
    .flatMap((c) => freeSlots(slots, appts, c, now, true))
    .sort((a, b) => (a.date + pad(a.start)).localeCompare(b.date + pad(b.start)));
  return { slots: free, closers: [...new Set(free.map((s) => s.closer))], paused: paused.filter((c) => slots.some((s) => s.closer === c)) };
}

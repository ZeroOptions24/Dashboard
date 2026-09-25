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
export const needsFeedback = (a: Appointment, now: Date) => !a.feedback && apptEnd(a) <= now;

/** Frist für die Rückmeldung: Terminende + FEEDBACK_FRIST_H Stunden. */
export const feedbackDue = (a: Appointment) => new Date(apptEnd(a).getTime() + FEEDBACK_FRIST_H * 36e5);

export const pendingFeedback = (appts: Appointment[], closer: PersonKey, now: Date) =>
  appts.filter((a) => a.closer === closer && needsFeedback(a, now));

/** Closer ist für neue Leads pausiert, sobald eine Rückmeldung überfällig ist. */
export const closerPaused = (appts: Appointment[], closer: PersonKey, now: Date) =>
  pendingFeedback(appts, closer, now).some((a) => feedbackDue(a) < now);

export const kindLabel = (a: Appointment) => (a.kind === "closing" ? "2. Termin" : "Ersttermin");

/** Freie, noch nicht vergangene Slots eines Closers – leer, wenn er pausiert ist. */
export function freeSlots(slots: Slot[], appts: Appointment[], closer: PersonKey, now: Date, ignorePause = false) {
  if (!ignorePause && closerPaused(appts, closer, now)) return [];
  const today = dkey(now);
  return slots
    .filter((s) => s.closer === closer && (s.date > today || (s.date === today && s.start > now.getHours())))
    .sort((a, b) => (a.date + pad(a.start)).localeCompare(b.date + pad(b.start)));
}

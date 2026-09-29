/* Aktionen auf den Dashboard-Daten (Events, Verträge, Auszahlungen, Ranglisten).
   Heute ändern sie die Beispieldaten im Store; später rufen sie hier die echte
   Datenquelle auf (Datenbank, DocuSign/Yousign, n8n) – die Ansichten bleiben gleich. */

import { eur, fmtDay, pad } from "./format";
import { ranked } from "./ranking";
import { currentUser, rerender, store } from "./store";
import type { Board, PersonKey, StatusKey, TeamEvent } from "./types";

const d = () => store.data;
const first = (k: PersonKey) => d().PEOPLE[k]?.first ?? k;
const rnd = () => Math.random().toString(36).slice(2, 6);
const today = () => {
  const n = d().NOW;
  return `${pad(n.getDate())}.${pad(n.getMonth() + 1)}.${n.getFullYear()}`;
};

/** Benachrichtigung an eine Person (später: n8n → E-Mail/WhatsApp) */
export function pushNotif(who: PersonKey, t: string, status: StatusKey | null = null) {
  (d().NOTIFS[who] ??= []).unshift({ t, time: "gerade eben", status, unread: true });
}

/* ---------- Events ---------- */

/** Zusage umschalten; liefert true, wenn jetzt zugesagt */
export function toggleEventGoing(id: string): boolean {
  const ev = d().EVENTS.find((x) => x.id === id);
  if (!ev) return false;
  const me = currentUser();
  const i = ev.going.indexOf(me);
  if (i >= 0) ev.going.splice(i, 1);
  else ev.going.push(me);
  rerender();
  return i < 0;
}

export function postEvent(input: Omit<TeamEvent, "id" | "going" | "by" | "isNew">) {
  const ev: TeamEvent = { ...input, id: `E-${rnd()}`, going: [], by: currentUser(), isNew: true };
  d().EVENTS.push(ev);
  /* Prototyp: Beispielpersonen je Rolle benachrichtigen */
  for (const k of ["romy", "inan", "leo"]) pushNotif(k, `Neues Event: ${ev.title} am ${fmtDay(ev.date)}`);
  rerender();
}

/* ---------- Verträge ---------- */

export function signContract(id: string) {
  const c = d().CONTRACTS.find((x) => x.id === id);
  if (!c) return;
  c.status = "signed";
  c.signed = today();
  pushNotif("tim", `${first(c.who)} hat „${c.doc}“ unterschrieben`);
  rerender();
}

export function askContractQuestion(id: string, question: string) {
  const c = d().CONTRACTS.find((x) => x.id === id);
  if (!c || !question.trim()) return;
  c.question = question.trim();
  pushNotif("tim", `${first(c.who)} hat eine Rückfrage zu „${c.doc}“`);
  rerender();
}

export function remindContract(id: string) {
  const c = d().CONTRACTS.find((x) => x.id === id);
  if (c) pushNotif(c.who, `Erinnerung: Bitte „${c.doc}“ in DocuSign unterschreiben`);
}

export function resolveContractQuestion(id: string) {
  const c = d().CONTRACTS.find((x) => x.id === id);
  if (!c) return;
  delete c.question;
  pushNotif(c.who, `Deine Rückfrage zu „${c.doc}“ wurde beantwortet`);
  rerender();
}

/** Vertrag aus Vorlage an eine Person senden (Demo; echt: Onboarding/Signing-Tool) */
export function sendContractDemo(who: PersonKey, doc: string) {
  d().CONTRACTS.unshift({ id: `V-${rnd().toUpperCase()}`, who, doc, status: "open", sent: today(), signed: null });
  pushNotif(who, `Neuer Vertrag zur Unterschrift: „${doc}“`);
  rerender();
}

/* ---------- Auszahlungen ---------- */

export function releasePayout(who: PersonKey, id: string) {
  const p = d().PAYOUTS[who]?.find((x) => x.id === id);
  if (!p) return null;
  p.status = "freigegeben";
  pushNotif(who, `Deine Abrechnung ${p.periode} wurde freigegeben (${eur(p.betrag)})`);
  rerender();
  return p;
}

/* ---------- Ranglisten ---------- */

export function publishBoard(board: Board, patch: { title: string; goal?: number; ends: string; rows: [PersonKey, number][] }, notify: PersonKey[]) {
  const n = d().NOW;
  board.title = patch.title;
  if (board.goal && patch.goal) board.goal = Math.max(1, patch.goal);
  board.ends = patch.ends;
  board.rows.splice(0, board.rows.length, ...patch.rows.map(([k, v]): [PersonKey, number] => [k, Math.max(0, v || 0)]));
  board.published = `${pad(n.getDate())}.${pad(n.getMonth() + 1)}.${n.getFullYear()}, ${pad(n.getHours())}:${pad(n.getMinutes())}`;
  board.by = d().PEOPLE[currentUser()]?.first ?? "Admin";
  for (const k of notify) {
    const r = ranked(board.rows).find((x) => x.key === k);
    pushNotif(k, r ? `Neue Rangliste: ${board.title} – du bist auf Platz ${r.rank}` : `Neue Rangliste: ${board.title}`);
  }
  rerender();
}

/* Aktionen auf den Dashboard-Daten (Events, Verträge, Auszahlungen, Ranglisten).
   Heute ändern sie die Beispieldaten im Store; später rufen sie hier die echte
   Datenquelle auf (Datenbank, DocuSign/Yousign, n8n) – die Ansichten bleiben gleich. */

import { dkey, eur, fmtDay, fmtHour, nowStamp, pad, parseKey } from "./format";
import { ranked } from "./ranking";
import { currentUser, notify, rerender, store } from "./store";
import type { Board, Lead, PersonKey, Slot, StatusKey, TeamEvent } from "./types";
import type { FormValues } from "./vq";

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

/* ---------- Closer-Kalender ---------- */

const mySlotAt = (k: string, h: number) => d().SLOTS.find((s) => s.closer === currentUser() && s.date === k && s.start === h);
const myApptAt = (k: string, h: number) => d().APPTS.find((a) => a.closer === currentUser() && a.date === k && Math.floor(a.start) === h);

/** Einen freien Slot eintragen */
export function addSlot(date: string, hour: number) {
  d().SLOTS.push({ id: `S-${rnd()}`, closer: currentUser(), date, start: hour });
  rerender();
  return `Freier Slot eingetragen: ${fmtDay(date)} ${fmtHour(hour)}`;
}

export function removeSlot(id: string) {
  const i = d().SLOTS.findIndex((s) => s.id === id);
  if (i >= 0) d().SLOTS.splice(i, 1);
  rerender();
}

/** Stundenweise Slots von–bis eintragen (optional 4 Wochen); liefert die Anzahl neuer Slots */
export function addSlotRange(date: string, from: number, to: number, repeat4Weeks: boolean): number {
  let n = 0;
  for (let w = 0; w < (repeat4Weeks ? 4 : 1); w++) {
    const day = parseKey(date);
    day.setDate(day.getDate() + w * 7);
    const k = dkey(day);
    for (let h = from; h < to; h++)
      if (!mySlotAt(k, h) && !myApptAt(k, h)) {
        d().SLOTS.push({ id: `S-${rnd()}`, closer: currentUser(), date: k, start: h });
        n++;
      }
  }
  /* Prototyp: Presetterin „Inan“ bekommt die neuen Slots angezeigt */
  pushNotif("inan", `${first(currentUser())} hat ${n} neue freie Slots eingetragen`);
  rerender();
  return n;
}

/* ---------- Leads ---------- */

const leadById = (id: string) => d().LEADS.find((l) => l.id === id);

/** Status über die Übergangsschicht setzen (Verlauf, Benachrichtigung, Anrufzähler) */
export const setLeadStatus = (id: string, status: StatusKey, silent = true, reason?: string, note?: string) =>
  store.legacy?.setStatus(id, status, silent, reason, note);

/** Antwort der Vorqualifizierung direkt am Lead speichern (Telefonleitfaden) */
export function setLeadVq(id: string, name: string, value: string | string[]) {
  const l = leadById(id);
  if (!l) return;
  (l.vq ??= {})[name] = Array.isArray(value) ? value.join(", ") : value;
  notify();
}

export function setLeadPreNote(id: string, note: string) {
  const l = leadById(id);
  if (l) l.preNote = note;
}

/** Ersttermin in einem freien Closer-Slot buchen */
export function bookSlot(l: Lead, s: Slot) {
  const i = d().SLOTS.findIndex((x) => x.id === s.id);
  if (i >= 0) d().SLOTS.splice(i, 1);
  d().APPTS.push({ id: `T-${rnd()}`, lead: l.id, closer: s.closer, kind: "erst", date: s.date, start: s.start, dur: 1.5, ort: l.ort, feedback: null });
  l.closer = s.closer;
  setLeadStatus(l.id, "termin", true);
  pushNotif(s.closer, `Neuer Ersttermin: ${l.kunde}, ${fmtDay(s.date)} ${fmtHour(s.start)} (${l.ort})`, "termin");
  rerender();
}

/** Lead aus dem Setting-Formular anlegen (Prototyp: lokal; echt: n8n-Webhook → Pipedrive) */
export function createLead(v: FormValues): Lead {
  const s = (k: string) => String(v[k] ?? "").trim();
  const n = d().NOW;
  const tel = s("telefon").replace(/\s+/g, " ");
  const telMasked = tel.length > 8 ? `${tel.slice(0, 4)} •••• ${tel.replace(/\s/g, "").slice(-4)}` : tel;
  const rueck = [s("rueckruf_datum"), s("rueckruf_uhrzeit") && `${s("rueckruf_uhrzeit")} Uhr`].filter(Boolean).join(" ");
  const zf = (v.zeitfenster as string[] | undefined) ?? [];
  const note = [s("notizen"), s("alle_entscheider"), rueck && `Rückruf: ${rueck}`, zf.length && `Erreichbar: ${zf.join(", ")}`].filter(Boolean).join(" · ");
  const count = d().LEADS.length;
  const l: Lead = {
    id: `L-${2450 + count}`,
    pd: 48400 + count,
    kunde: `${s("vorname") ? s("vorname") + " " : ""}${s("nachname")}`,
    anrede: `${s("anrede") || "Familie"} ${s("nachname")}`,
    tel: telMasked,
    ort: s("stadt"),
    adresse: `${s("strasse")} ${s("hausnummer")}, ${s("plz")} ${s("stadt")}`,
    produkt: "wp",
    entscheider: s("alle_entscheider"),
    eigenlead: true,
    status: "eingereicht",
    setter: currentUser(),
    presetter: "inan" /* Prototyp: fester Presetter */,
    datum: `${pad(n.getDate())}.${pad(n.getMonth() + 1)}.${n.getFullYear()}`,
    setNote: note,
    preNote: "",
    hist: [["Lead eingereicht (an der Tür erfasst)", nowStamp(n)]],
    attempts: 0,
    nextTry: rueck || null,
    reason: null,
    reasonNote: "",
    themen: ((v.thema as string[] | undefined) ?? []).slice(),
  };
  d().LEADS.unshift(l);
  pushNotif("inan", `Neuer Lead von ${first(currentUser())}: ${l.kunde}${rueck ? " – Rückruf " + rueck : ""}`, "eingereicht");
  rerender();
  return l;
}

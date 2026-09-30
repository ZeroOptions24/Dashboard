/* Aktionen auf den Dashboard-Daten (Events, Verträge, Auszahlungen, Ranglisten).
   Heute ändern sie die Beispieldaten im Store; später rufen sie hier die echte
   Datenquelle auf (Datenbank, Yousign, n8n) – die Ansichten bleiben gleich. */

import { dkey, eur, fmtDay, fmtHour, nowStamp, pad, parseKey } from "./format";
import { apptEnd } from "./appointments";
import { STATUS } from "./domain";
import { urgencySort } from "./leads";
import { ranked } from "./ranking";
import { currentUser, notify, rerender, store } from "./store";
import type { Board, Lead, PersonKey, Slot, StatusKey, TeamEvent } from "./types";
import type { FormValues } from "./vq";

const d = () => store.data;
const first = (k: PersonKey) => d().PEOPLE[k]?.first ?? k;
const rnd = () => Math.random().toString(36).slice(2, 6);

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

/** Text für den nächsten Anrufversuch (Prototyp: feste Beispieltermine) */
const nextTryText = (n: number) => (n === 1 ? "heute ab 17:00" : n === 2 ? "Do 24.09. ab 18:00" : n < 5 ? "Fr 25.09. vormittags" : "letzter Versuch, danach absagen");

/** Lead-Status setzen – mit Verlauf, Benachrichtigung des Setters und Anrufzähler.
 *  „nicht_erreicht“ = Anrufversuch ohne Erfolg, der Lead bleibt „Lead eingereicht“.
 *  Liefert den Text für die Kurzmeldung. */
export function setLeadStatus(id: string, status: StatusKey | "nicht_erreicht", reason?: string, note?: string): string {
  const l = leadById(id);
  if (!l) return "";
  const attempt = status === "nicht_erreicht";
  if (store.ui.role === "presetter" && l.status === "eingereicht") d().CALL_DAY.done++;
  let st: StatusKey;
  if (attempt) {
    l.attempts++;
    l.nextTry = nextTryText(l.attempts);
    st = "eingereicht";
  } else {
    st = status;
    if (st === "termin" || st === "checks") l.nextTry = null;
  }
  l.status = st;
  if (reason) {
    l.reason = reason;
    l.reasonNote = note || "";
  }
  l.hist.unshift([(attempt ? `Nicht erreicht (Versuch ${l.attempts})` : STATUS[st].label) + (reason ? ` – ${reason}` : ""), nowStamp(d().NOW)]);
  /* verloren: künftige Termine entfallen, gelaufene bleiben für die Historie */
  if (st === "verloren") {
    const keep = d().APPTS.filter((a) => a.lead !== id || apptEnd(a) <= d().NOW);
    d().APPTS.splice(0, d().APPTS.length, ...keep);
  }
  pushNotif(l.setter, `${l.kunde}: Status → ${STATUS[st].label}${reason ? ` (${reason})` : ""}`, st);
  rerender();
  return attempt ? `${l.kunde}: Versuch ${l.attempts} – nächster ${l.nextTry}` : `${l.kunde}: ${STATUS[st].label} · ${first(l.setter)} wurde benachrichtigt`;
}

/** Telefonleitfaden: zum dringendsten offenen Lead (außer fromId) weiter; liefert dessen Namen */
export function guideAdvance(fromId: string): string | null {
  const nxt = d()
    .LEADS.filter((x) => x.presetter === currentUser() && x.status === "eingereicht" && x.id !== fromId)
    .sort(urgencySort(d().NOW))[0];
  store.ui.guideSlot = null;
  if (nxt) store.ui.guideLead = nxt.id;
  rerender();
  return nxt?.kunde ?? null;
}

/** Rückruf vereinbaren; liefert „heute 18:00“ o. ä. */
export function saveCallback(id: string, date: string, time: string, note: string): string {
  const l = leadById(id);
  if (!l) return "";
  const when = `${date === dkey(d().NOW) ? "heute" : fmtDay(date)} ${time}`;
  if (store.ui.role === "presetter") d().CALL_DAY.done++;
  l.nextTry = `Rückruf ${when}`;
  l.hist.unshift([`Rückruf vereinbart: ${when}${note ? " – " + note : ""}`, nowStamp(d().NOW)]);
  if (note) l.preNote = [l.preNote, note].filter(Boolean).join(" · ");
  pushNotif(l.setter, `${l.kunde}: Rückruf vereinbart (${when})`, "eingereicht");
  rerender();
  return when;
}

export type FeedbackResult = "checks" | "nicht_angetroffen" | "verloren" | "verkauft" | "entscheidung";

/** Pflicht-Rückmeldung des Closers nach einem Termin.
 *  apptId = Termin-ID oder „LEAD:<id>“ (Lead in den Checks ohne eingetragenen 2. Termin). */
export function applyFeedback(apptId: string, res: FeedbackResult, o: { note: string; date?: string; hour?: number; reason?: string }) {
  const real = d().APPTS.find((x) => x.id === apptId);
  const a = real ?? { id: apptId, lead: apptId.replace("LEAD:", ""), kind: "closing" as const, closer: currentUser(), ort: "" };
  const l = leadById(a.lead);
  if (!l) return "";
  if (real) real.feedback = { result: res, at: nowStamp(d().NOW), note: o.note || "" };
  if (res === "checks") {
    if (o.date) d().APPTS.push({ id: `T-${rnd()}`, lead: l.id, closer: a.closer, kind: "closing", date: o.date, start: o.hour ?? 17, dur: 1.5, ort: a.ort, feedback: null });
    setLeadStatus(l.id, "checks");
    l.hist[0][0] = `Ersttermin fand statt – in den Checks${o.date ? `, 2. Termin ${fmtDay(o.date)} ${fmtHour(o.hour ?? 17)}` : ""}`;
    d().NOTIFS[l.setter][0].t = `${l.kunde}: Ersttermin fand statt – Kunde ist in den Checks`;
  } else if (res === "verkauft") setLeadStatus(l.id, "verkauft");
  else if (res === "verloren") setLeadStatus(l.id, "verloren", o.reason, o.note);
  else if (res === "nicht_angetroffen") {
    l.status = "eingereicht";
    l.nextTry = "Neuen Termin legen";
    l.hist.unshift(["Kunde nicht angetroffen – neuer Termin wird gelegt", nowStamp(d().NOW)]);
    pushNotif(l.setter, `${l.kunde}: beim Ersttermin nicht angetroffen – neuer Termin wird gelegt`, "eingereicht");
    if (l.presetter) pushNotif(l.presetter, `${l.kunde}: nicht angetroffen – bitte neuen Termin legen`, "eingereicht");
  } else if (res === "entscheidung") {
    l.hist.unshift(["2. Termin fand statt – Kunde entscheidet noch", nowStamp(d().NOW)]);
    pushNotif(l.setter, `${l.kunde}: 2. Termin fand statt – Kunde entscheidet noch`, "checks");
  }
  if (o.note && res !== "verloren") l.hist[0][0] += ` – ${o.note}`;
  rerender();
  return `Rückmeldung gespeichert · ${first(l.setter)} informiert`;
}

/* ---------- Benachrichtigungen ---------- */

export function markAllNotifRead() {
  (d().NOTIFS[currentUser()] || []).forEach((n) => (n.unread = false));
  rerender();
}

/** Demo: Statusänderung aus Pipedrive simulieren (Setter); liefert den Kundennamen */
export function simulatePipedriveUpdate(): string | null {
  const me = currentUser();
  const cand = d().LEADS.find((l) => l.setter === me && l.status === "eingereicht");
  if (!cand) return null;
  cand.status = "termin";
  cand.hist.unshift([STATUS.termin.label, nowStamp(d().NOW)]);
  pushNotif(me, `${cand.kunde}: Status → ${STATUS.termin.label}`, "termin");
  rerender();
  return cand.kunde;
}

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
  setLeadStatus(l.id, "termin");
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

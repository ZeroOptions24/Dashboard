/* Aktionen auf den Dashboard-Daten (Events, Kalender, Auszahlungen, Ranglisten, Leads).
   Sie ändern zuerst den Store (sofort sichtbar); im Live-Modus speichert persist()
   die Änderung zusätzlich auf dem Server (src/server/workspace.ts).
   Noch nur lokal: Lead-Status, Rückrufe, Vorqualifizierung – die gehen später nach Pipedrive. */

import {
  addSlotsAction,
  bookDirectAction,
  bookSlotAction,
  confirmReservationAction,
  releaseReservationAction,
  markTbkAction,
  stornoAction,
  askProvisionAction,
  answerProvisionAction,
  runSettlementAction,
  markNotificationsReadAction,
  postEventAction,
  publishBoardAction,
  releasePayoutAction,
  removeSlotAction,
  saveFeedbackAction,
  toggleRsvpAction,
} from "@/app/actions/workspace";
import { leadAction } from "@/app/actions/workspace";
import type { LeadAction } from "@/server/lead-activity";
import { nextTryText as sharedNextTry } from "./lead-activity";
import { persist } from "./live";
import { dkey, eur, fmtDay, fmtHour, nowStamp, pad, parseKey } from "./format";
import { apptEnd, kindLabel } from "./appointments";
import { STATUS } from "./domain";
import { inCallPool, isCalling, isStoredLeadId, urgencySort } from "./leads";
import { ranked } from "./ranking";
import { currentUser, LIVE, notify, rerender, store } from "./store";
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
  persist(() => toggleRsvpAction(id));
  return i < 0;
}

export function postEvent(input: Omit<TeamEvent, "id" | "going" | "by" | "isNew">) {
  const ev: TeamEvent = { ...input, id: `E-${rnd()}`, going: [], by: currentUser(), isNew: true };
  d().EVENTS.push(ev);
  /* Prototyp: Beispielpersonen je Rolle benachrichtigen; live benachrichtigt der Server die Zielgruppe */
  if (!LIVE) for (const k of ["romy", "inan", "leo"]) pushNotif(k, `Neues Event: ${ev.title} am ${fmtDay(ev.date)}`);
  rerender();
  persist(() => postEventAction(input), { reload: true });
}

/* ---------- Auszahlungen ---------- */

export function releasePayout(who: PersonKey, id: string) {
  const p = d().PAYOUTS[who]?.find((x) => x.id === id);
  if (!p) return null;
  p.status = "freigegeben";
  if (!LIVE) pushNotif(who, `Deine Abrechnung ${p.periode} wurde freigegeben (${eur(p.betrag)})`);
  rerender();
  persist(() => releasePayoutAction(id));
  return p;
}

/* ---------- Enpal-Partnerportal (EPP) ---------- */

/** EPP-ID am Lead eintragen (Kunde im EPP angelegt und an den Closer übertragen) */
export function setEppId(id: string, eppId: string) {
  const l = leadById(id);
  if (!l) return;
  l.eppId = eppId || undefined;
  l.hist.unshift([eppId ? `Im EPP angelegt – EPP-ID ${eppId}` : "EPP-ID entfernt", nowStamp(d().NOW)]);
  rerender();
  persistLead(id, { type: "epp", eppId });
}

/* ---------- Provisionen (TBK, Storno, Rückfragen) ---------- */

/** Admin: Kunde ist TBK → wartende Provisionen des Leads werden fest */
export function markTbk(leadId: string) {
  for (const x of d().PROVISIONS) if (x.lead === leadId && x.status === "tbk") x.status = "fest";
  rerender();
  persist(() => markTbkAction(leadId), { reload: true });
}

/** Admin: Storno mit Grund (Widerruf, MVT nicht baubar …) */
export function stornoLead(leadId: string, grund: string) {
  for (const x of d().PROVISIONS) if (x.lead === leadId && x.status !== "storno" && !x.payoutId) Object.assign(x, { status: "storno", grund });
  rerender();
  persist(() => stornoAction(leadId, grund), { reload: true });
}

/** MB: Rückfrage zu einer Position (geht an die Admins) */
export function askProvision(id: string, text: string) {
  const x = d().PROVISIONS.find((p) => p.id === id);
  if (x) Object.assign(x, { frage: text, antwort: null });
  rerender();
  persist(() => askProvisionAction(id, text));
}

/** Admin: Rückfrage beantworten */
export function answerProvision(id: string, text: string) {
  const x = d().PROVISIONS.find((p) => p.id === id);
  if (x) x.antwort = text;
  rerender();
  persist(() => answerProvisionAction(id, text));
}

/** Admin: Abrechnung zum heutigen Tag sofort erstellen (sonst automatisch am 1. und 15.) */
export function runSettlementNow(done: (n: number) => void) {
  if (!LIVE) return done(0);
  persist(() => runSettlementAction(), { reload: true, onOk: (ids) => done(ids.length) });
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
  if (LIVE && board === d().BOARD) {
    const rows = board.rows.map(([k, v]): [string, number] => [k, v]);
    persist(() => publishBoardAction({ id: store.live.boardId, title: board.title, goal: board.goal ?? undefined, ends: board.ends, rows, prizes: board.prizes, marks: board.marks }), {
      reload: true,
    });
  }
  if (!LIVE) for (const k of notify) {
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
  persist(() => addSlotsAction([{ date, start: hour }]), { reload: true });
  return `Freier Slot eingetragen: ${fmtDay(date)} ${fmtHour(hour)}`;
}

export function removeSlot(id: string) {
  const i = d().SLOTS.findIndex((s) => s.id === id);
  if (i >= 0) d().SLOTS.splice(i, 1);
  rerender();
  persist(() => removeSlotAction(id));
}

/** Stundenweise Slots von–bis eintragen (optional 4 Wochen); liefert die Anzahl neuer Slots */
export function addSlotRange(date: string, from: number, to: number, repeat4Weeks: boolean): number {
  let n = 0;
  const added: { date: string; start: number }[] = [];
  for (let w = 0; w < (repeat4Weeks ? 4 : 1); w++) {
    const day = parseKey(date);
    day.setDate(day.getDate() + w * 7);
    const k = dkey(day);
    for (let h = from; h < to; h++)
      if (!mySlotAt(k, h) && !myApptAt(k, h)) {
        d().SLOTS.push({ id: `S-${rnd()}`, closer: currentUser(), date: k, start: h });
        added.push({ date: k, start: h });
        n++;
      }
  }
  /* Prototyp: Presetterin „Inan“ bekommt die neuen Slots angezeigt; live benachrichtigt der Server alle Presetter */
  if (!LIVE) pushNotif("inan", `${first(currentUser())} hat ${n} neue freie Slots eingetragen`);
  rerender();
  if (added.length) persist(() => addSlotsAction(added), { reload: true });
  return n;
}

/* ---------- Leads ---------- */

const leadById = (id: string) => d().LEADS.find((l) => l.id === id);

/** Text für den nächsten Anrufversuch (echte Daten: gemeinsame Regel mit dem Server; Prototyp: feste Beispieltermine) */
const nextTryText = (n: number) => (LIVE ? sharedNextTry(n) : demoNextTry(n));
const demoNextTry = (n: number) => (n === 1 ? "heute ab 17:00" : n === 2 ? "Do 24.09. ab 18:00" : n < 5 ? "Fr 25.09. vormittags" : "letzter Versuch, danach absagen");

/** Lead-Status setzen – mit Verlauf, Benachrichtigung des Setters und Anrufzähler.
 *  „nicht_erreicht“ = Anrufversuch ohne Erfolg, der Lead bleibt „Lead eingereicht“.
 *  Liefert den Text für die Kurzmeldung. */
/** Im Live-Modus: Aktion an einem Pipedrive-Lead speichern (und ggf. nach Pipedrive schreiben) */
function persistLead(id: string, action: LeadAction) {
  const role = store.ui.role;
  if (!isStoredLeadId(id)) return;
  persist(() => leadAction(role, id, action));
}

/** Vorqualifizierung an der Tür (Setter) am Lead speichern – Presetter sehen sie im Leitfaden */
export function saveDoorVq(id: string, answers: Record<string, string>, note: string) {
  if (!LIVE) return;
  persistLead(id, { type: "vq", answers });
  persistLead(id, { type: "note", text: note });
}

/** Eingaben im Leitfaden gebündelt speichern (nicht bei jedem Tastendruck) */
const pending = new Map<string, { timer: ReturnType<typeof setTimeout>; run: () => void }>();
function persistLater(key: string, id: string, action: () => LeadAction) {
  if (!LIVE) return;
  clearTimeout(pending.get(key)?.timer);
  const run = () => {
    pending.delete(key);
    persistLead(id, action());
  };
  pending.set(key, { timer: setTimeout(run, 1200), run });
}
/** Offene Eingaben eines Leads sofort speichern (vor dem Ergebnis, damit sie in der Pipedrive-Notiz landen) */
function flushPending(id: string) {
  for (const [key, p] of pending)
    if (key.endsWith(`:${id}`)) {
      clearTimeout(p.timer);
      p.run();
    }
}

/** „Heute erledigt“ sofort ergänzen (der Server liefert es beim nächsten Laden ebenfalls) */
function logDone(role: "presetter" | "closer", what: string, who: string) {
  const n = new Date();
  const time = `${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`;
  (role === "presetter" ? d().CALL_DAY.log : d().CLOSER_DAY.log).unshift({ what, who, time });
}

export function setLeadStatus(id: string, status: StatusKey | "nicht_erreicht", reason?: string, note?: string, opts: { silent?: boolean } = {}): string {
  const l = leadById(id);
  if (!l) return "";
  const attempt = status === "nicht_erreicht";
  const calling = store.ui.role === "presetter" && isCalling(l.status);
  let st: StatusKey;
  if (attempt) {
    l.attempts++;
    l.nextTry = nextTryText(l.attempts);
    st = "terminierung";
  } else {
    st = status;
    if (!isCalling(st)) l.nextTry = null;
  }
  l.status = st;
  /* beim Anrufversuch ist „reason“ nur eine Angabe wie „Mailbox“, kein Absagegrund */
  if (reason && !attempt) {
    l.reason = reason;
    l.reasonNote = note || "";
  }
  l.hist.unshift([(attempt ? `Nicht erreicht (Versuch ${l.attempts})` : STATUS[st].label) + (reason ? ` – ${reason}` : ""), nowStamp(d().NOW)]);
  if (calling) {
    d().CALL_DAY.done++;
    if (st === "aufmass") d().CALL_DAY.termine++;
    logDone("presetter", l.hist[0][0], l.kunde);
  }
  /* verloren: künftige Termine entfallen, gelaufene bleiben für die Historie */
  if (st === "verloren") {
    const keep = d().APPTS.filter((a) => a.lead !== id || apptEnd(a) <= d().NOW);
    d().APPTS.splice(0, d().APPTS.length, ...keep);
  }
  pushNotif(l.setter, `${l.kunde}: Status → ${STATUS[st].label}${reason ? ` (${reason})` : ""}`, st);
  rerender();
  flushPending(id);
  persistLead(id, { type: "status", status, reason, note, silent: opts.silent });
  return attempt ? `${l.kunde}: Versuch ${l.attempts} – nächster ${l.nextTry}` : `${l.kunde}: ${STATUS[st].label} · ${first(l.setter)} wurde benachrichtigt`;
}

/** Telefonleitfaden: zum dringendsten offenen Lead (außer fromId) weiter; liefert dessen Namen */
export function guideAdvance(fromId: string): string | null {
  const nxt = d()
    .LEADS.filter((x) => inCallPool(x, currentUser()) && isCalling(x.status) && x.id !== fromId)
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
  if (store.ui.role === "presetter") {
    d().CALL_DAY.done++;
    logDone("presetter", `Rückruf vereinbart: ${when}`, l.kunde);
  }
  l.nextTry = `Rückruf ${when}`;
  if (l.status === "eingereicht") l.status = "terminierung";
  l.hist.unshift([`Rückruf vereinbart: ${when}${note ? " – " + note : ""}`, nowStamp(d().NOW)]);
  if (note) l.preNote = [l.preNote, note].filter(Boolean).join(" · ");
  pushNotif(l.setter, `${l.kunde}: Rückruf vereinbart (${when})`, "terminierung");
  rerender();
  persistLead(id, { type: "callback", date, time, note });
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
  if (store.ui.role === "closer") {
    d().CLOSER_DAY.done++;
    logDone("closer", `Rückmeldung ${real ? kindLabel(real) : "Checks"}`, l.kunde);
  }
  if (res === "checks") {
    if (o.date) d().APPTS.push({ id: `T-${rnd()}`, lead: l.id, closer: a.closer, kind: "closing", date: o.date, start: o.hour ?? 17, dur: 1.5, ort: a.ort, feedback: null });
    /* mit eingetragenem Verkaufstermin direkt in „Verkaufstermin“, sonst „Checks“ */
    setLeadStatus(l.id, o.date ? "verkaufstermin" : "checks", undefined, undefined, { silent: true });
    l.hist[0][0] = `Aufmaßtermin fand statt – in den Checks${o.date ? `, Verkaufstermin ${fmtDay(o.date)} ${fmtHour(o.hour ?? 17)}` : ""}`;
    d().NOTIFS[l.setter][0].t = `${l.kunde}: Aufmaßtermin fand statt – Kunde ist in den Checks`;
  } else if (res === "verkauft") setLeadStatus(l.id, "verkauft", undefined, undefined, { silent: true });
  else if (res === "verloren") setLeadStatus(l.id, "verloren", o.reason, o.note, { silent: true });
  else if (res === "nicht_angetroffen") {
    /* zurück an den Presetter zum Neu-Terminieren */
    setLeadStatus(l.id, "terminierung", undefined, undefined, { silent: true });
    l.nextTry = "Neuen Termin legen";
    l.hist[0][0] = "Kunde nicht angetroffen – neuer Termin wird gelegt";
    d().NOTIFS[l.setter][0].t = `${l.kunde}: beim Aufmaßtermin nicht angetroffen – neuer Termin wird gelegt`;
    if (l.presetter) pushNotif(l.presetter, `${l.kunde}: nicht angetroffen – bitte neuen Termin legen`, "terminierung");
  } else if (res === "entscheidung") {
    if (l.status !== "verkaufstermin") setLeadStatus(l.id, "verkaufstermin", undefined, undefined, { silent: true });
    l.hist.unshift(["Verkaufstermin fand statt – Kunde entscheidet noch", nowStamp(d().NOW)]);
    pushNotif(l.setter, `${l.kunde}: Verkaufstermin fand statt – Kunde entscheidet noch`, "verkaufstermin");
  }
  if (o.note && res !== "verloren") l.hist[0][0] += ` – ${o.note}`;
  rerender();
  persist(
    () =>
      saveFeedbackAction(apptId, {
        result: res,
        note: o.note,
        reason: o.reason,
        second: res === "checks" && o.date ? { date: o.date, hour: o.hour ?? 17 } : null,
        lead: { kunde: l.kunde, ort: l.ort },
      }),
    { reload: true },
  );
  return `Rückmeldung gespeichert · ${first(l.setter)} informiert`;
}

/* ---------- Benachrichtigungen ---------- */

export function markAllNotifRead() {
  (d().NOTIFS[currentUser()] || []).forEach((n) => (n.unread = false));
  rerender();
  persist(() => markNotificationsReadAction());
}

/** Demo: Statusänderung aus Pipedrive simulieren (Setter); liefert den Kundennamen */
export function simulatePipedriveUpdate(): string | null {
  const me = currentUser();
  const cand = d().LEADS.find((l) => l.setter === me && isCalling(l.status));
  if (!cand) return null;
  cand.status = "aufmass";
  cand.hist.unshift([STATUS.aufmass.label, nowStamp(d().NOW)]);
  pushNotif(me, `${cand.kunde}: Status → ${STATUS.aufmass.label}`, "aufmass");
  rerender();
  return cand.kunde;
}

/** Antwort der Vorqualifizierung direkt am Lead speichern (Telefonleitfaden) */
export function setLeadVq(id: string, name: string, value: string | string[]) {
  const l = leadById(id);
  if (!l) return;
  (l.vq ??= {})[name] = Array.isArray(value) ? value.join(", ") : value;
  notify();
  persistLater(`vq:${id}`, id, () => ({ type: "vq", answers: { ...(l.vq ?? {}) } }));
}

export function setLeadPreNote(id: string, note: string) {
  const l = leadById(id);
  if (!l) return;
  l.preNote = note;
  persistLater(`note:${id}`, id, () => ({ type: "note", text: l.preNote }));
}

/** Aufmaßtermin in einem freien Closer-Slot buchen – als Setter nur vormerken (Presetter bestätigt). Liefert true bei Vormerkung. */
export function bookSlot(l: Lead, s: Slot): boolean {
  const i = d().SLOTS.findIndex((x) => x.id === s.id);
  if (i >= 0) d().SLOTS.splice(i, 1);
  d().APPTS.push({ id: `T-${rnd()}`, lead: l.id, closer: s.closer, kind: "erst", date: s.date, start: s.start, dur: 1.5, ort: l.ort, feedback: null });
  const reserved = store.ui.role === "setter";
  d().APPTS[d().APPTS.length - 1].reserved = reserved || undefined;
  if (!reserved) {
    l.closer = s.closer;
    setLeadStatus(l.id, "aufmass");
    if (!LIVE) pushNotif(s.closer, `Neuer Aufmaßtermin: ${l.kunde}, ${fmtDay(s.date)} ${fmtHour(s.start)} (${l.ort})`, "aufmass");
  }
  rerender();
  persist(() => bookSlotAction(s.id, { id: l.id, kunde: l.kunde, ort: l.ort }, store.ui.role), { reload: true });
  return reserved;
}

/** Personen, die als Closer gebucht werden können */
export const closerOptions = (): PersonKey[] =>
  store.live.closers ?? Object.values(d().PEOPLE).filter((p) => p.role === "closer").map((p) => p.key);

/** Aufmaßtermin direkt eintragen (ohne freien Slot) – Datum, Uhrzeit (z. B. 17.5), Closer; als Setter nur vormerken */
export function bookDirect(l: Lead, date: string, start: number, closer: PersonKey) {
  const clash = d().APPTS.some((a) => a.closer === closer && a.date === date && start < a.start + a.dur && a.start < start + 1.5);
  if (clash) return "Der Closer hat zu der Zeit schon einen Termin";
  const i = d().SLOTS.findIndex((s) => s.closer === closer && s.date === date && s.start === Math.floor(start));
  if (i >= 0) d().SLOTS.splice(i, 1);
  const reserved = store.ui.role === "setter";
  d().APPTS.push({ id: `T-${rnd()}`, lead: l.id, closer, kind: "erst", date, start, dur: 1.5, ort: l.ort, feedback: null, reserved: reserved || undefined });
  if (!reserved) {
    l.closer = closer;
    setLeadStatus(l.id, "aufmass");
    if (!LIVE) pushNotif(closer, `Neuer Aufmaßtermin: ${l.kunde}, ${fmtDay(date)} ${fmtHour(start)} (${l.ort})`, "aufmass");
  }
  rerender();
  persist(() => bookDirectAction({ id: l.id, kunde: l.kunde, ort: l.ort }, { date, start, closerId: closer }, store.ui.role), { reload: true });
  return null;
}

/** Vorgemerkten Termin bestätigen (Presetter): jetzt fest gebucht, Lead → Aufmaßtermin, Closer wird informiert */
export function confirmReservation(l: Lead, apptId: string) {
  const a = d().APPTS.find((x) => x.id === apptId);
  if (!a) return;
  a.reserved = undefined;
  l.closer = a.closer;
  setLeadStatus(l.id, "aufmass");
  rerender();
  persist(() => confirmReservationAction(apptId), { reload: true });
}

/** Vormerkung lösen: Termin entfällt, Slot wird wieder frei */
export function releaseReservation(l: Lead, apptId: string, why = "") {
  const i = d().APPTS.findIndex((x) => x.id === apptId);
  if (i < 0) return;
  const [a] = d().APPTS.splice(i, 1);
  if (a.start % 1 === 0) d().SLOTS.push({ id: `S-${rnd()}`, closer: a.closer, date: a.date, start: a.start });
  l.hist.unshift([`Vormerkung ${fmtDay(a.date)} ${fmtHour(a.start)} gelöst${why ? ` – ${why}` : ""}`, nowStamp(d().NOW)]);
  rerender();
  persist(() => releaseReservationAction(apptId, why), { reload: true });
}

/** Lead aus dem Setting-Formular anlegen (Prototyp: lokal; echt: n8n-Webhook → Pipedrive) */
export function createLead(v: FormValues, fromServer?: { leadId: string | null; dealId: number | null }): Lead {
  const s = (k: string) => String(v[k] ?? "").trim();
  const n = d().NOW;
  const tel = s("telefon").replace(/\s+/g, " ");
  const telMasked = tel.length > 8 ? `${tel.slice(0, 4)} •••• ${tel.replace(/\s/g, "").slice(-4)}` : tel;
  const rueck = [s("rueckruf_datum"), s("rueckruf_uhrzeit") && `${s("rueckruf_uhrzeit")} Uhr`].filter(Boolean).join(" ");
  const zf = (v.zeitfenster as string[] | undefined) ?? [];
  const note = [s("notizen"), s("alle_entscheider"), rueck && `Rückruf: ${rueck}`, zf.length && `Erreichbar: ${zf.join(", ")}`].filter(Boolean).join(" · ");
  const count = d().LEADS.length;
  const l: Lead = {
    /* echte Daten: Deal-ID aus n8n/Pipedrive; ohne Rückmeldung vorläufige ID bis zum nächsten Laden */
    id: fromServer ? (fromServer.leadId ?? `NEU-${rnd()}`) : `L-${2450 + count}`,
    pd: fromServer ? fromServer.dealId : 48400 + count,
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
    presetter: LIVE ? undefined : "inan" /* Prototyp: fester Presetter */,
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
  if (!LIVE) pushNotif("inan", `Neuer Lead von ${first(currentUser())}: ${l.kunde}${rueck ? " – Rückruf " + rueck : ""}`, "eingereicht");
  rerender();
  return l;
}

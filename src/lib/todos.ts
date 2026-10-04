/* To-Dos je Rolle (wie in Tims Vorlage): links was zu tun ist, rechts um wen es geht.
   group: over (überfällig) · today (heute) · later (demnächst). Reine Funktionen. */

import { closerPaused, feedbackDue, kindLabel, pendingFeedback, reservationOf } from "./appointments";
import { STATUS } from "./domain";
import { dkey, eur, fmtDay, fmtDue, fmtHour } from "./format";
import { ageH, apptStart, callbackLate, callbackStale, dueAt, isCalling, isCallback, isLost, isOverdue, leadsForUser, urgencySort } from "./leads";
import type { Appointment, Lead, MbStats, Payout, Person, PersonKey, ProvisionItem, Role, Slot } from "./types";

export type TodoGroup = "over" | "today" | "later";
export type TodoTone = "bad" | "warn" | "info" | "ok" | "good";
export type TodoAction = { kind: "view"; view: string } | { kind: "call"; id: string } | { kind: "feedback"; id: string } | { kind: "lead"; id: string } | { kind: "team"; key: PersonKey };

/** Bereiche der Admin-To-Dos (Filter) */
export const TODO_CATS: [string, string][] = [["anruf", "Terminierung"], ["closer", "Closer"], ["epp", "EPP"], ["geld", "Auszahlungen"], ["vertrag", "Verträge"], ["team", "Team"]];

export interface Todo {
  key: string;
  group: TodoGroup;
  tone: TodoTone;
  what: string;
  when?: string;
  who: string;
  where?: string;
  act: TodoAction;
  /** nur Admin-To-Dos: Bereich und betroffene Mitarbeitende (für die Filter) */
  cat?: string;
  mb?: PersonKey[];
}

/** Was passiert gerade mit dem Lead – in Klartext */
export function leadStatus(l: Lead, now: Date, appts: Appointment[], person: (k: PersonKey) => Person): { what: string; when: string; tone: TodoTone } {
  const latest = (kind?: Appointment["kind"]) =>
    appts.filter((a) => a.lead === l.id && (!kind || a.kind === kind)).sort((a, b) => apptStart(b).getTime() - apptStart(a).getTime())[0];
  const day = (i: number) => l.hist[i]?.[1].split(" ")[0] ?? "";
  if (isCalling(l.status)) {
    const r = reservationOf(appts, l.id);
    if (r) return { what: "Termin vorgemerkt", when: `${fmtDay(r.date)} ${fmtHour(r.start)} · ${person(r.closer).first} – wird noch bestätigt`, tone: "info" };
    const next = (l.nextTry || "").replace(/^Rückruf /, "");
    if (callbackStale(l, now)) return { what: "Wartet auf Anruf", when: `Rückrufwunsch ${next} ist verstrichen`, tone: "warn" };
    if (callbackLate(l, now)) return { what: "Rückruf überfällig", when: next, tone: "bad" };
    if (isCallback(l)) return { what: "Rückruf", when: next, tone: "info" };
    if (l.nextTry && l.attempts) return { what: `${l.attempts}× nicht erreicht`, when: `nächster Versuch: ${l.nextTry}`, tone: "warn" };
    if (l.nextTry) return { what: l.nextTry, when: "Kunde nicht angetroffen", tone: "warn" };
    const h = ageH(l, now);
    const age = h < 1 ? `${Math.max(1, Math.round(h * 60))} Min.` : h < 48 ? `${Math.round(h)} Std.` : `${Math.round(h / 24)} Tagen`;
    return { what: isOverdue(l, now) ? "Anruf überfällig" : "Wartet auf Anruf", when: `eingereicht vor ${age}`, tone: h < 2 ? "info" : h < 24 ? "warn" : "bad" };
  }
  if (l.status === "aufmass") {
    const a = latest("erst");
    return { what: "Aufmaßtermin", when: a ? `${fmtDay(a.date)} ${fmtHour(a.start)}${a.closer ? ` · ${person(a.closer).first}` : ""}` : "wird geplant", tone: "ok" };
  }
  if (l.status === "checks") return { what: "In den Checks", when: `seit ${day(0)}`, tone: "info" };
  if (l.status === "verkaufstermin") {
    const c = latest("closing");
    return { what: "Verkaufstermin", when: c ? `${fmtDay(c.date)} ${fmtHour(c.start)}` : "wird geplant", tone: "ok" };
  }
  if (l.status === "verkauft") return { what: "Verkauft", when: `am ${day(0)}`, tone: "good" };
  if (l.status === "ausgezahlt") return { what: "Ausgezahlt", when: `am ${day(0)}`, tone: "good" };
  return { what: STATUS[l.status].label, when: l.reason || "", tone: "bad" };
}

export interface TodoInput {
  role: Role;
  me: PersonKey;
  now: Date;
  leads: Lead[];
  appts: Appointment[];
  slots: Slot[];
  person: (k: PersonKey) => Person;
  /** offene Verträge der Person */
  openContracts: number;
  /** Leads heute (Setter) und Tagesziel */
  leadsToday?: number;
  dayGoal?: number;
  /** nur Admin: alles, was für die Handlungsliste gebraucht wird */
  admin?: {
    payouts: Record<PersonKey, Payout[]>;
    provisions: ProvisionItem[];
    mbStats: MbStats[];
    contracts: { openAll: number; questions: number } | null;
    /** Personen mit Closer-Rolle */
    closers: PersonKey[];
  };
}

const ORDER: Record<TodoGroup, number> = { over: 0, today: 1, later: 2 };

export function todoItems(x: TodoInput): Todo[] {
  const { role, me, now, appts, person } = x;
  const today = dkey(now);
  const T: Todo[] = [];
  if (x.openContracts)
    T.push({
      key: "vertrag",
      group: "today",
      tone: "info",
      what: x.openContracts === 1 ? "Vertrag unterschreiben" : `${x.openContracts} Verträge unterschreiben`,
      when: "bitte prüfen und unterschreiben",
      who: "Verträge",
      act: { kind: "view", view: "vertraege" },
    });

  if (role === "setter" && x.dayGoal && (x.leadsToday ?? 0) < x.dayGoal) {
    const rest = x.dayGoal - (x.leadsToday ?? 0);
    T.unshift({
      key: "tagesziel",
      group: "today",
      tone: "warn",
      what: `Noch ${rest} ${rest === 1 ? "Lead" : "Leads"}`,
      when: "bis zum Tagesziel",
      who: "Lead erfassen",
      where: `${x.leadsToday ?? 0} von ${x.dayGoal} heute`,
      act: { kind: "view", view: "erfassen" },
    });
  }

  if (role === "presetter") {
    /* A20: nach der Terminbestätigung Kunde im EPP anlegen, an den Closer übertragen, EPP-ID eintragen – rot ab 24 Std. vor dem Termin */
    for (const l of eppMissing(x.leads, appts, me)) {
      const a = appts.filter((y) => y.lead === l.id && y.kind === "erst" && !y.reserved).sort((p, q) => apptStart(q).getTime() - apptStart(p).getTime())[0];
      const h = a ? (apptStart(a).getTime() - now.getTime()) / 36e5 : 0;
      T.push({
        key: `epp-${l.id}`,
        group: h < 24 ? "over" : "today",
        tone: h < 24 ? "bad" : "warn",
        what: "Im EPP anlegen",
        when: a ? `und an ${person(a.closer).first} übertragen · Termin ${fmtDay(a.date)} ${fmtHour(a.start)}` : "und an den Closer übertragen",
        who: l.kunde,
        where: l.ort,
        act: { kind: "lead", id: l.id },
      });
    }
    const mine = leadsForUser(x.leads, role, me).filter((l) => isCalling(l.status));
    for (const l of mine.sort(urgencySort(now))) {
      /* vom Setter vorgemerkt: anrufen, qualifizieren, bestätigen – ab 48 Std. vorher rot (24 Std. vorher wird er freigegeben) */
      const r = reservationOf(appts, l.id);
      if (r) {
        const h = (apptStart(r).getTime() - now.getTime()) / 36e5;
        T.push({
          key: l.id,
          group: h < 48 ? "over" : "today",
          tone: h < 48 ? "bad" : "warn",
          what: "Vorgemerkten Termin bestätigen",
          when: `${fmtDay(r.date)} ${fmtHour(r.start)} · ${person(r.closer).first} · vorgemerkt von ${person(l.setter).first}`,
          who: l.kunde,
          where: l.ort,
          act: { kind: "call", id: l.id },
        });
        continue;
      }
      const st = leadStatus(l, now, appts, person);
      const due = dueAt(l, now);
      const group: TodoGroup = st.tone === "bad" ? "over" : !due || dkey(due) <= today || callbackStale(l, now) ? "today" : "later";
      T.push({ key: l.id, group, tone: st.tone === "ok" ? "info" : st.tone, what: st.what, when: st.when, who: l.kunde, where: l.ort, act: { kind: "call", id: l.id } });
    }
  }

  if (role === "closer") {
    for (const a of pendingFeedback(appts, me, now).sort((p, q) => feedbackDue(p).getTime() - feedbackDue(q).getTime())) {
      const d = feedbackDue(a),
        h = (d.getTime() - now.getTime()) / 36e5;
      const l = x.leads.find((y) => y.id === a.lead);
      T.push({
        key: a.id,
        group: h < 0 ? "over" : dkey(d) === today ? "today" : "later",
        tone: h < 6 ? "bad" : "warn",
        what: h < 0 ? "Rückmeldung überfällig" : "Rückmeldung geben",
        when: `bis ${fmtDue(d, now)}`,
        who: l?.kunde ?? "Kunde",
        where: `${kindLabel(a)} · ${fmtDay(a.date)}`,
        act: { kind: "feedback", id: a.id },
      });
    }
    for (const l of x.leads.filter(
      (y) => y.closer === me && ["checks", "verkaufstermin"].includes(y.status) && !isLost(y) && !appts.some((a) => a.lead === y.id && a.kind === "closing" && !a.feedback),
    ))
      T.push({ key: `lead-${l.id}`, group: "later", tone: "info", what: "Ergebnis eintragen", when: `${STATUS[l.status].label} seit ${l.hist[0]?.[1].split(" ")[0] ?? ""}`, who: l.kunde, where: l.ort, act: { kind: "feedback", id: `LEAD:${l.id}` } });
    /* freie Slots in der kommenden Kalenderwoche (Mo–So) */
    const mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() + ((8 - now.getDay()) % 7 || 7)),
      sun = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6);
    const nw = x.slots.filter((s) => s.closer === me && s.date >= dkey(mon) && s.date <= dkey(sun)).length;
    if (nw < 4)
      T.push({ key: "slots", group: "today", tone: "warn", what: "Slots eintragen", when: `erst ${nw} von 4`, who: "Nächste Woche", where: `${fmtDay(dkey(mon))} – ${fmtDay(dkey(sun))}`, act: { kind: "view", view: "kalender" } });
    for (const a of appts.filter((y) => y.closer === me && !y.reserved && apptStart(y) > now).sort((p, q) => apptStart(p).getTime() - apptStart(q).getTime())) {
      const l = x.leads.find((y) => y.id === a.lead);
      T.push({ key: `t-${a.id}`, group: a.date === today ? "today" : "later", tone: "ok", what: kindLabel(a), when: `${fmtDay(a.date)} ${fmtHour(a.start)}`, who: l?.kunde ?? "Kunde", where: a.ort, act: { kind: "view", view: "termine" } });
    }
  }
  if (role === "admin" && x.admin) T.push(...adminTodos(x, x.admin));
  return T.sort((a, b) => ORDER[a.group] - ORDER[b.group]);
}

/** Admin: alles, wo er eingreifen muss – gleiche Zeilen wie bei den MBs (links was, rechts um wen es geht), Filter nach Bereich und Person */
function adminTodos(x: TodoInput, A: NonNullable<TodoInput["admin"]>): Todo[] {
  const { now, appts, person } = x;
  const T: Todo[] = [];
  const add = (type: string, ref: string, t: Omit<Todo, "key" | "mb"> & { mb?: (PersonKey | null | undefined)[] }) =>
    T.push({ ...t, key: `${type}:${ref}`, mb: (t.mb ?? []).filter((k): k is PersonKey => !!k) });
  const presName = (l: Lead) => (l.presetter ? person(l.presetter).first : "kein Presetter");

  for (const k of A.closers)
    for (const a of pendingFeedback(appts, k, now)) {
      const l = x.leads.find((y) => y.id === a.lead),
        paused = closerPaused(appts, k, now);
      add(paused ? "k_pause" : "k_fb", a.id, {
        group: paused ? "over" : "today",
        tone: paused ? "bad" : "warn",
        what: paused ? `${person(k).first} pausiert – Rückmeldung fehlt` : `Rückmeldung offen · ${person(k).first}`,
        when: `${kindLabel(a)} am ${fmtDay(a.date)}${paused ? " · Slots gesperrt" : ""}`,
        who: l?.kunde ?? "Kunde",
        where: l?.ort,
        cat: "closer",
        mb: [k],
        act: { kind: "team", key: k },
      });
    }

  for (const l of x.leads.filter((y) => isCalling(y.status))) {
    const r = reservationOf(appts, l.id);
    if (isOverdue(l, now) || callbackLate(l, now)) {
      const st = leadStatus(l, now, appts, person);
      add(callbackLate(l, now) ? "k_rr" : "k_erst", l.id, { group: "over", tone: "bad", what: `${st.what} · ${presName(l)}`, when: st.when, who: l.kunde, where: l.ort, cat: "anruf", mb: [l.presetter], act: { kind: "lead", id: l.id } });
    } else if (r)
      add("k_vorgemerkt", l.id, { group: "today", tone: "warn", what: `Vorgemerkt, noch nicht bestätigt · ${presName(l)}`, when: `Termin ${fmtDay(r.date)} ${fmtHour(r.start)}`, who: l.kunde, where: l.ort, cat: "anruf", mb: [l.presetter, l.setter], act: { kind: "lead", id: l.id } });
    if (l.attempts >= 5)
      add("k_5plus", l.id, { group: "today", tone: "warn", what: "5× nicht erreicht", when: "absagen oder weiter versuchen?", who: l.kunde, where: l.ort, cat: "anruf", mb: [l.presetter], act: { kind: "lead", id: l.id } });
  }

  for (const l of eppMissing(x.leads, appts)) {
    const a = appts.filter((y) => y.lead === l.id && y.kind === "erst" && !y.reserved).sort((p, q) => apptStart(q).getTime() - apptStart(p).getTime())[0];
    const h = a ? (apptStart(a).getTime() - now.getTime()) / 36e5 : 99;
    add("k_eppid", l.id, {
      group: h < 24 ? "over" : "today",
      tone: h < 24 ? "bad" : "warn",
      what: `Noch nicht im EPP · ${presName(l)}`,
      when: `Termin bestätigt – anlegen + an ${l.closer ? person(l.closer).first : "Closer"} übertragen`,
      who: l.kunde,
      where: l.ort,
      cat: "epp",
      mb: [l.presetter],
      act: { kind: "lead", id: l.id },
    });
  }

  /* freie Slots in der kommenden Kalenderwoche (Mo–So) */
  const mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() + ((8 - now.getDay()) % 7 || 7)),
    sun = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6);
  for (const k of A.closers) {
    const n = x.slots.filter((s) => s.closer === k && s.date >= dkey(mon) && s.date <= dkey(sun)).length;
    if (n < 4) add("k_slots", k, { group: "today", tone: "warn", what: "Zu wenige freie Slots", when: `${n} von 4 für nächste Woche`, who: person(k).first, where: `Closer · ${fmtDay(dkey(mon))} – ${fmtDay(dkey(sun))}`, cat: "closer", mb: [k], act: { kind: "team", key: k } });
  }

  for (const [k, ps] of Object.entries(A.payouts))
    for (const p of ps) {
      if (p.status === "ausgezahlt") continue;
      if (p.hinweis) add("k_iban", p.id, { group: "today", tone: "warn", what: "Auszahlung gehalten", when: p.hinweis, who: person(k).first, where: `${eur(p.betrag)} · ${p.periode}`, cat: "geld", mb: [k], act: { kind: "view", view: "auszahlungen" } });
      else if (p.status === "pruefung")
        add("frei", p.id, { group: "later", tone: "info", what: "Abrechnung freigeben", when: `Auszahlung am ${p.datum}`, who: person(k).first, where: eur(p.betrag), cat: "geld", mb: [k], act: { kind: "view", view: "auszahlungen" } });
    }
  for (const q of A.provisions.filter((y) => y.frage && !y.antwort))
    add("frage", q.id, { group: "today", tone: "warn", what: "Rückfrage zur Auszahlung", when: q.frage ?? "", who: person(q.user).first, where: `${q.kunde} · ${eur(q.betrag)}`, cat: "geld", mb: [q.user], act: { kind: "view", view: "auszahlungen" } });

  if (A.contracts?.questions)
    add("q_vertrag", "alle", { group: "today", tone: "warn", what: `${A.contracts.questions} ${A.contracts.questions === 1 ? "Rückfrage" : "Rückfragen"} zu Verträgen`, when: "unter Verträge beantworten", who: "Verträge", cat: "vertrag", act: { kind: "view", view: "vertraege" } });
  if (A.contracts?.openAll)
    add("k_vertrag", "alle", { group: "later", tone: "info", what: `${A.contracts.openAll} ${A.contracts.openAll === 1 ? "Vertrag" : "Verträge"} nicht unterschrieben`, when: "Erinnerung kommt nach 7 Tagen automatisch", who: "Verträge", cat: "vertrag", act: { kind: "view", view: "vertraege" } });

  for (const m of A.mbStats.filter((y) => y.days >= 3))
    add("k_inaktiv", m.key, { group: "later", tone: m.days >= 5 ? "bad" : "warn", what: `Seit ${m.days} Tagen kein Lead`, when: `letzter am ${m.last}`, who: person(m.key).first, where: "Setter", cat: "team", mb: [m.key], act: { kind: "team", key: m.key } });
  return T;
}

/** Leads mit Aufmaßtermin, aber noch ohne EPP-ID (presetter = nur die eigenen) */
export function eppMissing(leads: Lead[], appts: Appointment[], presetter?: PersonKey) {
  return leads.filter(
    (l) => l.status === "aufmass" && !l.eppId && (!presetter || l.presetter === presetter) && appts.some((a) => a.lead === l.id && a.kind === "erst" && !a.reserved),
  );
}

/** Zähler fürs Menü: alles, was überfällig oder heute dran ist (Termine zählen nicht) */
export const openTodoCount = (t: Todo[]) => t.filter((x) => x.group !== "later" && x.tone !== "ok").length;

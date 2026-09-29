/* Gemeinsamer Zustand für React-Ansichten und die Übergangsschicht (src/legacy).
   Beide lesen und ändern dieselben Objekte; nach jeder Änderung ruft die
   Übergangsschicht render() auf, das wiederum notify() auslöst und damit die
   React-Ansichten neu zeichnet. Sobald die Übergangsschicht entfällt, wird das
   hier durch echten Anwendungszustand (Login, Datenabfragen) ersetzt. */

import { useSyncExternalStore } from "react";
import { createDemoData } from "./demo-data";
import type { LeadStats } from "./stats";
import type { FormValues } from "./vq";
import type { AdminKpi, Lead, MbStats, PersonKey, Role } from "./types";

/* ---------- Assistent „Lead erfassen“ ---------- */
export type WizardStep = 1 | "created" | 2 | "ko" | 3 | "done";
export interface WizardState {
  step: WizardStep;
  leadId: string | null;
  data: FormValues;
  vq: FormValues;
  errors: Record<string, string>;
  slot: string | null;
  vqSent: boolean;
  phone: boolean;
}
export const newWizard = (): WizardState => ({
  step: 1,
  leadId: null,
  data: { thema: ["Wärmepumpe"], zeitfenster: [] },
  vq: {},
  errors: {},
  slot: null,
  vqSent: false,
  phone: false,
});

export type LeadFilter = "alle" | "eingereicht" | "termin" | "checks" | "verkauft" | "ausgezahlt" | "verloren";

export interface UiState {
  role: Role;
  view: string;
  leadFilter: LeadFilter;
  leadSearch: string;
  leadSetter: PersonKey | "alle";
  leadView: "board" | "list";
  /** Telefonleitfaden: aktueller Lead und gewählter Slot (teilt die Übergangsschicht) */
  guideLead: string | null;
  guideSlot: string | null;
}

/** Funktionen der Übergangsschicht, die React-Ansichten aufrufen dürfen. */
export interface LegacyBridge {
  /** Shell und alte Ansichten neu zeichnen (löst auch notify() aus) */
  render: () => void;
  /** Lead-Details im Drawer öffnen */
  openLead: (id: string) => void;
  /** Kurzmeldung unten einblenden */
  toast: (msg: string, icon?: string) => void;
  /** Lead-Status setzen (inkl. Verlauf, Benachrichtigung des Setters) */
  setStatus: (id: string, status: string, silent?: boolean, reason?: string, note?: string) => void;
  /** Aktion der Übergangsschicht auslösen (wie ein Klick auf data-act), z. B. act("feedback", { id }) */
  act: (name: string, data?: Record<string, string>) => void;
}

export const store = {
  data: createDemoData(),
  ui: {
    role: "setter",
    view: "uebersicht",
    leadFilter: "alle",
    leadSearch: "",
    leadSetter: "alle",
    leadView: "board",
    guideLead: null,
    guideSlot: null,
  } as UiState,
  /** Zwischenstand „Lead erfassen“ – bleibt beim Wechsel der Ansicht erhalten */
  wiz: newWizard(),
  legacy: null as LegacyBridge | null,
  /** Angemeldete Person (aus der Sitzung) */
  session: null as { name: string; role: Role } | null,
};

/** Ansichten, die bereits als React-Komponente umgesetzt sind. */
export const REACT_VIEWS = new Set(["leads", "uebersicht", "team", "stammdaten", "events", "vertraege", "auszahlungen", "rangliste", "neu", "kalender", "termine", "leitfaden", "erfassen"]);

let version = 0;
const listeners = new Set<() => void>();

export function notify() {
  version++;
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Aktueller Benutzer (Prototyp: fester Beispielbenutzer je Rolle). */
export const currentUser = () => store.data.ROLE_USER[store.ui.role];

/** Alles neu zeichnen (Shell der Übergangsschicht und React-Ansichten). */
export function rerender() {
  if (store.legacy) store.legacy.render();
  else notify();
}

/** UI-Zustand ändern und alles neu zeichnen. */
export function updateUi(patch: Partial<UiState>) {
  Object.assign(store.ui, patch);
  rerender();
}

/* ---------- Aktionen: Daten nur über diese Funktionen ändern ---------- */

/** Monatsziel Verdienst einer Person setzen. */
export function setMoneyGoal(user: PersonKey, euro: number) {
  store.data.MONEY_GOAL[user] = euro;
  rerender();
}

/** Array-Inhalt ersetzen, ohne das Array selbst auszutauschen (Übergangsschicht hält Referenzen). */
const replaceAll = <T,>(arr: T[], items: T[]) => arr.splice(0, arr.length, ...items);

/** Live-Leads (z. B. aus Pipedrive, bereits serverseitig gefiltert) übernehmen. */
export function applyLiveLeads(leads: Lead[], userKey: string) {
  const d = store.data;
  replaceAll(d.LEADS, leads);
  d.APPTS.splice(0);
  /* Echte Daten → echtes Datum statt der festen Prototyp-Zeit */
  d.NOW.setTime(Date.now());
  /* Setter aus Pipedrive als Personen bekannt machen (Anzeige „von Florian“) */
  for (const k of new Set(leads.map((l) => l.setter))) {
    if (!d.PEOPLE[k]) {
      const first = k === "unbekannt" ? "ohne Setter" : k.replace(/(^|\s)\S/g, (c) => c.toUpperCase());
      d.PEOPLE[k] = { key: k, name: first, first, role: "setter", initials: first.slice(0, 2).toUpperCase() };
    }
  }
  /* Die eigene Rolle zeigt die eigenen Leads (Admins, die in eine andere Rolle schauen, weiter Beispielpersonen) */
  if (store.session && store.session.role !== "admin") d.ROLE_USER[store.session.role] = userKey;
  rerender();
}

/** Live-Kennzahlen übernehmen – nur die Teile, die der Server für diese Rolle mitschickt. */
export function applyLiveStats(s: {
  monat: string;
  monatsende: string;
  adminKpi?: AdminKpi;
  mbStats?: MbStats[];
  weekly?: LeadStats["weekly"];
  lossStats?: LeadStats["lossStats"];
  bench?: LeadStats["bench"];
  setterBoardRows?: [PersonKey, number][];
  dayGoal?: LeadStats["dayGoal"][string];
}) {
  const d = store.data;
  if (s.adminKpi) Object.assign(d.ADMIN_KPI, s.adminKpi);
  if (s.mbStats) replaceAll(d.MB_STATS, s.mbStats);
  if (s.weekly) replaceAll(d.WEEKLY, s.weekly);
  if (s.lossStats) replaceAll(d.LOSS_STATS, s.lossStats);
  if (s.bench) Object.assign(d.BENCH, s.bench);
  if (s.setterBoardRows) {
    replaceAll(d.SETTER_BOARD.rows, s.setterBoardRows);
    Object.assign(d.SETTER_BOARD, { title: `Setter-Rangliste ${s.monat} ${d.NOW.getFullYear()}`, ends: s.monatsende, published: "laufend aus Pipedrive", by: "System" });
  }
  if (s.dayGoal) {
    replaceAll(d.DAY_GOAL.week, s.dayGoal.week);
    d.DAY_GOAL.streak = s.dayGoal.streak;
  }
  rerender();
}

/** Abonniert den Store; die Komponente wird bei jeder Änderung neu gerendert. */
export function useStore() {
  useSyncExternalStore(subscribe, () => version, () => 0);
  return store;
}

/** Assistent „Lead erfassen“ ändern (nur React-Ansicht neu zeichnen – Fokus in Feldern bleibt). */
export function setWizard(patch: Partial<WizardState> | ((w: WizardState) => Partial<WizardState>)) {
  Object.assign(store.wiz, typeof patch === "function" ? patch(store.wiz) : patch);
  notify();
}

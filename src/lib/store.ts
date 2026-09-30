/* Zustand des Dashboards im Browser: Daten (Beispieldaten bzw. Live-Daten aus
   Pipedrive), Ansicht/Filter, Assistent, offene Seitenleisten und Kurzmeldungen.
   Geändert wird nur über Aktionen (src/lib/actions.ts, src/lib/ui.ts), die danach
   notify() aufrufen – alle Komponenten mit useStore() zeichnen sich neu. */

import { useSyncExternalStore } from "react";
import { createDemoData } from "./demo-data";
import type { LeadStats } from "./stats";
import type { FormValues } from "./vq";
import type { IconName } from "./icons";
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
  /** Telefonleitfaden: aktueller Lead und gewählter Slot */
  guideLead: string | null;
  guideSlot: string | null;
}

/** Seitenleiste (Drawer) rechts bzw. unten auf dem Handy */
export type Drawer =
  | { kind: "lead"; id: string }
  | { kind: "reason"; id: string; status: "abgesagt" | "verloren" }
  | { kind: "callback"; id: string }
  /** id = Termin-ID oder „LEAD:<lead-id>“ für Leads in den Checks ohne 2. Termin */
  | { kind: "feedback"; id: string }
  | { kind: "appt"; id: string }
  | { kind: "team"; key: PersonKey };

export interface Toast {
  id: number;
  msg: string;
  icon: IconName;
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
  /** Offene Overlays: Seitenleiste, „Mehr“-Menü (Handy), Benachrichtigungen */
  /* drawer bleibt nach dem Schließen gesetzt, damit der Inhalt beim Herausgleiten sichtbar bleibt */
  overlay: { drawer: null as Drawer | null, drawerOpen: false, more: false, notif: false },
  toasts: [] as Toast[],
  /** Zähler aus der Datenbank (null = noch nicht geladen) */
  live: { contracts: null as { openMine: number; openAll: number; questions: number } | null },
  /** Angemeldete Person (aus der Sitzung) */
  session: null as { name: string; roles: Role[] } | null,
};

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

/** Alles neu zeichnen. */
export const rerender = notify;

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

/** Array-Inhalt ersetzen, ohne das Array selbst auszutauschen (Komponenten halten Referenzen). */
const replaceAll = <T,>(arr: T[], items: T[]) => arr.splice(0, arr.length, ...items);

/** Live-Leads (z. B. aus Pipedrive, bereits serverseitig gefiltert) übernehmen. */
export function applyLiveLeads(leads: Lead[], keys: Partial<Record<Role, string>>) {
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
  /* Eigene Rollen zeigen die eigenen Leads (fremde Rollen bei Admins weiter die Beispielperson) */
  for (const r of store.session?.roles ?? []) if (keys[r]) d.ROLE_USER[r] = keys[r]!;
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

/* Gemeinsamer Zustand für React-Ansichten und die Übergangsschicht (src/legacy).
   Beide lesen und ändern dieselben Objekte; nach jeder Änderung ruft die
   Übergangsschicht render() auf, das wiederum notify() auslöst und damit die
   React-Ansichten neu zeichnet. Sobald die Übergangsschicht entfällt, wird das
   hier durch echten Anwendungszustand (Login, Datenabfragen) ersetzt. */

import { useSyncExternalStore } from "react";
import { createDemoData } from "./demo-data";
import type { PersonKey, Role } from "./types";

export type LeadFilter = "alle" | "eingereicht" | "termin" | "checks" | "verkauft" | "ausgezahlt" | "verloren";

export interface UiState {
  role: Role;
  view: string;
  leadFilter: LeadFilter;
  leadSearch: string;
  leadSetter: PersonKey | "alle";
  leadView: "board" | "list";
}

/** Funktionen der Übergangsschicht, die React-Ansichten aufrufen dürfen. */
export interface LegacyBridge {
  /** Shell und alte Ansichten neu zeichnen (löst auch notify() aus) */
  render: () => void;
  /** Lead-Details im Drawer öffnen */
  openLead: (id: string) => void;
  /** Kurzmeldung unten einblenden */
  toast: (msg: string, icon?: string) => void;
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
  } as UiState,
  legacy: null as LegacyBridge | null,
};

/** Ansichten, die bereits als React-Komponente umgesetzt sind. */
export const REACT_VIEWS = new Set(["leads", "uebersicht"]);

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
function rerender() {
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

/** Abonniert den Store; die Komponente wird bei jeder Änderung neu gerendert. */
export function useStore() {
  useSyncExternalStore(subscribe, () => version, () => 0);
  return store;
}

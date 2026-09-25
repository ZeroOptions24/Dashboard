"use client";

import { currentUser, useStore } from "./store";
import type { Person, PersonKey } from "./types";

/** Alles, was eine Ansicht typischerweise braucht: Daten, Rolle, aktueller Benutzer, Aktionen. */
export function useDashboard() {
  const store = useStore();
  const { data, ui } = store;
  const me = currentUser();
  const person = (k: PersonKey): Person => data.PEOPLE[k] || { key: k, name: k, first: k, role: "setter", initials: "?" };
  const act = (name: string, payload?: Record<string, string>) => store.legacy?.act(name, payload);
  return {
    data,
    ui,
    role: ui.role,
    /** Vorname für die Begrüßung: die angemeldete Person – schaut ein Admin in eine
     *  andere Rolle hinein, die Beispielperson dieser Rolle */
    firstName: store.session?.role === ui.role ? store.session.name.split(" ")[0] : person(me).first,
    me,
    now: data.NOW,
    person,
    act,
    /** zu einer anderen Ansicht wechseln */
    go: (view: string) => act("nav", { view }),
    openLead: (id: string) => store.legacy?.openLead(id),
    toast: (msg: string, icon?: string) => store.legacy?.toast(msg, icon),
    render: () => store.legacy?.render(),
  };
}

export type DashboardCtx = ReturnType<typeof useDashboard>;

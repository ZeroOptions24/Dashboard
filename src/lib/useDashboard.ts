"use client";

import { currentUser, notify, useStore } from "./store";
import { go, openLead, toast } from "./ui";
import type { Person, PersonKey } from "./types";

/** Alles, was eine Ansicht typischerweise braucht: Daten, Rolle, aktueller Benutzer, Aktionen. */
export function useDashboard() {
  const store = useStore();
  const { data, ui } = store;
  const me = currentUser();
  const person = (k: PersonKey): Person => data.PEOPLE[k] || { key: k, name: k, first: k, role: "setter", initials: "?" };
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
    /** zu einer anderen Ansicht wechseln */
    go,
    openLead,
    toast,
    render: notify,
  };
}

export type DashboardCtx = ReturnType<typeof useDashboard>;

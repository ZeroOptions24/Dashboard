/* Navigation je Rolle: [Ansicht, Beschriftung, Icon] – Reihenfolge wie im Prototyp.
   Auf dem Handy erscheinen die ersten vier (mit To-Dos fünf) unten, der Rest unter „Mehr“. */

import type { IconName } from "./icons";
import type { Role } from "./types";

export type NavItem = [view: string, label: string, icon: IconName];

export const NAV: Record<Role, NavItem[]> = {
  setter: [
    ["uebersicht", "Übersicht", "home"],
    ["erfassen", "Lead erfassen", "plus"],
    ["leads", "Pipeline", "list"],
    ["rangliste", "Rangliste", "trophy"],
    ["todos", "To-Dos", "todo"],
    ["auszahlungen", "Auszahlungen", "euro"],
    ["vertraege", "Verträge", "doc"],
    ["events", "Events", "flag"],
    ["stammdaten", "Stammdaten", "user"],
    ["akademie", "Akademie", "grad"],
    ["neu", "Weitere Funktion", "plus"],
  ],
  presetter: [
    ["uebersicht", "Übersicht", "home"],
    ["leitfaden", "Leitfaden", "phone"],
    ["leads", "Pipeline", "list"],
    ["rangliste", "Rangliste", "trophy"],
    ["todos", "To-Dos", "todo"],
    ["auszahlungen", "Auszahlungen", "euro"],
    ["vertraege", "Verträge", "doc"],
    ["events", "Events", "flag"],
    ["stammdaten", "Stammdaten", "user"],
    ["akademie", "Akademie", "grad"],
    ["neu", "Weitere Funktion", "plus"],
  ],
  closer: [
    ["uebersicht", "Übersicht", "home"],
    ["kalender", "Kalender", "cal"],
    ["termine", "Termine", "clock"],
    ["rangliste", "Rangliste", "trophy"],
    ["todos", "To-Dos", "todo"],
    ["auszahlungen", "Auszahlungen", "euro"],
    ["vertraege", "Verträge", "doc"],
    ["events", "Events", "flag"],
    ["stammdaten", "Stammdaten", "user"],
    ["akademie", "Akademie", "grad"],
    ["neu", "Weitere Funktion", "plus"],
  ],
  admin: [
    ["uebersicht", "Übersicht", "home"],
    ["todos", "To-Dos", "todo"],
    ["team", "Team & Setter", "team"],
    ["akademie", "Akademie", "grad"],
    ["leads", "Pipeline", "list"],
    ["rangliste", "Ranglisten", "trophy"],
    ["events", "Events", "flag"],
    ["vertraege", "Verträge", "doc"],
    ["auszahlungen", "Auszahlungen", "euro"],
    ["stammdaten", "Mein Konto", "user"],
    ["neu", "Weitere Funktion", "plus"],
  ],
};

export const ROLE_LABEL: Record<Role, string> = { setter: "Setter", presetter: "Presetter", closer: "Closer", admin: "Admin" };

/** Kurzbeschriftung in der unteren Leiste (Handy) */
export const SHORT_LABEL: Record<string, string> = { "Team & Setter": "Team", "Lead erfassen": "Erfassen" };

/** Gesperrte Rolle (Akademie-Test noch nicht bestanden): nur Akademie, Verträge, Events und Stammdaten */
const LOCKED_VIEWS = ["akademie", "vertraege", "events", "stammdaten"];

/** Navigation für eine Rolle; locked = Rollen, deren Ansicht noch gesperrt ist */
export const navFor = (role: Role, locked: readonly Role[] = []): NavItem[] =>
  locked.includes(role) ? LOCKED_VIEWS.map((v) => NAV[role].find((i) => i[0] === v)).filter((i): i is NavItem => !!i) : NAV[role];

/** Gibt es die Ansicht für diese Rolle? Sonst Übersicht (bei gesperrter Rolle: Akademie). */
export const allowedView = (role: Role, view: string, locked: readonly Role[] = []) =>
  navFor(role, locked).some((i) => i[0] === view) ? view : locked.includes(role) ? "akademie" : "uebersicht";

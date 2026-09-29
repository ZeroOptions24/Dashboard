/* Navigation je Rolle: [Ansicht, Beschriftung, Icon] – Reihenfolge wie im Prototyp.
   Auf dem Handy erscheinen die ersten vier unten, der Rest unter „Mehr“. */

import type { IconName } from "./icons";
import type { Role } from "./types";

export type NavItem = [view: string, label: string, icon: IconName];

export const NAV: Record<Role, NavItem[]> = {
  setter: [
    ["uebersicht", "Übersicht", "home"],
    ["erfassen", "Lead erfassen", "plus"],
    ["leads", "Pipeline", "list"],
    ["rangliste", "Rangliste", "trophy"],
    ["auszahlungen", "Auszahlungen", "euro"],
    ["vertraege", "Verträge", "doc"],
    ["events", "Events", "flag"],
    ["stammdaten", "Stammdaten", "user"],
    ["neu", "Weitere Funktion", "plus"],
  ],
  presetter: [
    ["uebersicht", "Übersicht", "home"],
    ["leitfaden", "Leitfaden", "phone"],
    ["leads", "Pipeline", "list"],
    ["auszahlungen", "Auszahlungen", "euro"],
    ["vertraege", "Verträge", "doc"],
    ["events", "Events", "flag"],
    ["stammdaten", "Stammdaten", "user"],
    ["neu", "Weitere Funktion", "plus"],
  ],
  closer: [
    ["uebersicht", "Übersicht", "home"],
    ["kalender", "Kalender", "cal"],
    ["termine", "Termine", "clock"],
    ["auszahlungen", "Auszahlungen", "euro"],
    ["vertraege", "Verträge", "doc"],
    ["events", "Events", "flag"],
    ["rangliste", "Rangliste", "trophy"],
    ["stammdaten", "Stammdaten", "user"],
    ["neu", "Weitere Funktion", "plus"],
  ],
  admin: [
    ["uebersicht", "Übersicht", "home"],
    ["team", "Team & Setter", "team"],
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

/** Gibt es die Ansicht für diese Rolle? Sonst Übersicht. */
export const allowedView = (role: Role, view: string) => (NAV[role].some((i) => i[0] === view) ? view : "uebersicht");

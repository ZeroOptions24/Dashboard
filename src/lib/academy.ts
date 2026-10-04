/* Akademie – Typen und Hilfen, die im Browser und auf dem Server gebraucht werden. */

import { moduleOpen, pathFor, type MaRole } from "./academy-content";

export interface RoleState {
  role: MaRole;
  status: "offen" | "bestanden" | "nicht_bestanden";
  via: "test" | "bestand" | "admin" | null;
  score: number | null;
  total: number | null;
  tries: number;
  retry: boolean;
  date: string | null;
}
export interface AcademyPerson {
  id: string;
  name: string;
  roles: MaRole[];
  done: string[];
  states: Partial<Record<MaRole, RoleState>>;
}
export interface AcademyData {
  lockOn: boolean;
  /** Rollen dieser Person (ohne Admin) mit Stand */
  roles: RoleState[];
  done: string[];
  /** Video-Links je Modul (vom Admin gepflegt) */
  videos: Record<string, string>;
  /** nur für Admins */
  team?: AcademyPerson[];
}

/** YouTube-Link → Einbettungs-Adresse (ohne Cookies) oder "" */
export function youtubeEmbed(url: string | null | undefined) {
  const m = String(url ?? "").match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/);
  return m ? `https://www.youtube-nocookie.com/embed/${m[1]}` : "";
}

/** Alle Module der Rolle erledigt? Dann ist der Test frei. */
export const pathDone = (role: MaRole, done: ReadonlySet<string>) => pathFor(role).every((m) => done.has(m.id));
/** Darf der Test jetzt gemacht werden? (Pfad durch und noch offen bzw. Wiederholung freigegeben) */
export const canTakeTest = (s: RoleState, done: ReadonlySet<string>) => pathDone(s.role, done) && (s.status === "offen" || (s.status === "nicht_bestanden" && s.retry));
export { moduleOpen };

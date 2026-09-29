/* Rollen einer Person. Eine Person kann mehrere haben (z. B. Setter, Presetter
   und Closer); gespeichert als kommagetrennte Liste im Feld user.role
   (so erwartet es auch Better Auth). Admins dürfen alle Rollen ansehen. */

import type { Role } from "./types";

export const ALL_ROLES: Role[] = ["setter", "presetter", "closer", "admin"];
export const MA_ROLES: Exclude<Role, "admin">[] = ["setter", "presetter", "closer"];

export const ROLE_NAMES: Record<Role, string> = { setter: "Setter", presetter: "Presetter", closer: "Closer", admin: "Admin" };

/** „admin,setter“ → ["setter", "admin"] (feste Reihenfolge, nur gültige Rollen) */
export function parseRoles(value: string | null | undefined): Role[] {
  const set = new Set(String(value ?? "").split(",").map((r) => r.trim().toLowerCase()));
  const roles = ALL_ROLES.filter((r) => set.has(r));
  return roles.length ? roles : ["setter"];
}

export const serializeRoles = (roles: Role[]) => ALL_ROLES.filter((r) => roles.includes(r)).join(",");

export const isAdmin = (roles: Role[]) => roles.includes("admin");

/** Rollen, deren Ansicht die Person öffnen darf (Admins: alle) */
export const viewableRoles = (roles: Role[]): Role[] => (isAdmin(roles) ? ALL_ROLES : roles);

/** Start-Ansicht nach dem Login: Admins die Admin-Übersicht, sonst die erste eigene Rolle */
export const defaultRole = (roles: Role[]): Role => (isAdmin(roles) ? "admin" : roles[0]);

/** „Setter, Presetter, Closer“ */
export const rolesLabel = (roles: Role[]) => roles.map((r) => ROLE_NAMES[r]).join(", ");

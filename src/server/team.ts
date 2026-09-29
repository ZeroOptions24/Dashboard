import "server-only";
import { eq } from "drizzle-orm";
import { formatIban } from "@/lib/iban";
import { isAdmin, parseRoles, serializeRoles } from "@/lib/roles";
import type { Role } from "@/lib/types";
import { auth } from "./auth";
import { decrypt } from "./crypto";
import { db, schema } from "./db";
import { inviteMember } from "./onboarding";

/* Team-Verwaltung für Admins (echte Nutzer aus der Datenbank).
   Aufrufer (Server Actions) prüfen vorher requireAdmin(). */

const audit = (actorId: string, action: string, targetUserId: string, detail?: string) =>
  db.insert(schema.auditLog).values({ actorId, action, targetUserId, detail });

async function assertNotLastAdmin(userId: string, nextRoles?: Role[]) {
  const users = await db.select({ id: schema.user.id, role: schema.user.role, banned: schema.user.banned }).from(schema.user);
  const admins = users.filter((u) => !u.banned && isAdmin(parseRoles(u.role)));
  const remaining = admins.filter((u) => u.id !== userId || (nextRoles && isAdmin(nextRoles)));
  if (!remaining.length) throw new Error("Es muss mindestens ein aktiver Admin bleiben");
}

/** Name, E-Mail und Rollen ändern */
export async function updateMember(userId: string, input: { name: string; email: string; roles: Role[] }, adminId: string, h: Headers) {
  const name = input.name.trim(),
    email = input.email.trim().toLowerCase();
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Name und gültige E-Mail angeben");
  if (!input.roles.length) throw new Error("Mindestens eine Rolle wählen");
  const [other] = await db.select({ id: schema.user.id }).from(schema.user).where(eq(schema.user.email, email));
  if (other && other.id !== userId) throw new Error("Diese E-Mail gehört schon zu einem anderen Zugang");
  if (!isAdmin(input.roles)) await assertNotLastAdmin(userId, input.roles);
  await db.update(schema.user).set({ name, email, updatedAt: new Date() }).where(eq(schema.user.id, userId));
  await auth.api.setRole({ body: { userId, role: input.roles as "admin"[] }, headers: h });
  if (input.roles.includes("setter")) {
    const [p] = await db.select({ n: schema.profile.pipedriveSetterName }).from(schema.profile).where(eq(schema.profile.userId, userId));
    if (!p?.n) await db.update(schema.profile).set({ pipedriveSetterName: name.split(" ")[0] }).where(eq(schema.profile.userId, userId));
  }
  await audit(adminId, "team.update", userId, serializeRoles(input.roles));
}

/** Zugang sperren (alle Sitzungen enden sofort) bzw. entsperren */
export async function setBanned(userId: string, banned: boolean, adminId: string, h: Headers) {
  if (userId === adminId) throw new Error("Du kannst dich nicht selbst sperren");
  if (banned) {
    await assertNotLastAdmin(userId, []);
    await auth.api.banUser({ body: { userId, banReason: "Vom Admin gesperrt" }, headers: h });
  } else await auth.api.unbanUser({ body: { userId }, headers: h });
  await audit(adminId, banned ? "team.ban" : "team.unban", userId);
}

/** Person und alle zugehörigen Daten endgültig löschen (DSGVO). Das Protokoll behält nur die ID. */
export async function deleteMember(userId: string, adminId: string, h: Headers) {
  if (userId === adminId) throw new Error("Du kannst dich nicht selbst löschen");
  await assertNotLastAdmin(userId, []);
  await auth.api.removeUser({ body: { userId }, headers: h }); /* Profil, Onboarding, Sitzungen per ON DELETE CASCADE */
  await audit(adminId, "team.delete", userId);
}

export interface MemberDetails {
  telefon: string;
  geburtsdatum: string;
  adresse: string;
  ibanMasked: string;
  kontoinhaber: string;
  steuernummer: string;
  kleinunternehmer: boolean;
  gewerbe: boolean;
  twoFactor: boolean;
}

export async function memberDetails(userId: string): Promise<MemberDetails> {
  const [row] = await db
    .select({ p: schema.profile, u: schema.user })
    .from(schema.user)
    .leftJoin(schema.profile, eq(schema.profile.userId, schema.user.id))
    .where(eq(schema.user.id, userId));
  if (!row) throw new Error("Nicht gefunden");
  const p = row.p;
  return {
    telefon: p?.telefon ?? "",
    geburtsdatum: p?.geburtsdatum ? p.geburtsdatum.split("-").reverse().join(".") : "",
    adresse: p?.strasse ? `${p.strasse}, ${p.plz} ${p.ort}` : "",
    ibanMasked: p?.ibanLast4 ? `•••• •••• •••• •••• ${p.ibanLast4}` : "",
    kontoinhaber: p?.kontoinhaber ?? "",
    steuernummer: p?.steuernummer ?? "",
    kleinunternehmer: p?.kleinunternehmer ?? false,
    gewerbe: p?.gewerbeAngemeldet ?? false,
    twoFactor: !!row.u.twoFactorEnabled,
  };
}

/** Volle IBAN für Admins – jeder Abruf wird protokolliert */
export async function revealIban(userId: string, adminId: string): Promise<string> {
  const [p] = await db.select({ ibanEnc: schema.profile.ibanEnc }).from(schema.profile).where(eq(schema.profile.userId, userId));
  if (!p?.ibanEnc) return "";
  await audit(adminId, "profile.iban_viewed", userId);
  return formatIban(decrypt(p.ibanEnc));
}

/* ---------- Bestehende MAs übernehmen (Liste einfügen) ---------- */

const ROLE_WORDS: [RegExp, Role[]][] = [
  [/alle\s*rollen/i, ["setter", "presetter", "closer"]],
  [/admin/i, ["admin"]],
  [/presetter/i, ["presetter"]],
  [/closer/i, ["closer"]],
  [/(^|[^a-z])setter/i, ["setter"]],
];

export interface ImportLine {
  line: string;
  name: string;
  email: string;
  roles: Role[];
  error?: string;
}

/** Eine Zeile je Person: „Name – E-Mail – Rollen“ (Trenner: –, -, ;, Tab oder |) */
export function parseImport(text: string): ImportLine[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const email = line.match(/[^\s<>;,|]+@[^\s<>;,|]+\.[a-z]{2,}/i)?.[0]?.toLowerCase() ?? "";
      const [before, after = ""] = email ? line.split(email) : [line, ""];
      const name = before.replace(/[–\-;|\t,]+\s*$/, "").trim();
      const roles = new Set<Role>();
      for (const [re, rs] of ROLE_WORDS) if (re.test(after)) rs.forEach((r) => roles.add(r));
      const list = (["setter", "presetter", "closer", "admin"] as Role[]).filter((r) => roles.has(r));
      const error = !name ? "Name fehlt" : !email ? "E-Mail fehlt" : !list.length ? "Rolle nicht erkannt" : undefined;
      return { line, name, email, roles: list, error };
    });
}

/** Übernimmt die Liste: je Person Einladung mit Formular für die Stammdaten; mit skipContract ohne Vertragsschritt */
export async function importMembers(text: string, skipContract: boolean, adminId: string, h: Headers) {
  const lines = parseImport(text);
  const results: { name: string; email: string; ok: boolean; message: string }[] = [];
  for (const l of lines) {
    if (l.error) {
      results.push({ name: l.name || l.line, email: l.email, ok: false, message: l.error });
      continue;
    }
    try {
      await inviteMember({ name: l.name, email: l.email, roles: l.roles, skipContract }, adminId, h);
      results.push({ name: l.name, email: l.email, ok: true, message: "eingeladen" });
    } catch (e) {
      results.push({ name: l.name, email: l.email, ok: false, message: e instanceof Error ? e.message : "Fehler" });
    }
  }
  return results;
}

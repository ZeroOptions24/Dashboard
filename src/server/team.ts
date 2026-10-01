import "server-only";
import { and, desc, eq, gte, inArray, isNull } from "drizzle-orm";
import { formatIban } from "@/lib/iban";
import { isAdmin, parseRoles, serializeRoles } from "@/lib/roles";
import type { Role } from "@/lib/types";
import { auth } from "./auth";
import { decrypt } from "./crypto";
import { db, schema } from "./db";
import { smtpConfigured } from "./mail";
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

/* ---------- Ohne SMTP: nicht versendete E-Mails mit ihrem Link (zum Weiterleiten per WhatsApp) ---------- */

export interface UnsentMail {
  id: number;
  to: string;
  subject: string;
  at: string;
  link: string | null;
}

export async function listUnsentMail(): Promise<{ smtp: boolean; mails: UnsentMail[] }> {
  if (smtpConfigured()) return { smtp: true, mails: [] };
  const rows = await db
    .select()
    .from(schema.outbox)
    .where(and(isNull(schema.outbox.sentAt), gte(schema.outbox.createdAt, new Date(Date.now() - 14 * 864e5))))
    .orderBy(desc(schema.outbox.createdAt))
    .limit(30);
  return {
    smtp: false,
    mails: rows.map((r) => ({
      id: r.id,
      to: r.to,
      subject: r.subject,
      at: r.createdAt.toLocaleString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }),
      /* erster Button-Link der Mail (Formular, Passwort festlegen, Dashboard …) */
      link: r.html.match(/href="(https?:[^"]+)"/)?.[1]?.replace(/&amp;/g, "&") ?? null,
    })),
  };
}

/** Link einer nicht versendeten Mail wurde vom Admin kopiert – protokollieren */
export async function logMailLinkCopied(mailId: number, adminId: string) {
  await db.insert(schema.auditLog).values({ actorId: adminId, action: "outbox.link_copied", detail: String(mailId) });
}

/* ---------- Protokoll (Admins) ---------- */

const AUDIT_LABELS: Record<string, string> = {
  "profile.iban_viewed": "IBAN angesehen",
  "profile.pipedrive_name": "Pipedrive-Setter-Name geändert",
  "profile.setter_code": "Setter-Link-Code geändert",
  "team.update": "Rollen/Name geändert",
  "team.ban": "Zugang gesperrt",
  "team.unban": "Zugang entsperrt",
  "team.delete": "Person gelöscht",
  "team.data_export": "Datenauskunft erstellt",
  "onboarding.invite": "Eingeladen",
  "onboarding.resend": "Formular-Link erneut gesendet",
  "onboarding.data_submitted": "Stammdaten eingereicht",
  "onboarding.contract_sent": "Vertrag gesendet",
  "onboarding.signed": "Vertrag unterschrieben",
  "onboarding.activate_directly": "Direkt freigeschaltet",
  "onboarding.skip_contract": "Ohne Vertragsschritt",
  "onboarding.withdraw": "Einladung zurückgezogen",
  "onboarding.access_resent": "Zugangslink erneut gesendet",
  "onboarding.reminder_form": "Erinnerung: Formular",
  "onboarding.reminder_access": "Erinnerung: Zugang",
  "contract.sent": "Vertrag gesendet",
  "contract.signed": "Vertrag unterschrieben",
  "contract.pdf_viewed": "Vertrags-PDF angesehen",
  "contract.question_resolved": "Rückfrage geklärt",
  "contract.reminded": "An Vertrag erinnert",
  "payout.release": "Auszahlung freigegeben",
  "board.archived": "Wettbewerb abgeschlossen",
  "lead.setter_assigned": "Setter zugewiesen",
  "lead.submitted": "Lead erfasst",
  "lead.deleted": "Lead gelöscht",
  "pipedrive.setup": "Pipedrive-Pipeline eingerichtet",
  "outbox.link_copied": "Link aus E-Mail kopiert",
};

export interface AuditEntry {
  at: string;
  actor: string;
  action: string;
  label: string;
  target: string;
  detail: string;
}

export async function listAudit(limit = 200): Promise<AuditEntry[]> {
  const rows = await db.select().from(schema.auditLog).orderBy(desc(schema.auditLog.at)).limit(Math.min(500, limit));
  const ids = [...new Set(rows.flatMap((r) => [r.actorId, r.targetUserId]).filter((x): x is string => !!x))];
  const names = new Map(
    ids.length ? (await db.select({ id: schema.user.id, name: schema.user.name }).from(schema.user).where(inArray(schema.user.id, ids))).map((u) => [u.id, u.name]) : [],
  );
  const who = (id: string | null) => (id ? (names.get(id) ?? "gelöschte Person") : "System");
  return rows.map((r) => ({
    at: r.at.toISOString(),
    actor: who(r.actorId),
    action: r.action,
    label: AUDIT_LABELS[r.action] ?? r.action,
    target: r.targetUserId ? who(r.targetUserId) : "",
    /* keine sensiblen Inhalte im Protokoll – nur kurze Angaben */
    detail: (r.detail ?? "").slice(0, 160),
  }));
}

/* ---------- Datenauskunft (DSGVO Art. 15) ---------- */

/** Alle im Dashboard gespeicherten Daten zu einer Person – als JSON für die Auskunft. Wird protokolliert. */
export async function exportMember(userId: string, adminId: string) {
  const [u] = await db.select().from(schema.user).where(eq(schema.user.id, userId));
  if (!u) throw new Error("Nicht gefunden");
  const [p] = await db.select().from(schema.profile).where(eq(schema.profile.userId, userId));
  const [ob] = await db.select().from(schema.onboarding).where(eq(schema.onboarding.userId, userId));
  const strip = <T extends Record<string, unknown>>(o: T | undefined, drop: string[]) =>
    o ? Object.fromEntries(Object.entries(o).filter(([k]) => !drop.includes(k))) : null;
  const data = {
    erstellt: new Date().toISOString(),
    hinweis: "Datenauskunft aus dem EnergyEngel MB-Dashboard. Leads/Kundendaten liegen in Pipedrive und sind hier nur als Verweise enthalten.",
    konto: { name: u.name, email: u.email, rollen: parseRoles(u.role), angelegt: u.createdAt, gesperrt: !!u.banned, zweiFaktor: !!u.twoFactorEnabled },
    stammdaten: p ? { ...strip(p, ["ibanEnc", "ibanLast4", "userId"]), iban: p.ibanEnc ? formatIban(decrypt(p.ibanEnc)) : null } : null,
    onboarding: strip(ob, ["formTokenHash", "userId"]),
    vertraege: (await db.select().from(schema.contract).where(eq(schema.contract.userId, userId))).map((c) => strip(c, ["pdfBase64", "signatureRequestId", "userId"])),
    auszahlungen: (await db.select().from(schema.payout).where(eq(schema.payout.userId, userId))).map((x) => strip(x, ["userId"])),
    benachrichtigungen: (await db.select().from(schema.notification).where(eq(schema.notification.userId, userId))).map((x) => strip(x, ["userId", "id"])),
    eventZusagen: (await db.select().from(schema.eventRsvp).where(eq(schema.eventRsvp.userId, userId))).map((x) => x.eventId),
    freieSlots: (await db.select().from(schema.closerSlot).where(eq(schema.closerSlot.closerId, userId))).map((x) => strip(x, ["closerId"])),
    termineAlsCloser: (await db.select().from(schema.appointment).where(eq(schema.appointment.closerId, userId))).map((x) => strip(x, ["closerId"])),
    leadAktionen: (await db.select().from(schema.leadActivity).where(eq(schema.leadActivity.userId, userId))).map((x) => strip(x, ["userId", "id"])),
    protokoll: (await db.select().from(schema.auditLog).where(eq(schema.auditLog.targetUserId, userId))).map((x) => ({ at: x.at, aktion: AUDIT_LABELS[x.action] ?? x.action })),
  };
  await db.insert(schema.auditLog).values({ actorId: adminId, action: "team.data_export", targetUserId: userId });
  return data;
}

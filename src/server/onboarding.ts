import "server-only";
import { and, desc, eq, gt } from "drizzle-orm";
import { isValidIban, normalizeIban } from "@/lib/iban";
import { parseRoles, serializeRoles } from "@/lib/roles";
import type { Role } from "@/lib/types";
import { adminEmails, auth } from "./auth";
import { createAndSendContract, markContractSigned } from "./contract-service";
import { encrypt, hashToken, newToken } from "./crypto";
import { db, schema } from "./db";
import { appUrl, mailLayout, sendMail } from "./mail";

/* Onboarding neuer MAs:
   1. Admin lädt ein (Name, E-Mail, Rolle)      → eingeladen       (Mail mit Formular-Link)
   2. MA füllt Stammdaten aus                    → daten_erfasst    (Admins werden benachrichtigt)
   3. Admin prüft und sendet den Vertrag         → vertrag_versendet (Signing-Tool)
   4. Signing-Tool meldet die Unterschrift       → unterschrieben   (Mail „Passwort festlegen“)
   5. MA legt sein Passwort fest                 → aktiv            (siehe onPasswordReset in auth.ts)
   Aufrufer (Server Actions) prüfen vorher die Berechtigung (requireAdmin). */

export type OnboardingStatus = "eingeladen" | "daten_erfasst" | "vertrag_versendet" | "unterschrieben" | "aktiv" | "zurueckgezogen";

export const STATUS_LABEL: Record<OnboardingStatus, string> = {
  eingeladen: "Eingeladen",
  daten_erfasst: "Daten erfasst",
  vertrag_versendet: "Vertrag versendet",
  unterschrieben: "Unterschrieben",
  aktiv: "Aktiv",
  zurueckgezogen: "Zurückgezogen",
};

/** Gültigkeit des Formular-Links */
const FORM_LINK_DAYS = 7;

/* Erinnerungen: nach REMINDER_AFTER_DAYS ohne Fortschritt, höchstens MAX_REMINDERS pro Schritt */
const REMINDER_AFTER_DAYS = 3;
const MAX_REMINDERS = 2;
const RESET_REMINDERS = { remindersSent: 0, lastReminderAt: null };

const audit = (actorId: string | null, action: string, targetUserId: string, detail?: string) =>
  db.insert(schema.auditLog).values({ actorId, action, targetUserId, detail });

async function setStatus(userId: string, status: OnboardingStatus, extra: Partial<typeof schema.onboarding.$inferInsert> = {}) {
  await db
    .update(schema.onboarding)
    .set({ status, updatedAt: new Date(), ...extra })
    .where(eq(schema.onboarding.userId, userId));
}

async function getRow(userId: string) {
  const [row] = await db
    .select({ ob: schema.onboarding, user: schema.user })
    .from(schema.onboarding)
    .innerJoin(schema.user, eq(schema.user.id, schema.onboarding.userId))
    .where(eq(schema.onboarding.userId, userId));
  if (!row) throw new Error("Onboarding nicht gefunden");
  return row;
}

/* ---------- 1. Einladen ---------- */

async function sendFormLink(userId: string, name: string, email: string, reminder = false) {
  const token = newToken();
  const [ob] = await db
    .update(schema.onboarding)
    .set({ formTokenHash: hashToken(token), formTokenExpiresAt: new Date(Date.now() + FORM_LINK_DAYS * 864e5), updatedAt: new Date() })
    .where(eq(schema.onboarding.userId, userId))
    .returning({ skipContract: schema.onboarding.skipContract });
  const direct = !!ob?.skipContract; /* bestehende MAs: kein Vertrag, direkt Zugang */
  await sendMail(
    email,
    reminder ? "Erinnerung: Bitte ergänze deine Daten für EnergyEngel" : "Willkommen bei EnergyEngel – bitte deine Daten ergänzen",
    mailLayout({
      title: reminder ? `Hallo ${name.split(" ")[0]}, es fehlt nur noch ein Schritt` : `Hallo ${name.split(" ")[0]}, schön dass du dabei bist!`,
      intro: direct
        ? "Unser neues MB-Dashboard ist da! Damit wir deine Provision sauber abrechnen, brauchen wir einmal deine Angaben: Adresse, Geburtsdatum, Bankverbindung und Steuerdaten. Das dauert etwa 3 Minuten."
        : "Für deinen Vertrag brauchen wir ein paar Angaben: Adresse, Geburtsdatum, Bankverbindung für deine Provision und Steuerdaten. Das dauert etwa 3 Minuten.",
      button: "Daten ergänzen",
      url: `${appUrl()}/onboarding/${token}`,
      outro: direct
        ? `Der Link ist ${FORM_LINK_DAYS} Tage gültig. Danach bekommst du direkt deinen Zugang und legst dein Passwort fest.`
        : `Der Link ist ${FORM_LINK_DAYS} Tage gültig. Danach schicken wir dir den Vertrag zur elektronischen Unterschrift.`,
    }),
  );
}

export async function inviteMember(
  input: { name: string; email: string; roles: Role[]; telefon?: string; skipContract?: boolean },
  adminId: string,
  requestHeaders: Headers,
) {
  const name = input.name.trim(),
    email = input.email.trim().toLowerCase();
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Name und gültige E-Mail angeben");
  if (!input.roles.length) throw new Error("Mindestens eine Rolle wählen");
  const role = serializeRoles(input.roles);
  const [exists] = await db.select({ id: schema.user.id }).from(schema.user).where(eq(schema.user.email, email));
  if (exists) throw new Error("Zu dieser E-Mail gibt es schon einen Zugang");
  /* Konto ohne Passwort – das setzt der MA erst nach der Unterschrift selbst */
  /* Better Auth prüft jede Rolle einzeln und speichert sie kommagetrennt */
  const { user } = await auth.api.createUser({ body: { email, name, role: input.roles as "admin"[] }, headers: requestHeaders });
  await db.insert(schema.onboarding).values({ userId: user.id, invitedBy: adminId, skipContract: !!input.skipContract });
  await db.insert(schema.profile).values({
    userId: user.id,
    telefon: input.telefon?.trim() || null,
    /* Standard: Vorname – so trägt ihn n8n ins Pipedrive-Feld „Setter“ ein; im Team-Bereich änderbar */
    pipedriveSetterName: input.roles.includes("setter") ? name.split(" ")[0] : null,
  });
  await sendFormLink(user.id, name, email);
  await audit(adminId, "onboarding.invite", user.id, role);
  return user.id;
}

/** Formular-Link erneut senden (neuer Link, alter wird ungültig). */
export async function resendFormLink(userId: string, adminId: string) {
  const { ob, user } = await getRow(userId);
  if (ob.status !== "eingeladen") throw new Error("Daten wurden bereits erfasst");
  await sendFormLink(userId, user.name, user.email);
  await audit(adminId, "onboarding.resend", userId);
}

/* ---------- 2. Daten erfassen (öffentlich, nur mit gültigem Link) ---------- */

async function findByFormToken(token: string) {
  const [row] = await db
    .select({ ob: schema.onboarding, user: schema.user })
    .from(schema.onboarding)
    .innerJoin(schema.user, eq(schema.user.id, schema.onboarding.userId))
    .where(
      and(
        eq(schema.onboarding.formTokenHash, hashToken(token)),
        eq(schema.onboarding.status, "eingeladen"),
        gt(schema.onboarding.formTokenExpiresAt, new Date()),
      ),
    );
  return row ?? null;
}

/** Für die Formularseite: nur Name und Rolle, keine weiteren Daten. */
export async function checkFormToken(token: string) {
  const row = await findByFormToken(token);
  return row ? { name: row.user.name, email: row.user.email, roles: parseRoles(row.user.role), skipContract: row.ob.skipContract } : null;
}

export interface OnboardingFormData {
  telefon: string;
  geburtsdatum: string;
  strasse: string;
  plz: string;
  ort: string;
  iban: string;
  kontoinhaber: string;
  steuernummer: string;
  kleinunternehmer: boolean;
  gewerbeAngemeldet: boolean;
  datenschutz: boolean;
}

/** Prüft die Angaben; liefert Fehlermeldungen je Feld (leer = alles ok). */
export function validateFormData(d: OnboardingFormData): Partial<Record<keyof OnboardingFormData, string>> {
  const e: Partial<Record<keyof OnboardingFormData, string>> = {};
  const req = (k: keyof OnboardingFormData, label: string) => {
    if (!String(d[k] ?? "").trim()) e[k] = `${label} fehlt`;
  };
  req("telefon", "Telefon");
  req("geburtsdatum", "Geburtsdatum");
  req("strasse", "Straße und Hausnummer");
  req("ort", "Ort");
  req("kontoinhaber", "Kontoinhaber");
  if (!/^\d{5}$/.test(d.plz.trim())) e.plz = "Bitte 5-stellige PLZ";
  if (!isValidIban(d.iban)) e.iban = "IBAN ist ungültig – bitte prüfen";
  if (d.geburtsdatum) {
    const age = (Date.now() - new Date(d.geburtsdatum).getTime()) / (365.25 * 864e5);
    if (!(age >= 18 && age < 100)) e.geburtsdatum = "Du musst mindestens 18 Jahre alt sein";
  }
  if (!d.datenschutz) e.datenschutz = "Bitte bestätige die Datenschutzhinweise";
  return e;
}

export async function submitFormData(token: string, d: OnboardingFormData) {
  const row = await findByFormToken(token);
  if (!row) throw new Error("Der Link ist ungültig oder abgelaufen");
  const errors = validateFormData(d);
  if (Object.keys(errors).length) return { ok: false as const, errors };
  const iban = normalizeIban(d.iban);
  await db
    .update(schema.profile)
    .set({
      telefon: d.telefon.trim(),
      geburtsdatum: d.geburtsdatum,
      strasse: d.strasse.trim(),
      plz: d.plz.trim(),
      ort: d.ort.trim(),
      ibanEnc: encrypt(iban),
      ibanLast4: iban.slice(-4),
      kontoinhaber: d.kontoinhaber.trim(),
      steuernummer: d.steuernummer.trim() || null,
      kleinunternehmer: d.kleinunternehmer,
      gewerbeAngemeldet: d.gewerbeAngemeldet,
      datenschutzAkzeptiertAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(schema.profile.userId, row.user.id));
  /* Link sofort entwerten */
  await setStatus(row.user.id, "daten_erfasst", { dataSubmittedAt: new Date(), formTokenHash: null, formTokenExpiresAt: null, ...RESET_REMINDERS });
  await audit(row.user.id, "onboarding.data_submitted", row.user.id);
  /* Bestehende MAs mit Vertrag: kein Vertragsschritt, direkt Zugang */
  if (row.ob.skipContract) {
    await setStatus(row.user.id, "unterschrieben", { signedAt: new Date(), ...RESET_REMINDERS });
    await audit(null, "onboarding.skip_contract", row.user.id);
    await sendAccess(row.user.id, row.user.email);
    return { ok: true as const, direct: true };
  }
  const admins = (await adminEmails()).map((email) => ({ email }));
  for (const a of admins)
    await sendMail(
      a.email,
      `${row.user.name} hat die Daten ergänzt – Vertrag senden`,
      mailLayout({
        title: `${row.user.name} hat die Daten ergänzt`,
        intro: "Bitte prüfe die Angaben im Dashboard und sende den Vertrag zur Unterschrift.",
        button: "Im Dashboard öffnen",
        url: `${appUrl()}/?view=team`,
      }),
    );
  return { ok: true as const };
}

/* ---------- 3. Vertrag senden ---------- */

export async function sendContract(userId: string, adminId: string) {
  const { ob } = await getRow(userId);
  if (ob.status !== "daten_erfasst") throw new Error("Vertrag kann erst nach der Datenerfassung gesendet werden");
  const requestId = await createAndSendContract(userId, adminId);
  await setStatus(userId, "vertrag_versendet", { contractSentAt: new Date(), signatureRequestId: requestId, ...RESET_REMINDERS });
  await audit(adminId, "onboarding.contract_sent", userId, requestId);
}

/* ---------- 4. Unterschrift → Zugang senden ---------- */

async function sendAccess(userId: string, email: string) {
  /* Better Auth erzeugt den Einmal-Link und ruft sendResetPassword (auth.ts) auf */
  await auth.api.requestPasswordReset({ body: { email, redirectTo: `${appUrl()}/passwort-setzen` } });
  await setStatus(userId, "unterschrieben", { accessSentAt: new Date() });
}

/** Vom Signing-Tool (Webhook) bzw. der Dev-Unterschriftsseite aufgerufen. */
export async function markSigned(signatureRequestId: string) {
  await markContractSigned(signatureRequestId);
  const [row] = await db
    .select({ ob: schema.onboarding, user: schema.user })
    .from(schema.onboarding)
    .innerJoin(schema.user, eq(schema.user.id, schema.onboarding.userId))
    .where(eq(schema.onboarding.signatureRequestId, signatureRequestId));
  /* kein Onboarding-Vertrag (z. B. weitere Unterlagen) oder doppelter Webhook: fertig */
  if (!row || row.ob.status !== "vertrag_versendet") return;
  await setStatus(row.user.id, "unterschrieben", { signedAt: new Date(), ...RESET_REMINDERS });
  await audit(null, "onboarding.signed", row.user.id, signatureRequestId);
  await sendAccess(row.user.id, row.user.email);
}

/** Zugangs-Link erneut senden (z. B. wenn der 48-Stunden-Link abgelaufen ist). */
export async function resendAccess(userId: string, adminId: string) {
  const { ob, user } = await getRow(userId);
  if (ob.status !== "unterschrieben") throw new Error("Zugang erst nach der Unterschrift");
  await sendAccess(userId, user.email);
  await audit(adminId, "onboarding.access_resent", userId);
}

/** Für bestehende MAs mit bereits unterschriebenem Vertrag: Formular und Vertrag überspringen. */
export async function activateDirectly(userId: string, adminId: string) {
  const { ob, user } = await getRow(userId);
  if (["aktiv", "zurueckgezogen"].includes(ob.status)) throw new Error("Nicht möglich in diesem Status");
  await setStatus(userId, "unterschrieben", { signedAt: new Date(), formTokenHash: null, formTokenExpiresAt: null, ...RESET_REMINDERS });
  await audit(adminId, "onboarding.activate_directly", userId);
  await sendAccess(userId, user.email);
}

/** Einladung zurückziehen: Links ungültig, Konto gesperrt. */
export async function withdraw(userId: string, adminId: string, requestHeaders: Headers) {
  await setStatus(userId, "zurueckgezogen", { formTokenHash: null, formTokenExpiresAt: null });
  await auth.api.banUser({ body: { userId, banReason: "Einladung zurückgezogen" }, headers: requestHeaders });
  await audit(adminId, "onboarding.withdraw", userId);
}

/* ---------- Übersicht für Admins ---------- */

export interface OnboardingRow {
  userId: string;
  name: string;
  email: string;
  roles: Role[];
  status: OnboardingStatus;
  banned: boolean;
  skipContract: boolean;
  invitedAt: string;
  updatedAt: string;
  formLinkExpired: boolean;
  remindersSent: number;
  /** Name im Pipedrive-Feld „Setter“ (nur Setter) */
  pipedriveSetterName: string | null;
  /** Code aus dem Setter-Link (für neue Leads aus dem Dashboard über n8n) */
  setterCode: string | null;
  /** Stammdaten zur Prüfung vor dem Vertragsversand (IBAN nur maskiert) */
  data: { adresse: string; geburtsdatum: string; iban: string; kontoinhaber: string; steuernummer: string; kleinunternehmer: boolean; gewerbe: boolean } | null;
}

export async function listOnboarding(): Promise<OnboardingRow[]> {
  const rows = await db
    .select({ ob: schema.onboarding, user: schema.user, p: schema.profile })
    .from(schema.onboarding)
    .innerJoin(schema.user, eq(schema.user.id, schema.onboarding.userId))
    .leftJoin(schema.profile, eq(schema.profile.userId, schema.onboarding.userId))
    .orderBy(desc(schema.onboarding.updatedAt));
  return rows.map(({ ob, user, p }) => ({
    userId: user.id,
    name: user.name,
    email: user.email,
    roles: parseRoles(user.role),
    status: ob.status as OnboardingStatus,
    banned: !!user.banned,
    skipContract: ob.skipContract,
    invitedAt: ob.invitedAt.toISOString(),
    updatedAt: ob.updatedAt.toISOString(),
    formLinkExpired: ob.status === "eingeladen" && !!ob.formTokenExpiresAt && ob.formTokenExpiresAt < new Date(),
    remindersSent: ob.remindersSent,
    pipedriveSetterName: p?.pipedriveSetterName ?? null,
    setterCode: p?.setterCode ?? null,
    data:
      p && p.ibanLast4
        ? {
            adresse: `${p.strasse}, ${p.plz} ${p.ort}`,
            geburtsdatum: p.geburtsdatum ? p.geburtsdatum.split("-").reverse().join(".") : "",
            iban: `•••• •••• •••• •••• ${p.ibanLast4}`,
            kontoinhaber: p.kontoinhaber ?? "",
            steuernummer: p.steuernummer ?? "",
            kleinunternehmer: p.kleinunternehmer,
            gewerbe: p.gewerbeAngemeldet,
          }
        : null,
  }));
}

/** Pipedrive-Setter-Namen setzen (Zuordnung der Leads zu diesem Zugang). */
export async function setPipedriveSetterName(userId: string, name: string, adminId: string) {
  const clean = name.trim().replace(/\s+/g, " ");
  if (clean.length > 80) throw new Error("Name ist zu lang");
  await db.update(schema.profile).set({ pipedriveSetterName: clean || null, updatedAt: new Date() }).where(eq(schema.profile.userId, userId));
  await audit(adminId, "profile.pipedrive_name", userId, clean);
}

/** Setter-Link-Code setzen (wie im bisherigen Formular-Link ?setter=…) */
export async function setSetterCode(userId: string, code: string, adminId: string) {
  const clean = code.trim();
  if (clean && !/^[A-Za-z0-9_-]{1,80}$/.test(clean)) throw new Error("Nur Buchstaben, Ziffern, - und _ (wie im Setter-Link)");
  await db.update(schema.profile).set({ setterCode: clean || null, updatedAt: new Date() }).where(eq(schema.profile.userId, userId));
  await audit(adminId, "profile.setter_code", userId);
}

/* ---------- Erinnerungen (täglich per Cron, siehe /api/cron/reminders) ---------- */

export interface ReminderReport {
  formReminders: string[];
  accessResent: string[];
  stuck: string[];
}

export async function sendReminders(now = new Date()): Promise<ReminderReport> {
  const report: ReminderReport = { formReminders: [], accessResent: [], stuck: [] };
  const rows = await db
    .select({ ob: schema.onboarding, user: schema.user })
    .from(schema.onboarding)
    .innerJoin(schema.user, eq(schema.user.id, schema.onboarding.userId));
  const daysSince = (d: Date | null) => (d ? (now.getTime() - d.getTime()) / 864e5 : 0);
  const bump = (userId: string, sent: number) =>
    db.update(schema.onboarding).set({ remindersSent: sent + 1, lastReminderAt: now }).where(eq(schema.onboarding.userId, userId));

  for (const { ob, user } of rows) {
    if (ob.status === "eingeladen") {
      if (daysSince(ob.lastReminderAt ?? ob.invitedAt) < REMINDER_AFTER_DAYS) continue;
      if (ob.remindersSent >= MAX_REMINDERS) report.stuck.push(`${user.name}: Daten nach ${MAX_REMINDERS} Erinnerungen noch nicht ergänzt`);
      else {
        await sendFormLink(user.id, user.name, user.email, true);
        await bump(user.id, ob.remindersSent);
        await audit(null, "onboarding.reminder_form", user.id);
        report.formReminders.push(user.name);
      }
    } else if (ob.status === "daten_erfasst" && daysSince(ob.dataSubmittedAt) >= 1) {
      report.stuck.push(`${user.name}: Daten erfasst – Vertrag noch nicht gesendet`);
    } else if (ob.status === "vertrag_versendet" && daysSince(ob.contractSentAt) >= REMINDER_AFTER_DAYS) {
      report.stuck.push(`${user.name}: Vertrag seit ${Math.floor(daysSince(ob.contractSentAt))} Tagen nicht unterschrieben`);
    } else if (ob.status === "unterschrieben" && daysSince(ob.lastReminderAt ?? ob.accessSentAt) >= 2) {
      /* Passwort-Link (48 Std.) abgelaufen, ohne dass ein Passwort gesetzt wurde */
      if (ob.remindersSent >= MAX_REMINDERS) report.stuck.push(`${user.name}: Passwort trotz Erinnerungen nicht festgelegt`);
      else {
        await sendAccess(user.id, user.email);
        await bump(user.id, ob.remindersSent);
        await audit(null, "onboarding.reminder_access", user.id);
        report.accessResent.push(user.name);
      }
    }
  }

  if (report.stuck.length) {
    const admins = (await adminEmails()).map((email) => ({ email }));
    for (const a of admins)
      await sendMail(
        a.email,
        `Onboarding: ${report.stuck.length} ${report.stuck.length === 1 ? "Fall braucht" : "Fälle brauchen"} deine Hilfe`,
        mailLayout({
          title: "Onboarding – das hängt gerade",
          intro: report.stuck.join(" · "),
          button: "Im Dashboard öffnen",
          url: `${appUrl()}/?view=team`,
        }),
      );
  }
  return report;
}

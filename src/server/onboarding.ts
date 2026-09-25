import "server-only";
import { and, desc, eq, gt } from "drizzle-orm";
import { isValidIban, normalizeIban } from "@/lib/iban";
import { auth, type AuthRole } from "./auth";
import { generateContract } from "./contracts";
import { encrypt, hashToken, newToken } from "./crypto";
import { db, schema } from "./db";
import { appUrl, mailLayout, sendMail } from "./mail";
import { signingProvider } from "./signing";

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

async function sendFormLink(userId: string, name: string, email: string) {
  const token = newToken();
  await db
    .update(schema.onboarding)
    .set({ formTokenHash: hashToken(token), formTokenExpiresAt: new Date(Date.now() + FORM_LINK_DAYS * 864e5), updatedAt: new Date() })
    .where(eq(schema.onboarding.userId, userId));
  await sendMail(
    email,
    "Willkommen bei EnergyEngel – bitte deine Daten ergänzen",
    mailLayout({
      title: `Hallo ${name.split(" ")[0]}, schön dass du dabei bist!`,
      intro:
        "Für deinen Vertrag brauchen wir ein paar Angaben: Adresse, Geburtsdatum, Bankverbindung für deine Provision und Steuerdaten. Das dauert etwa 3 Minuten.",
      button: "Daten ergänzen",
      url: `${appUrl()}/onboarding/${token}`,
      outro: `Der Link ist ${FORM_LINK_DAYS} Tage gültig. Danach schicken wir dir den Vertrag zur elektronischen Unterschrift.`,
    }),
  );
}

export async function inviteMember(
  input: { name: string; email: string; role: Exclude<AuthRole, "admin">; telefon?: string },
  adminId: string,
  requestHeaders: Headers,
) {
  const name = input.name.trim(),
    email = input.email.trim().toLowerCase();
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Name und gültige E-Mail angeben");
  const [exists] = await db.select({ id: schema.user.id }).from(schema.user).where(eq(schema.user.email, email));
  if (exists) throw new Error("Zu dieser E-Mail gibt es schon einen Zugang");
  /* Konto ohne Passwort – das setzt der MA erst nach der Unterschrift selbst */
  const { user } = await auth.api.createUser({ body: { email, name, role: input.role }, headers: requestHeaders });
  await db.insert(schema.onboarding).values({ userId: user.id, invitedBy: adminId });
  await db.insert(schema.profile).values({ userId: user.id, telefon: input.telefon?.trim() || null });
  await sendFormLink(user.id, name, email);
  await audit(adminId, "onboarding.invite", user.id, input.role);
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
  return row ? { name: row.user.name, email: row.user.email, role: row.user.role as AuthRole } : null;
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
  await setStatus(row.user.id, "daten_erfasst", { dataSubmittedAt: new Date(), formTokenHash: null, formTokenExpiresAt: null });
  await audit(row.user.id, "onboarding.data_submitted", row.user.id);
  const admins = await db.select({ email: schema.user.email }).from(schema.user).where(eq(schema.user.role, "admin"));
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
  const { ob, user } = await getRow(userId);
  if (ob.status !== "daten_erfasst") throw new Error("Vertrag kann erst nach der Datenerfassung gesendet werden");
  const [p] = await db.select().from(schema.profile).where(eq(schema.profile.userId, userId));
  const doc = await generateContract({
    role: user.role as AuthRole,
    name: user.name,
    email: user.email,
    strasse: p.strasse ?? "",
    plz: p.plz ?? "",
    ort: p.ort ?? "",
    geburtsdatum: p.geburtsdatum ?? "",
    steuernummer: p.steuernummer ?? "",
    kleinunternehmer: p.kleinunternehmer,
  });
  const [first, ...rest] = user.name.split(" ");
  const requestId = await signingProvider().send(doc, { firstName: first, lastName: rest.join(" ") || first, email: user.email });
  await setStatus(userId, "vertrag_versendet", { contractSentAt: new Date(), signatureRequestId: requestId });
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
  const [row] = await db
    .select({ ob: schema.onboarding, user: schema.user })
    .from(schema.onboarding)
    .innerJoin(schema.user, eq(schema.user.id, schema.onboarding.userId))
    .where(eq(schema.onboarding.signatureRequestId, signatureRequestId));
  if (!row) throw new Error("Unbekannte Signaturanfrage");
  if (row.ob.status !== "vertrag_versendet") return; /* doppelte Webhooks ignorieren */
  await setStatus(row.user.id, "unterschrieben", { signedAt: new Date() });
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
  await setStatus(userId, "unterschrieben", { signedAt: new Date(), formTokenHash: null, formTokenExpiresAt: null });
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
  role: string;
  status: OnboardingStatus;
  invitedAt: string;
  updatedAt: string;
  formLinkExpired: boolean;
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
    role: user.role ?? "setter",
    status: ob.status as OnboardingStatus,
    invitedAt: ob.invitedAt.toISOString(),
    updatedAt: ob.updatedAt.toISOString(),
    formLinkExpired: ob.status === "eingeladen" && !!ob.formTokenExpiresAt && ob.formTokenExpiresAt < new Date(),
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

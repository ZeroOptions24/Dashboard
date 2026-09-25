import "server-only";
import { eq } from "drizzle-orm";
import { formatIban, isValidIban, normalizeIban } from "@/lib/iban";
import { decrypt, encrypt } from "./crypto";
import { db, schema } from "./db";
import { appUrl, mailLayout, sendMail } from "./mail";

/* Eigene Stammdaten eines MA. Alle Funktionen arbeiten nur mit der ID der
   angemeldeten Person (siehe src/app/actions/profile.ts) – fremde Daten sind
   hierüber nicht erreichbar. */

export interface MyProfile {
  name: string;
  email: string;
  role: string;
  memberSince: string | null;
  telefon: string;
  geburtsdatum: string;
  strasse: string;
  plz: string;
  ort: string;
  ibanMasked: string;
  kontoinhaber: string;
  steuernummer: string;
  kleinunternehmer: boolean;
  gewerbeAngemeldet: boolean;
}

const fmtDate = (iso: string | null) => (iso ? iso.split("-").reverse().join(".") : "");

export async function getMyProfile(userId: string): Promise<MyProfile> {
  const [row] = await db
    .select({ user: schema.user, p: schema.profile, ob: schema.onboarding })
    .from(schema.user)
    .leftJoin(schema.profile, eq(schema.profile.userId, schema.user.id))
    .leftJoin(schema.onboarding, eq(schema.onboarding.userId, schema.user.id))
    .where(eq(schema.user.id, userId));
  if (!row) throw new Error("Nicht gefunden");
  const { user, p, ob } = row;
  const since = ob?.activatedAt ?? ob?.signedAt ?? null;
  return {
    name: user.name,
    email: user.email,
    role: user.role ?? "setter",
    memberSince: since ? since.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) : null,
    telefon: p?.telefon ?? "",
    geburtsdatum: fmtDate(p?.geburtsdatum ?? null),
    strasse: p?.strasse ?? "",
    plz: p?.plz ?? "",
    ort: p?.ort ?? "",
    ibanMasked: p?.ibanLast4 ? `•••• •••• •••• •••• ${p.ibanLast4}` : "",
    kontoinhaber: p?.kontoinhaber ?? "",
    steuernummer: p?.steuernummer ?? "",
    kleinunternehmer: p?.kleinunternehmer ?? false,
    gewerbeAngemeldet: p?.gewerbeAngemeldet ?? false,
  };
}

/** Eigene IBAN im Klartext (nur auf ausdrücklichen Klick). */
export async function revealMyIban(userId: string): Promise<string> {
  const [p] = await db.select({ ibanEnc: schema.profile.ibanEnc }).from(schema.profile).where(eq(schema.profile.userId, userId));
  return p?.ibanEnc ? formatIban(decrypt(p.ibanEnc)) : "";
}

export interface ProfileUpdate {
  telefon: string;
  strasse: string;
  plz: string;
  ort: string;
  /** leer = IBAN unverändert lassen */
  iban: string;
  kontoinhaber: string;
  steuernummer: string;
  kleinunternehmer: boolean;
  gewerbeAngemeldet: boolean;
}

export type ProfileErrors = Partial<Record<keyof ProfileUpdate, string>>;

export async function updateMyProfile(userId: string, d: ProfileUpdate): Promise<{ ok: true; ibanChanged: boolean } | { ok: false; errors: ProfileErrors }> {
  const e: ProfileErrors = {};
  if (!d.telefon.trim()) e.telefon = "Telefon fehlt";
  if (!d.strasse.trim()) e.strasse = "Straße und Hausnummer fehlt";
  if (!/^\d{5}$/.test(d.plz.trim())) e.plz = "Bitte 5-stellige PLZ";
  if (!d.ort.trim()) e.ort = "Ort fehlt";
  if (!d.kontoinhaber.trim()) e.kontoinhaber = "Kontoinhaber fehlt";
  const newIban = d.iban.trim() ? normalizeIban(d.iban) : null;
  if (newIban && !isValidIban(newIban)) e.iban = "IBAN ist ungültig – bitte prüfen";
  if (Object.keys(e).length) return { ok: false, errors: e };

  const [old] = await db.select({ ibanEnc: schema.profile.ibanEnc }).from(schema.profile).where(eq(schema.profile.userId, userId));
  const ibanChanged = !!newIban && (!old?.ibanEnc || decrypt(old.ibanEnc) !== newIban);
  await db
    .update(schema.profile)
    .set({
      telefon: d.telefon.trim(),
      strasse: d.strasse.trim(),
      plz: d.plz.trim(),
      ort: d.ort.trim(),
      kontoinhaber: d.kontoinhaber.trim(),
      steuernummer: d.steuernummer.trim() || null,
      kleinunternehmer: d.kleinunternehmer,
      gewerbeAngemeldet: d.gewerbeAngemeldet,
      ...(ibanChanged && newIban ? { ibanEnc: encrypt(newIban), ibanLast4: newIban.slice(-4) } : {}),
      updatedAt: new Date(),
    })
    .where(eq(schema.profile.userId, userId));
  await db.insert(schema.auditLog).values({ actorId: userId, action: ibanChanged ? "profile.update_iban" : "profile.update", targetUserId: userId });

  if (ibanChanged && newIban) {
    /* Schutz vor Konto-Übernahme: Person und Admins erfahren sofort von der neuen Bankverbindung */
    const [u] = await db.select({ name: schema.user.name, email: schema.user.email }).from(schema.user).where(eq(schema.user.id, userId));
    await sendMail(
      u.email,
      "Deine Bankverbindung wurde geändert",
      mailLayout({
        title: "Neue Bankverbindung gespeichert",
        intro: `Deine IBAN im MB-Dashboard wurde auf •••• ${newIban.slice(-4)} geändert. Künftige Provisionen gehen auf dieses Konto.`,
        outro: "Warst du das nicht? Melde dich bitte sofort bei EnergyEngel.",
      }),
    );
    const admins = await db.select({ email: schema.user.email }).from(schema.user).where(eq(schema.user.role, "admin"));
    for (const a of admins)
      await sendMail(
        a.email,
        `${u.name} hat die Bankverbindung geändert`,
        mailLayout({
          title: `${u.name} hat die IBAN geändert`,
          intro: `Neue IBAN endet auf ${newIban.slice(-4)}. Bitte vor der nächsten Auszahlung kurz bestätigen lassen.`,
          button: "Im Dashboard öffnen",
          url: `${appUrl()}/?view=team`,
        }),
      );
  }
  return { ok: true, ibanChanged };
}

import { boolean, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/* =====================================================================
   Tabellen für Login (Better Auth) – Felder wie von Better Auth erwartet,
   inkl. Admin-Plugin (role, banned, impersonatedBy).
   ===================================================================== */

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  /** setter | presetter | closer | admin */
  role: text("role"),
  banned: boolean("banned").default(false),
  banReason: text("ban_reason"),
  banExpires: timestamp("ban_expires"),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  impersonatedBy: text("impersonated_by"),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/* =====================================================================
   Onboarding neuer MAs:
   eingeladen → daten_erfasst → vertrag_versendet → unterschrieben → aktiv
   (oder zurueckgezogen). Siehe src/server/onboarding.ts
   ===================================================================== */

export const onboarding = pgTable("onboarding", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("eingeladen"),
  /** SHA-256 des Formular-Links; der Link selbst wird nie gespeichert */
  formTokenHash: text("form_token_hash"),
  formTokenExpiresAt: timestamp("form_token_expires_at"),
  invitedBy: text("invited_by").references(() => user.id, { onDelete: "set null" }),
  invitedAt: timestamp("invited_at").notNull().defaultNow(),
  dataSubmittedAt: timestamp("data_submitted_at"),
  contractSentAt: timestamp("contract_sent_at"),
  /** ID der Signaturanfrage beim Signing-Tool */
  signatureRequestId: text("signature_request_id"),
  signedAt: timestamp("signed_at"),
  accessSentAt: timestamp("access_sent_at"),
  activatedAt: timestamp("activated_at"),
  remindersSent: integer("reminders_sent").notNull().default(0),
  lastReminderAt: timestamp("last_reminder_at"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/** Stammdaten (sensibel). IBAN nur verschlüsselt (AES-256-GCM, src/server/crypto.ts). */
export const profile = pgTable("profile", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  telefon: text("telefon"),
  geburtsdatum: text("geburtsdatum"),
  strasse: text("strasse"),
  plz: text("plz"),
  ort: text("ort"),
  ibanEnc: text("iban_enc"),
  /** letzte 4 Stellen für die maskierte Anzeige */
  ibanLast4: text("iban_last4"),
  kontoinhaber: text("kontoinhaber"),
  steuernummer: text("steuernummer"),
  kleinunternehmer: boolean("kleinunternehmer").notNull().default(false),
  gewerbeAngemeldet: boolean("gewerbe_angemeldet").notNull().default(false),
  datenschutzAkzeptiertAt: timestamp("datenschutz_akzeptiert_at"),
  /** Name, den n8n ins Pipedrive-Deal-Feld „Setter“ schreibt (Zuordnung der Leads) */
  pipedriveSetterName: text("pipedrive_setter_name"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/** Protokoll sensibler Zugriffe und Aktionen (z. B. IBAN angezeigt, Vertrag gesendet). */
export const auditLog = pgTable("audit_log", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  actorId: text("actor_id"),
  action: text("action").notNull(),
  targetUserId: text("target_user_id"),
  detail: text("detail"),
  at: timestamp("at").notNull().defaultNow(),
});

/** Ausgehende E-Mails. Ohne SMTP-Zugang (Entwicklung) landen sie nur hier → /dev/postfach. */
export const outbox = pgTable("outbox", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  to: text("to").notNull(),
  subject: text("subject").notNull(),
  html: text("html").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  sentAt: timestamp("sent_at"),
  error: text("error"),
});

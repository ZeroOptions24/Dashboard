import { boolean, index, integer, pgTable, primaryKey, real, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

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
  /** Zwei-Faktor-Anmeldung eingerichtet (Plugin two-factor) */
  twoFactorEnabled: boolean("two_factor_enabled").default(false),
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

/** Zwei-Faktor-Anmeldung: TOTP-Geheimnis und Ersatz-Codes (von Better Auth verschlüsselt gespeichert) */
export const twoFactor = pgTable("two_factor", {
  id: text("id").primaryKey(),
  secret: text("secret").notNull(),
  backupCodes: text("backup_codes").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  verified: boolean("verified").default(true),
  failedVerificationCount: integer("failed_verification_count").default(0),
  lockedUntil: timestamp("locked_until"),
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
  /** Bestehende MAs mit Vertrag: nach der Datenerfassung direkt Zugang, ohne Vertragsschritt */
  skipContract: boolean("skip_contract").notNull().default(false),
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
  /** Code aus dem bisherigen Setter-Link (?setter=…) – darüber ordnet n8n neue Leads dem Setter zu */
  setterCode: text("setter_code"),
  /** Monatsziel Verdienst in Euro (vom MA selbst eingestellt) */
  moneyGoal: integer("money_goal"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/** Verträge zur elektronischen Unterschrift (Onboarding und später weitere Unterlagen) */
export const contract = pgTable("contract", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  /** JSON-Liste der enthaltenen Unterlagen, z. B. ["Handelsvertretervertrag (§ 84 HGB)", …] */
  documents: text("documents").notNull(),
  /** offen | unterschrieben | storniert */
  status: text("status").notNull().default("offen"),
  signatureRequestId: text("signature_request_id").unique(),
  /** erzeugtes PDF (base64) – nach der Unterschrift später durch das signierte PDF ersetzen */
  pdfBase64: text("pdf_base64"),
  sentBy: text("sent_by").references(() => user.id, { onDelete: "set null" }),
  sentAt: timestamp("sent_at").notNull().defaultNow(),
  signedAt: timestamp("signed_at"),
  question: text("question"),
  questionAt: timestamp("question_at"),
  lastReminderAt: timestamp("last_reminder_at"),
});

/* =====================================================================
   Team-Alltag: Benachrichtigungen, Events, Closer-Kalender, Ranglisten, Auszahlungen.
   Leads selbst liegen in Pipedrive (lead_id = „PD-<Deal-ID>“).
   ===================================================================== */

const userRef = (name: string) =>
  text(name)
    .notNull()
    .references(() => user.id, { onDelete: "cascade" });

/** Glocke oben rechts. status = Lead-Status für die Farbe (optional) */
export const notification = pgTable(
  "notification",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    userId: userRef("user_id"),
    text: text("text").notNull(),
    status: text("status"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    readAt: timestamp("read_at"),
  },
  (t) => [index("notification_user_idx").on(t.userId, t.createdAt)],
);

export const teamEvent = pgTable("team_event", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  /** „JJJJ-MM-TT“ */
  date: text("date").notNull(),
  time: text("time").notNull(),
  ort: text("ort").notNull(),
  type: text("type").notNull(),
  /** Alle | Setter | Presetter | Closer */
  target: text("target").notNull(),
  description: text("description").notNull().default(""),
  createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const eventRsvp = pgTable(
  "event_rsvp",
  {
    eventId: text("event_id")
      .notNull()
      .references(() => teamEvent.id, { onDelete: "cascade" }),
    userId: userRef("user_id"),
  },
  (t) => [primaryKey({ columns: [t.eventId, t.userId] })],
);

/** Freie Stunde im Closer-Kalender */
export const closerSlot = pgTable(
  "closer_slot",
  {
    id: text("id").primaryKey(),
    closerId: userRef("closer_id"),
    date: text("date").notNull(),
    start: integer("start").notNull(),
  },
  (t) => [uniqueIndex("closer_slot_unique").on(t.closerId, t.date, t.start)],
);

/** Termin beim Kunden: erst = Ersttermin (Presetter/Setter bucht Slot), closing = 2. Termin */
export const appointment = pgTable(
  "appointment",
  {
    id: text("id").primaryKey(),
    leadId: text("lead_id").notNull(),
    closerId: userRef("closer_id"),
    kind: text("kind").notNull(),
    date: text("date").notNull(),
    /** Stunde, z. B. 14 oder 14.5 */
    start: real("start").notNull(),
    dur: real("dur").notNull().default(1.5),
    ort: text("ort").notNull().default(""),
    /** Kundenname zur Anzeige, falls der Lead (noch) nicht geladen ist */
    kunde: text("kunde"),
    feedbackResult: text("feedback_result"),
    feedbackNote: text("feedback_note"),
    feedbackAt: timestamp("feedback_at"),
    /** vom Setter an der Tür nur vorgemerkt – erst die Bestätigung durch den Presetter bucht ihn (Closer wird dann informiert) */
    reserved: boolean("reserved").notNull().default(false),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("appointment_closer_idx").on(t.closerId, t.date)],
);

/** Wettbewerb (z. B. Wärmepumpen-Cup). Genau einer ist aktiv (archivedAt = null). */
export const board = pgTable("board", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  unit: text("unit").notNull(),
  goal: integer("goal"),
  /** „TT.MM.JJJJ“ */
  ends: text("ends").notNull(),
  /** JSON [[userId, Wert], …] */
  rows: text("rows").notNull().default("[]"),
  /** JSON [[Schwelle, Prämie], …] */
  prizes: text("prizes").notNull().default("[]"),
  /** JSON [5, 10] – Prämienstufen auf der Leiste */
  marks: text("marks").notNull().default("[]"),
  publishedAt: timestamp("published_at"),
  publishedBy: text("published_by").references(() => user.id, { onDelete: "set null" }),
  archivedAt: timestamp("archived_at"),
});

/** Monatsabrechnung eines MAs. Positionen als JSON [[Datum, Kunde, Text, Betrag, Status], …] */
export const payout = pgTable(
  "payout",
  {
    id: text("id").primaryKey(),
    userId: userRef("user_id"),
    periode: text("periode").notNull(),
    betrag: integer("betrag").notNull(),
    /** pruefung | freigegeben | ausgezahlt */
    status: text("status").notNull().default("pruefung"),
    /** geplantes bzw. tatsächliches Auszahlungsdatum „TT.MM.JJJJ“ */
    datum: text("datum").notNull(),
    posten: text("posten").notNull().default("[]"),
    releasedBy: text("released_by").references(() => user.id, { onDelete: "set null" }),
    releasedAt: timestamp("released_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("payout_user_idx").on(t.userId)],
);

/** Was im Dashboard an einem Pipedrive-Lead passiert ist (Anrufversuch, Rückruf, Status, Notiz, Vorqualifizierung).
 *  Grundlage für Presetter-Pool, Verlauf und Kennzahlen. kind: attempt | callback | status | note | vq */
export const leadActivity = pgTable(
  "lead_activity",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    leadId: text("lead_id").notNull(),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    /** Rolle, in der gehandelt wurde */
    role: text("role").notNull(),
    kind: text("kind").notNull(),
    /** Anzeige im Verlauf */
    text: text("text").notNull(),
    /** JSON mit Details (Status, Grund, Rückruf-Zeit, VQ-Antworten …) */
    data: text("data").notNull().default("{}"),
    /** Ergebnis des Zurückschreibens nach Pipedrive: null = nicht nötig/aus, „ok“ oder Fehlertext */
    pipedrive: text("pipedrive"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("lead_activity_lead_idx").on(t.leadId, t.createdAt), index("lead_activity_user_idx").on(t.userId, t.createdAt)],
);

/** Setter-Zuweisung im Dashboard für Deals ohne Setter in Pipedrive (Pipedrive selbst bleibt unverändert).
 *  setter_name wie im Pipedrive-Feld „Setter“ – wird wie dieses dem Konto zugeordnet. */
export const setterAssignment = pgTable("setter_assignment", {
  leadId: text("lead_id").primaryKey(),
  setterName: text("setter_name").notNull(),
  assignedBy: text("assigned_by").references(() => user.id, { onDelete: "set null" }),
  assignedAt: timestamp("assigned_at").notNull().defaultNow(),
});

/** Wer einen Lead gerade im Telefonleitfaden offen hat (kurze, sich verlängernde Sperre) */
export const leadLock = pgTable("lead_lock", {
  leadId: text("lead_id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  since: timestamp("since").notNull().defaultNow(),
  until: timestamp("until").notNull(),
});

/** Einstellungen der App (z. B. die vom Dashboard angelegte Pipedrive-Pipeline mit Stufen und Feldern) */
export const appSetting = pgTable("app_setting", {
  key: text("key").primaryKey(),
  /** JSON */
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/** Leads, die im Dashboard erfasst wurden („Lead erfassen“). Das Dashboard ist hier die Quelle der Wahrheit;
 *  Person und Deal in Pipedrive (neue Pipeline) werden daraus angelegt und aktuell gehalten. */
export const ownLead = pgTable(
  "own_lead",
  {
    /** Lead-ID im Dashboard: „MB-…“ */
    id: text("id").primaryKey(),
    setterId: text("setter_id").references(() => user.id, { onDelete: "set null" }),
    /** eingereicht | termin | checks | verkauft | abgesagt | verloren */
    status: text("status").notNull().default("eingereicht"),
    reason: text("reason"),
    reasonNote: text("reason_note"),
    anrede: text("anrede"),
    vorname: text("vorname").notNull(),
    nachname: text("nachname").notNull(),
    telefon: text("telefon").notNull(),
    email: text("email"),
    strasse: text("strasse").notNull(),
    hausnummer: text("hausnummer").notNull(),
    plz: text("plz").notNull(),
    ort: text("ort").notNull(),
    /** JSON-Liste, z. B. ["Wärmepumpe"] */
    themen: text("themen").notNull().default("[]"),
    entscheider: text("entscheider"),
    rueckrufDatum: text("rueckruf_datum"),
    rueckrufUhrzeit: text("rueckruf_uhrzeit"),
    /** JSON-Liste */
    zeitfenster: text("zeitfenster").notNull().default("[]"),
    notizen: text("notizen"),
    gpsLat: real("gps_lat"),
    gpsLon: real("gps_lon"),
    /** Vorqualifizierung (JSON Feldname → Antwort) */
    vq: text("vq").notNull().default("{}"),
    pdPersonId: integer("pd_person_id"),
    pdDealId: integer("pd_deal_id"),
    /** letzter Abgleich mit Pipedrive; Fehlertext, wenn er nicht geklappt hat */
    syncedAt: timestamp("synced_at"),
    syncError: text("sync_error"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("own_lead_setter_idx").on(t.setterId), index("own_lead_status_idx").on(t.status)],
);

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

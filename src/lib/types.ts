/* Datenmodell des MB-Dashboards.
   Diese Typen sind die Schnittstelle zwischen Oberfläche und Datenquelle:
   heute Beispieldaten (demo-data.ts), später Datenbank, Pipedrive und Yousign. */

/* ---------- Personen & Rollen ---------- */
export type Role = "setter" | "presetter" | "closer" | "admin";

/** Kurzschlüssel einer Person, z. B. "romy" – später die Benutzer-ID. */
export type PersonKey = string;

export interface Person {
  key: PersonKey;
  name: string;
  first: string;
  role: Role;
  initials: string;
}

/** Stammdaten (sensibel – nur eigene Ansicht bzw. Admin). */
export interface Profile {
  name: string;
  geb: string;
  tel: string;
  mail: string;
  str: string;
  plz: string;
  ort: string;
  iban: string;
  inhaber: string;
  bank: string;
  steuer: string;
  /** Kleinunternehmerregelung (§ 19 UStG) */
  klein: boolean;
  gewerbe: string;
  start: string;
}

export interface TeamMember {
  key: PersonKey;
  status: "aktiv" | "onboarding";
}

/* ---------- Leads & Pipeline ---------- */
export type ProductKey = "wp";

export type StatusKey =
  | "eingereicht"
  | "terminierung"
  | "aufmass"
  | "checks"
  | "verkaufstermin"
  | "verkauft"
  | "ausgezahlt"
  | "abgesagt"
  | "verloren";

export type Tone = "set" | "term" | "closing" | "done" | "paid" | "bad" | "ok" | "warn" | "info";

export interface StatusDef {
  label: string;
  /** grobe Phase: 1 Presetting · 2 Aufmaß · 3 Checks/Verkaufstermin · 4 Verkauf · 5 Ausgezahlt */
  stage: number;
  tone: Tone;
  /** Ausstieg mit Pflichtgrund (Abgesagt / Verloren) */
  fail?: boolean;
  /** Wann der Ausstieg passiert ist (nur bei fail) */
  phase?: string;
}

/** Verlaufseintrag: [Text, Zeitstempel „TT.MM. hh:mm“] */
export type HistoryEntry = [text: string, stamp: string];

export interface Lead {
  id: string;
  /** Deal-ID in Pipedrive, null = noch nicht angelegt */
  pd: number | null;
  kunde: string;
  anrede: string;
  /** maskierte Nummer (für alle) */
  tel: string;
  /** volle Nummer – liefert der Server nur an Rollen, die anrufen (Admin, zuständiger Closer) */
  telFull?: string;
  ort: string;
  /** „Straße Nr, PLZ Ort“ */
  adresse?: string;
  email?: string;
  /** Rückruf-/Terminwunsch von der Haustür (Text, z. B. „Abends (18–20 Uhr)“) */
  rueckrufWunsch?: string;
  /** Standort beim Erfassen an der Haustür */
  gps?: { lat: number; lon: number };
  produkt: ProductKey;
  status: StatusKey;
  setter: PersonKey;
  /** Setter kommt aus einer Zuweisung im Dashboard (in Pipedrive leer) */
  setterFromDashboard?: boolean;
  presetter?: PersonKey;
  closer?: PersonKey;
  /** Eingangsdatum „TT.MM.JJJJ“ */
  datum: string;
  setNote: string;
  preNote: string;
  hist: HistoryEntry[];
  attempts: number;
  nextTry: string | null;
  reason: string | null;
  reasonNote: string;
  eigenlead: boolean;
  entscheider?: string;
  /** Pipedrive: angelegt / letzte Stufen- bzw. Statusänderung (ISO, UTC) – für den Abgleich mit Dashboard-Aktionen */
  pdAddTime?: string;
  pdChangedAt?: string;
  /** Antworten aus der Vorqualifizierung (Feldnamen wie im Formular wp-vorqual) */
  vq?: Record<string, string>;
  /** Fragen der Vorqualifizierung, die der Setter schon an der Haustür beantwortet hat (der Presetter fragt nur den Rest) */
  door?: string[];
  /** Kunden-ID im Enpal-Partnerportal (EPP) – trägt der Presetter nach der Anlage im EPP ein */
  eppId?: string;
  themen?: string[];
}

/* ---------- Closer-Kalender ---------- */
export interface AppointmentFeedback {
  result: string;
  at: string;
  note?: string;
}

export interface Appointment {
  id: string;
  lead: string;
  closer: PersonKey;
  /** erst = Aufmaßtermin (vom Presetter gelegt), closing = Verkaufstermin */
  kind: "erst" | "closing";
  /** „JJJJ-MM-TT“ */
  date: string;
  /** Stunde, z. B. 14 oder 14.5 */
  start: number;
  dur: number;
  adr?: string;
  ort: string;
  /** Pflicht-Rückmeldung des Closers nach dem Termin */
  feedback: AppointmentFeedback | null;
  /** vom Setter nur vorgemerkt – der Presetter bestätigt (Zwei-Schritte-System) */
  reserved?: boolean;
}

export interface Slot {
  id: string;
  closer: PersonKey;
  date: string;
  start: number;
}

/* ---------- Auszahlungen & Verträge ---------- */
export type PayoutStatusKey = "pruefung" | "freigegeben" | "ausgezahlt";

/** Position einer Abrechnung (Schnappschuss beim Stichtag) */
export interface PayoutItem {
  /** „TT.MM.JJJJ“ (fest seit bzw. storniert am) */
  datum: string;
  kunde: string;
  anlass: string;
  betrag: number;
  status: "fest" | "storno";
  grund?: string | null;
  provisionId?: string;
}

/** Provisionsposten (Ablauf A11): wartet auf TBK → fest → Abrechnung; oder Storno mit Grund */
export interface ProvisionItem {
  id: string;
  user: PersonKey;
  role: string;
  lead: string;
  kunde: string;
  anlass: string;
  betrag: number;
  status: "tbk" | "fest" | "storno";
  grund?: string | null;
  /** in dieser Abrechnung enthalten (sonst noch offen) */
  payoutId?: string | null;
  frage?: string | null;
  antwort?: string | null;
  /** entstanden am „TT.MM.JJJJ“ */
  datum: string;
}

export interface Payout {
  id: string;
  periode: string;
  betrag: number;
  status: PayoutStatusKey;
  datum: string;
  posten: PayoutItem[];
  /** Netto und Umsatzsteuer (0 bei Kleinunternehmern); betrag = netto + ust */
  netto?: number | null;
  ust?: number | null;
  /** z. B. „IBAN fehlt“ – Freigabe erst, wenn behoben */
  hinweis?: string | null;
  /** letzte 4 Stellen der IBAN (echte Daten; Beispieldaten nutzen PROFILES) */
  ibanLast4?: string | null;
}

export interface Contract {
  id: string;
  who: PersonKey;
  doc: string;
  status: "open" | "signed";
  sent: string;
  signed: string | null;
  question?: string;
}

/* ---------- Events, Ranglisten, Benachrichtigungen ---------- */
export interface TeamEvent {
  id: string;
  title: string;
  date: string;
  time: string;
  ort: string;
  type: string;
  target: string;
  desc: string;
  going: PersonKey[];
  by: PersonKey;
  isNew?: boolean;
}

export interface Board {
  title: string;
  unit: string;
  goal: number | null;
  ends: string;
  published: string;
  by: string;
  rows: [PersonKey, number][];
  /** [Schwelle, Prämie] */
  prizes: [string, string][];
  /** Prämienstufen auf der Fortschrittsleiste */
  marks: number[];
}

export interface BoardArchiveEntry {
  title: string;
  winner: string;
  total: string;
  date: string;
}

export interface Notification {
  t: string;
  time: string;
  status: StatusKey | null;
  unread: boolean;
}

/* ---------- Leitfaden & Kennzahlen ---------- */
export interface CallGuide {
  intro: string;
  questions: string[];
  /** [Einwand, Antwort] */
  objections: [string, string][];
  close: string;
}

export interface MbStats {
  key: PersonKey;
  leads: number;
  termin: number;
  checks: number;
  verkauft: number;
  last: string;
  /** Tage seit dem letzten Lead */
  days: number;
}

/** Kennzahlen des laufenden Monats für die Admin-Übersicht */
export interface AdminKpi {
  monat: string;
  vormonat: string;
  /** eingereichte Leads im Monat */
  leads: number;
  leadsVormonat: number;
  /** davon mit Aufmaßtermin / in den Checks oder weiter / mit Verkaufstermin oder weiter / verkauft */
  termin: number;
  checks: number;
  verkaufstermin: number;
  verkauft: number;
  /** Leads, die diese Woche in die Checks gekommen sind */
  checksWoche: number;
}

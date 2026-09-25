import "server-only";
import type { StatusKey } from "@/lib/types";

/* Zuordnung zwischen Pipedrive und Dashboard.
   Stand: Pipeline „Empfehlung kommt“ (ID 21), Felder wie in den n8n-Workflows
   (EnergyEngel/.n8n-*-field-keys.json). Bei Änderungen in Pipedrive hier anpassen. */

export const PIPEDRIVE_PIPELINE_ID = 21;

/** Pipedrive-Stufe → Dashboard-Status (fachlich bestätigt am 25.09.2026). */
export const STAGE_TO_STATUS: Record<number, StatusKey> = {
  180: "eingereicht", // Empfehlung kommt
  248: "eingereicht", // QUALI
  245: "eingereicht", // Kontaktieren
  249: "eingereicht", // Kontaktieren 2
  181: "termin", // An Mitarbeiter übergeben
  182: "termin", // Mitarbeiter in Bearbeitung
  183: "checks", // Checks
  184: "verkauft", // Verkauf
  247: "abgesagt", // Später Interessant
  246: "abgesagt", // Anderes Potential
  234: "abgesagt", // Ablehnung
};

/** Anrufversuche aus der Stufe ableiten („Kontaktieren 2“ = zweiter Versuch). */
export const STAGE_ATTEMPTS: Record<number, number> = { 245: 1, 249: 2 };

/** Eigene Deal-Felder (Schlüssel aus Pipedrive). */
export const DEAL_FIELDS = {
  /** Setter-Name, von n8n beim Anlegen gesetzt („Setter auflösen“) */
  setter: "3142c8c9e9e0bf916f449d2918b8baa84b6590ba",
  /** VQ Geplanter Termin */
  termin: "eb74eb288ec48cb5c87cb236e3131e3982247eb9",
  /** VQ Berater (Closer) */
  berater: "b26e5007fe5d58e224227bf142eac5384c826c96",
} as const;

/** Dashboard ist vorerst nur auf Wärmepumpen ausgelegt – Deal-Titel „Wärmepumpe – Name“.
 *  PV und weitere Produkte kommen später dazu (entschieden 25.09.2026). */
export const PRODUCT_TITLE_PREFIX = { wp: "Wärmepumpe" } as const;

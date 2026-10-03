import "server-only";
import type { StatusKey } from "@/lib/types";

/* Zuordnung zwischen Pipedrive und Dashboard.
   Stand: Pipeline „Empfehlung kommt“ (ID 21), Felder wie in den n8n-Workflows
   (EnergyEngel/.n8n-*-field-keys.json). Bei Änderungen in Pipedrive hier anpassen. */

export const PIPEDRIVE_PIPELINE_ID = 21;

/** Pipedrive-Stufe → Dashboard-Status (fachlich bestätigt am 25.09.2026; „Termin gelegt“ heißt seit 03.10. „Aufmaßtermin“).
 *  Kontaktieren/Kontaktieren 2 mit Versuchen werden in leads.ts zur „Terminierung“. */
export const STAGE_TO_STATUS: Record<number, StatusKey> = {
  180: "eingereicht", // Empfehlung kommt
  248: "eingereicht", // QUALI
  245: "eingereicht", // Kontaktieren
  249: "eingereicht", // Kontaktieren 2
  181: "aufmass", // An Mitarbeiter übergeben
  182: "aufmass", // Mitarbeiter in Bearbeitung
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

/** Deal-Titel, die als Wärmepumpen-Lead zählen. Enpal-Deals („Enpal – Name“) zählen genauso
 *  (entschieden 01.10.2026: gleicher Leitfaden, gleiche Provision). */
export const WP_TITLE_PREFIXES = [PRODUCT_TITLE_PREFIX.wp, "Enpal"] as const;

/** Vorqualifizierung: Dashboard-Feldname (src/lib/vq.ts) → Pipedrive-Deal-Feld (angelegt von n8n wp-vorqual,
 *  Schlüssel aus EnergyEngel/.n8n-vq-field-keys.json). Alles Textfelder. */
export const VQ_DEAL_FIELDS: Record<string, string> = {
  haustyp: "78f2e3419d3b7ab4df9821f3cb3aba75c3371dc9", // VQ Haustyp
  gebaeudeart: "37f272e5b33c037b435992cfa8554d3d115ccfa1", // VQ Gebäudeart
  geschosse: "3864b2b60a85dc8455084a2d683ded28f29c474b", // VQ Geschosse
  wohneinheiten: "bb8b300d00988f99e6d08fc1828e390eecf27119", // VQ Wohneinheiten
  personen_haus: "e0c5e1280d9b9434ba6a89e9791d926569f108fe", // VQ Personen im Haus
  personen_u18: "208e487b70470e063658244d20e77e31bae92f6f", // VQ Personen unter 18
  baumassnahmen: "16a33e6214ce422fe2afa556cffacf418f52e0fe", // VQ Baumaßnahmen
  wohnflaeche: "a18aeb8b11a681ca6c4222a80306fd59ea94ae43", // VQ Wohnfläche m2
  baujahr_haus: "593da9b1f8a1581d0ddcca7c17e7b86210164e65", // VQ Baujahr Haus
  fassade_gedaemmt: "4150792a5e198af89f387b04652081ddde0c018c", // VQ Fassade gedämmt
  fassade_daemmung_art: "105a2d2568a1d67ef17df3b1f0b5c4e3d9cc11fe", // VQ Fassade Art Dicke
  fassade_daemmung_jahr: "3d73fae861a3c074fa14ed118f87fe42e1783056", // VQ Fassade Jahr
  dach_gedaemmt: "cb367456a0619f7a0a72263f1dc4db723a2fb9cc", // VQ Dach gedämmt
  dach_daemmung_ort: "e5b4550daa4300bb9c7d8b716b1683418fd803e2", // VQ Dach Ort
  dach_daemmung_art: "5b1c1ed35c8da083d30f1378042a62aedea6770e", // VQ Dach Art Dicke
  dach_daemmung_jahr: "ccdb8d0e97422c6085a786429a15860f9cca6968", // VQ Dach Jahr
  fenster: "966bc094d17787f5a82efa017738ed941d7bfa3e", // VQ Fenster
  heizungsart: "d59714f17a79a27e37dad80a46c865017ca54ac8", // VQ Heizungsart
  heizungsart_2: "b0fdcf8e98238bfe5862a163e914450d917f399f", // VQ Heizungsart 2
  oelverbrauch: "be80b8758916af184bed6354efb923d43f0d252d", // VQ Ölverbrauch Liter
  h1_kwh: "be3d058e6b76f408f00af5b58d308924af7fb694", // VQ Heizverbrauch kWh Jahr (Gas, Gas-Etage, Fernwärme)
  heizung_baujahr: "401dfb4b9e13253f6f4d297c4c5e509b5370cb0a", // VQ Baujahr Heizung
  heizung_funktionstuechtig: "699e88a7f3ef8472391bf9e5b5a694c816a4eb36", // VQ Heizung funktionstüchtig
  heizraum: "8052bf610756d779389d3daec26e425371f7e239", // VQ Heizraum
  heizverteilung: "b1f745926072bdfbaaeea29c401b84475d2f6beb", // VQ Heizverteilung
  warmwasser: "dcce43c421c8c321b7176d201a6387bd0b0769fe", // VQ Warmwasser
  solarthermie: "9cc49b1a62def66c0c24dcc22eb60a8f07c92e50", // VQ Solarthermie
  wasserg_kamin: "9eed319e0f8da4d4325308590158747c478928a2", // VQ Wassergeführter Kamin
  energiekosten_heizung: "23f61ff9a05dda250b20495f4bb2e4d50d6681d2", // VQ Energiekosten Heizung ct kWh
  stromkosten: "c3b168422b9b763aa32264bb3985b23644259f4b", // VQ Stromkosten ct kWh
  pv_anlage: "f5548c6a84f1b5428868f9521168338384e9297b", // VQ PV-Anlage
  eigentuemer: "30f7aaf1f10b38b355c31ef331b259b9b71bb54a", // VQ Eigentümer
  zweiter_eigentuemer: "3aa9dd476bad95daf1ae7d14240c728e646dd13f", // VQ Zweiter Eigentümer
  selbst_bewohnt: "048acd7a96cddf1f29dd739d1d4082c0533b692c", // VQ Selbst bewohnt
  haushaltseinkommen: "e11bd3aa4257d63e57364c94b66bddd979dc4dad", // VQ Haushaltseinkommen
  smartphone: "34aa155df50e64ec352d8025e73ec10a31307915", // VQ Smartphone
};

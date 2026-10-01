import { describe, expect, it } from "vitest";
import { isLeadNote, parseLeadNote } from "@/server/pipedrive/note";

/* Lead-Notiz von n8n (wp-lead) zerlegen – Format wie im Workflow „Daten zusammenführen“, erfundene Daten */

const note = [
  "<b>WÄRMEPUMPE – NEUER LEAD (Türgeschäft)</b>",
  "",
  "<b>Eingegangen:</b> 19.9.2026, 11:11:14",
  "<b>Quelle:</b> Türgeschäft Lead-Formular",
  "",
  "<b>── KONTAKT ──</b>",
  "<b>Anrede:</b> Herr",
  "<b>Name:</b> Erik Beispiel",
  "<b>Telefon:</b> 0170 1234567",
  "<b>E-Mail:</b> erik@beispiel.test",
  "<b>Adresse:</b> Musterweg 24a, 01156 Dresden Gompitz",
  "",
  "<b>── TERMIN ──</b>",
  "<b>Thema:</b> Wärmepumpe, PV",
  "<b>Alle Entscheider dabei:</b> Ja",
  "",
  "<b>── RÜCKRUF / TERMINWUNSCH ──</b>",
  "<b>Wunsch:</b> Mo. 21.09.2026, 10:15 Uhr",
  "",
  "<b>── NOTIZEN DES SETTERS ──</b>",
  "Hund im Garten &amp; Klingel defekt",
  "Gasheizung von 1998",
  "",
  '<b>GPS beim Eintrag:</b> <a href="https://maps.google.com/?q=51.05,13.73">51.05, 13.73</a>',
  "🔗 Vorqualifizierung per Telefon: Leitfaden öffnen",
].join("<br>");

describe("Lead-Notiz aus Pipedrive", () => {
  it("erkennt die Notiz und liest alle Felder", () => {
    expect(isLeadNote(note)).toBe(true);
    expect(isLeadNote("<b>VORQUALIFIZIERUNG AN DER TÜR</b>")).toBe(false);
    expect(parseLeadNote(note)).toEqual({
      eingegangen: "19.9.2026, 11:11:14",
      anrede: "Herr",
      name: "Erik Beispiel",
      telefon: "0170 1234567",
      email: "erik@beispiel.test",
      adresse: "Musterweg 24a, 01156 Dresden Gompitz",
      strasse: "Musterweg 24a",
      plz: "01156",
      ort: "Dresden Gompitz",
      thema: "Wärmepumpe, PV",
      entscheider: "Ja",
      rueckruf: "Mo. 21.09.2026, 10:15 Uhr",
      setterNotiz: "Hund im Garten & Klingel defekt\nGasheizung von 1998",
      gps: { lat: 51.05, lon: 13.73 },
    });
  });

  it("leere Werte und „keine Notizen“ bleiben leer; Zeitfenster statt Wunsch", () => {
    const n = parseLeadNote(
      [
        "<b>── KONTAKT ──</b>",
        "<b>E-Mail:</b> —",
        "<b>── RÜCKRUF / TERMINWUNSCH ──</b>",
        "<b>Zeitfenster:</b> Abends (18–20 Uhr)",
        "<b>── NOTIZEN DES SETTERS ──</b>",
        "<i>keine Notizen eingetragen</i>",
      ].join("<br>"),
    );
    expect(n).toEqual({ rueckruf: "Zeitfenster: Abends (18–20 Uhr)" });
  });
});

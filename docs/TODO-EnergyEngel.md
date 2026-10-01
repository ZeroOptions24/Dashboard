# MB-Dashboard – Offene Punkte, Platzhalter, Entscheidungen

Stand: 30.09.2026. Nach Umstellung von Verträgen, Team-Alltag (Events, Kalender, Wettbewerb, Auszahlungen, Benachrichtigungen) und Team-Verwaltung auf die eigene Datenbank.

**Legende:** 🟢 echt & fertig · 🟡 gebaut, wartet auf Zugang/Inhalt von euch · 🔴 noch Beispiel / nicht angebunden · ❓ Entscheidung nötig

**Zwei Betriebsarten** (`NEXT_PUBLIC_DATA_SOURCE`):

- `demo`: der Prototyp mit erfundenen Beispieldaten, nichts wird gespeichert. Zum Zeigen und für Design-Abgleiche.
- `pipedrive`: echter Betrieb. Leads und Kennzahlen kommen aus Pipedrive, alles andere aus der eigenen Datenbank. Beispieldaten werden nie angezeigt.

---

## 1. Was heute schon echt funktioniert 🟢

| Bereich | Stand |
| --- | --- |
| Login, mehrere Rollen je Person, Passwort vergessen | echt |
| Zwei-Faktor-Anmeldung | echt, freiwillig; Admin-Pflicht gebaut, aber aus (siehe 4.1) |
| Onboarding (Einladen → Daten → Vertrag → Unterschrift → Zugang), auch „hat schon Vertrag → direkt Zugang“ | echt – Mail, Vertrag und Unterschrift noch im Testmodus (siehe 2.) |
| Team-Verwaltung: Liste, Rollen/Name/E-Mail ändern, sperren, löschen, Details + IBAN (mit Protokoll), Liste bestehender MAs übernehmen | echt |
| Mein Konto / Stammdaten (IBAN verschlüsselt, Mail bei IBAN-Änderung) | echt |
| **Verträge**: MA sieht eigene, PDF, Rückfrage; Admin sieht alle, erinnert, klärt Rückfragen, schickt weitere Unterlagen | echt (Unterschrift simuliert bis Yousign steht) |
| **Events**: posten (Admin), Zielgruppe wird benachrichtigt und sieht das Event, Zusagen | echt |
| **Closer-Kalender**: freie Slots eintragen/entfernen, Presetter werden informiert | echt |
| **Termin buchen** (Lead erfassen / Leitfaden): freie Slots aller Closer, Closer wird informiert, keine Doppelbuchung | echt |
| **Rückmeldung Closer** nach dem Termin inkl. 2. Termin; Setter wird informiert; Pausierung bei überfälliger Rückmeldung | echt |
| **Wärmepumpen-Cup**: Stand pflegen und veröffentlichen, alle Teilnehmenden erfahren ihren Platz | echt (Prämien siehe 3.11) |
| **Auszahlungen**: Anzeige je MA, Freigabe durch Admin mit Protokoll + Benachrichtigung | echt – Abrechnungen entstehen aber noch nicht automatisch (3.5) |
| **Glocke / Benachrichtigungen**, gelesen-Status, Monatsziel „Dein Geld“ | echt |
| Pipeline + Kennzahlen aus Pipedrive (Setter, Admin; Closer für Leads mit Termin bei ihnen) | echt, sobald der Pipedrive-Token eingetragen ist |
| Telefonnummern: volle Nummer nur für Admins und den zuständigen Closer, sonst maskiert | echt |
| Automatische Tests (`npm test`, 38 Tests inkl. Rechteprüfungen gegen eine Test-Datenbank) | echt |

---

## 2. Zugänge & Inhalte, die ihr liefern müsst 🟡

| # | Was | Wofür | Wo im Code |
| --- | --- | --- | --- |
| 2.1 | **Server / Hosting** (Frist 23.10.2026) – Empfehlung Hetzner + Coolify | Livegang überhaupt | – |
| 2.2 | **Domain** (z. B. `dashboard.energyengel.com`) | Links in E-Mails, Yousign-Webhook | `BETTER_AUTH_URL` |
| 2.3 | **Schlüssel** `BETTER_AUTH_SECRET`, `DATA_ENCRYPTION_KEY` (sicher aufbewahren – ohne ihn sind IBANs verloren!), `CRON_SECRET` | Sitzungen, IBAN-Verschlüsselung, tägliche Erinnerungen | `.env.example` |
| 2.4 | **E-Mail-Absender + SMTP-Zugang** | alle E-Mails (heute nur Test-Postfach `/dev/postfach`) | `src/server/mail.ts` |
| 2.5 | **Yousign-Konto** (API-Key, Webhook-Secret) – Anbindung ungetestet, erst in der Sandbox prüfen | echte Unterschrift (heute simuliert) | `src/server/signing.ts` |
| 2.6 | **Vertragsvorlagen** vom Anwalt (HV-Vertrag § 84 HGB, Provisionsvereinbarung je Rolle, Datenschutzvereinbarung) | heute wird ein PLATZHALTER-PDF verschickt | `src/server/contracts.ts` |
| 2.7 | **Datenschutzhinweise für MAs** (Text) | Seite `/datenschutz` ist Platzhalter | `src/app/datenschutz/page.tsx` |
| 2.8 | **AV-Verträge** mit Hoster, Yousign, Mail-Anbieter, Pipedrive, n8n | DSGVO | – |
| 2.9 | **Pipedrive-API-Token** + `NEXT_PUBLIC_DATA_SOURCE=pipedrive` | echter Betrieb | `.env` |
| 2.10 | **Pipedrive-Setter-Namen prüfen**: im Team-Bereich je Setter der Name, den n8n ins Feld „Setter“ schreibt (Standard: Vorname). Bei gleichen Vornamen eindeutige Namen (z. B. „Max M.“) | darüber werden Leads, Kennzahlen, Rangliste und Benachrichtigungen dem Konto zugeordnet | Team-Bereich |
| 2.11 | **Bestehendes Team übernehmen** – erst auf dem echten Server (Team → „Bestehende MAs übernehmen“, Haken „hat schon einen Vertrag“). Die Liste gehört **nicht** ins Repository | Zugänge | Team-Bereich |
| 2.12 | **Pipedrive-Firmen-Domain** (`<firma>.pipedrive.com`) | Knopf „In Pipedrive öffnen“ (heute nur Meldung) | `src/components/drawers/Drawers.tsx` |
| 2.14 | **Setter-Link-Codes** je Setter im Team-Bereich eintragen (der `?setter=…`-Teil aus dem bisherigen Link) | sonst legt „Lead erfassen“ keine Leads an bzw. ohne Setter | Team-Bereich |
| 2.15 | Server-Einstellungen: `N8N_WP_LEAD_URL` (= bisheriger wp-lead-Webhook), `STANDARD_PRESETTER_EMAIL` (Aimée), `PIPEDRIVE_WRITE=false` | Lead erfassen, Presetter-Zuordnung | `.env.example` |
| 2.13 | **Maskottchen „Chibi-Engel“ + Logo** | Platzhalter in Seitenleiste und „Weitere Funktion“; Logo ist nur ein „E“ | `AppShell.tsx`, `NeuView.tsx` |

---

## 3. Offene fachliche Entscheidungen ❓

| # | Frage | Warum wichtig |
| --- | --- | --- |
| 3.1 | ✅ entschieden 30.09.: gemeinsamer Presetter-Pool, Standard-Presetter Aimée. ~~Woran erkennt man Presetter in Pipedrive?~~ (Deal-Owner? eigenes Feld?) – Closer sind jetzt über die im Dashboard gebuchten Termine zugeordnet | Ohne das bekommen Presetter im echten Betrieb **keine Leads** (Anrufliste leer, Kennzahlen „–“) |
| 3.2 | ✅ gebaut, aber **aus** (30.09.: in Pipedrive wird vorerst nichts verschoben; `PIPEDRIVE_WRITE` = false / notizen / true). ~~Status-Änderungen zurück nach Pipedrive?~~ Statuswechsel, Rückrufe, Vorqualifizierung und Notizen ändern heute nur die Anzeige im Browser. Termine und Rückmeldungen werden gespeichert, aber nicht nach Pipedrive geschrieben. Vorschlag: per API/n8n zurückschreiben | Kernfunktion Presetting/Closing |
| 3.3 | ✅ gebaut 01.10.: „Lead erfassen“ sendet an denselben wp-lead-Webhook wie das Formular (Setter-Code je Setter). ~~Ersetzt „Lead erfassen“ das bisherige HTML-Formular?~~ Dann schickt das Dashboard an dieselben n8n-Webhooks (`wp-lead`, `wp-vorqual`); der Setter ergibt sich aus dem Login | Heute legt der Assistent den Lead **nur im Browser** an (im echten Betrieb steht „Übertragung nach Pipedrive folgt“) |
| 3.4 | **Closer-Kalender:** eigene Slots im Dashboard (so gebaut und gespeichert) oder zusätzlich Outlook/Calendly? | – |
| 3.5 | **Provision & Auszahlung:** Sätze (Beispiel: Setter/Closer 1.000 € je Verkauf, Presetter 250 € je Termin), Widerrufsfrist, Auszahlung zum 15., Storno-Regeln. **Wer/was erzeugt die Monatsabrechnung?** (Tabelle + Freigabe stehen) | „Dein Geld“, Auszahlungen |
| 3.6 | **Zielwerte:** Terminquote 42 %, Checks 65 %, Verkauf 70 %, 65 Verkäufe/Monat, 5 Leads/Tag, 30 Anrufe/Tag, Erstanruf in 2 Std. | Einfärbung der Kennzahlen (`src/lib/domain.ts`) |
| 3.7 | **Rückmeldefrist Closer 24 Std.** + Sperre neuer Termine bei Überschreitung – so gewollt? | Regel ist aktiv |
| 3.8 | **Verlustgründe** (Listen für „abgesagt“ / „verloren“) | Pflichtauswahl |
| 3.9 | **Anrufversuche:** wie viele, welche Abstände, danach automatisch „abgesagt“? Heute feste Beispieltexte | Presetter-Anrufliste |
| 3.10 | **Benachrichtigungen zusätzlich per E-Mail/WhatsApp (n8n)?** Heute nur Glocke im Dashboard | – |
| 3.11 | **Wettbewerbe:** Prämienstufen und Teamziel (heute Werte aus dem Prototyp: 5/10 Anlagen, 200/500 €, 65 Anlagen); manuell pflegen (so gebaut) oder automatisch aus Pipedrive? Neuen Wettbewerb starten/archivieren fehlt noch | Rangliste |
| 3.12 | **Fragen der Vorqualifizierung (TMVT)** überarbeiten? | `src/lib/vq.ts` |
| 3.13 | **PV und weitere Produkte** – ab wann? (heute nur Wärmepumpe) | Filter, Leitfaden je Produkt |
| 3.14 | **Punkt 2.3 und Schnittstelle 12** aus eurer Planung („Weitere Funktion“) | Platzhalter-Menüpunkt |
| 3.15 | **Löschkonzept:** wann werden Daten ausgeschiedener MAs und alter Leads gelöscht? | DSGVO; Löschen einzelner MAs geht schon |

---

## 4. Sicherheit & Betrieb

| # | Punkt | Stand |
| --- | --- | --- |
| 4.1 | **Zwei-Faktor-Pflicht für Admins einschalten** (`ADMIN_2FA_PFLICHT` in `src/server/auth.ts`), nachdem alle Admins eingerichtet haben | 🟡 aus |
| 4.2 | Tägliche Erinnerungen per Cron im Hosting: `curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://<domain>/api/cron/reminders` | 🟡 |
| 4.3 | Datenbank-Backups (täglich, verschlüsselt, Wiederherstellung testen) | ❓ Hosting |
| 4.4 | Überwachung: Erreichbarkeit, Fehlerprotokoll | ❓ |
| 4.5 | **Repository auf „privat“ stellen** (enthält keine Personendaten, aber Geschäftslogik) | ❓ euer GitHub |
| 4.6 | Datenauskunft (DSGVO-Export je MA) | 🔴 |
| 4.7 | Tests laufen automatisch bei jedem Push (GitHub Actions) | 🔴 heute `npm test` von Hand |

---

## 5. Was noch Beispiel oder Platzhalter ist 🔴

Im echten Betrieb werden keine Beispieldaten angezeigt. Offen sind diese Teile:

| Ansicht | Offen | Hängt an |
| --- | --- | --- |
| Übersicht / Leitfaden **Presetter** | keine Leads, „Ø bis Erstanruf“ und „Terminquote“ zeigen „–“ | 3.1 |
| **Lead erfassen** | Lead nur im Browser; „Adresse per Standort“ füllt eine Beispieladresse | 3.3, GPS + Adress-Suche |
| **Statuswechsel, Rückruf, Vorqualifizierung, Notizen** | nur im Browser | 3.2 |
| **„Dein Geld“** | Provisionsbeträge aus Beispielsätzen | 3.5 |
| **Auszahlungen** | Abrechnungen werden noch nicht erzeugt (Liste bleibt leer) | 3.5 |
| **Anrufe heute** (Presetter) | Zähler nur im Browser | 3.1 / 3.2 |
| **Team-Seitenleiste** aus der Admin-Übersicht | echte Personen öffnen die Team-Verwaltung; die Stammdaten-Leiste gibt es nur mit Beispieldaten | – |
| **„In WhatsApp ankündigen / posten“** (Events, Rangliste) | ohne Funktion | n8n (3.10) |

---

## 6. Abgleich mit eurer Planung („Vertriebs-Funnel & MB-Dashboard – TODOs“)

| Punkt | Stand |
| --- | --- |
| 1.1 Eigener Link pro Setter + Anlege-Tool | 🟡 Anlegen im Dashboard ✓; Setter-Link-Tokens stehen noch fest im n8n-Code → vom Dashboard verwalten lassen oder Login statt Link (3.3) |
| 1.2 TMVT-Fragen anpassen | ❓ 3.12 |
| 1.3 Wann Termin? | ❓ offen |
| 1.4 Status in Pipedrive automatisieren | 🟡 Stufen-Zuordnung bestätigt; Zurückschreiben offen (3.2) |
| 2.1 Leitfaden je Kunde/Produkt | 🟡 Wärmepumpe ✓; PV/Speicher/Energievertrag fehlen |
| 2.2 Status + Benachrichtigung an Setter | 🟡 Benachrichtigung bei Termin/Rückmeldung ✓; Status aus Pipedrive per Webhook offen |
| 2.3 | ❓ 3.14 |
| 3. Closing | 🟢 Kalender, Termine, Pflicht-Rückmeldung gespeichert; Pipedrive-Rückschreiben offen |
| Schnittstellen 1–11 | 1 ✓ · 2 ✓ · 3 🟡 · 4 🔴 · 5 ✓ · 6 🟡 · 7 🟡 · 8 ✓ · 9 ✓ · 10 🔴 · 11 🟡 |
| Schnittstelle 12 | ❓ 3.14 |

---

## 7. Technisch als Nächstes (ohne eure Zuarbeit machbar)

1. Tests automatisch bei jedem Push (GitHub Actions).
2. Wettbewerb: „neuen Wettbewerb starten“ (alten archivieren).
3. Datenauskunft je MA (DSGVO-Export).
4. Hosting-Paket vorbereiten (Dockerfile / Coolify-Anleitung), damit der Umzug bis 23.10. schnell geht.

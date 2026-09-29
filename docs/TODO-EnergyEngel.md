# MB-Dashboard – Offene Punkte, Platzhalter, Entscheidungen

Stand: 29.09.2026. Vollständige Bestandsaufnahme nach dem Umbau auf React (der Prototyp-Code ist komplett ersetzt).

**Legende:** 🟢 echt & fertig · 🟡 gebaut, wartet auf Zugang/Inhalt von euch · 🔴 noch Beispieldaten / nicht angebunden · ❓ Entscheidung nötig

---

## 1. Was heute schon echt funktioniert 🟢

| Bereich | Stand |
| --- | --- |
| Login, Rollen, Passwort vergessen | echt (eigene Datenbank) |
| Zwei-Faktor-Anmeldung | echt, freiwillig; Admin-Pflicht gebaut, aber aus (siehe 4.1) |
| Onboarding neuer MAs (Einladen → Daten → Vertrag → Unterschrift → Zugang) | echt – Mailversand, Vertrag und Unterschrift laufen aber noch im Testmodus (siehe 2.) |
| Stammdaten / Mein Konto (IBAN verschlüsselt, Mail bei IBAN-Änderung) | echt |
| Team-Bereich oben: Einladungen, Status, Pipedrive-Setter-Name, Erinnerungen | echt |
| Pipeline + Kennzahlen aus Pipedrive (Setter & Admin) | echt, sobald der Pipedrive-Token eingetragen ist |

---

## 2. Zugänge & Inhalte, die ihr liefern müsst 🟡

| # | Was | Wofür | Wo im Code |
| --- | --- | --- | --- |
| 2.1 | **Server / Hosting** (Frist 23.10.2026) – Empfehlung Hetzner + Coolify | Livegang überhaupt | – |
| 2.2 | **Domain** (z. B. `dashboard.energyengel.com`) | Links in E-Mails, Yousign-Webhook | `BETTER_AUTH_URL` |
| 2.3 | **Schlüssel** `BETTER_AUTH_SECRET`, `DATA_ENCRYPTION_KEY` (sicher aufbewahren – ohne ihn sind IBANs verloren!), `CRON_SECRET` | Sitzungen, IBAN-Verschlüsselung, tägliche Erinnerungen | `.env.example` |
| 2.4 | **E-Mail-Absender + SMTP-Zugang** | alle E-Mails (heute nur Test-Postfach `/dev/postfach`) | `src/server/mail.ts` |
| 2.5 | **Yousign-Konto** (API-Key, Webhook-Secret) – Anbindung ungetestet, erst in der Sandbox prüfen | echte Unterschrift (heute simuliert) | `src/server/signing.ts` |
| 2.6 | **Vertragsvorlagen** vom Anwalt (HV-Vertrag § 84 HGB, Provisionsvereinbarung je Rolle) | heute wird ein PLATZHALTER-PDF verschickt | `src/server/contracts.ts` |
| 2.7 | **Datenschutzhinweise für MAs** (Text) | Seite `/datenschutz` ist Platzhalter | `src/app/datenschutz/page.tsx` |
| 2.8 | **AV-Verträge** mit Hoster, Yousign, Mail-Anbieter, Pipedrive, n8n | DSGVO | – |
| 2.9 | **Pipedrive-API-Token** + `NEXT_PUBLIC_DATA_SOURCE=pipedrive` | echte Leads & Zahlen | `.env` |
| 2.10 | **Pipedrive-Setter-Namen prüfen**: im Team-Bereich je Setter der Name, den n8n ins Feld „Setter“ schreibt (Standard: Vorname). Bei gleichen Vornamen eindeutige Namen (z. B. „Max M.“) | sonst sieht ein Setter seine Leads nicht | Team-Bereich |
| 2.11 | **Bestehende MAs** (Tim, Florian, Max …) einladen und mit „Direkt freischalten“ ohne neuen Vertrag aktivieren | Zugänge | Team-Bereich |
| 2.12 | **Pipedrive-Firmen-Domain** (`<firma>.pipedrive.com`) | Knopf „In Pipedrive öffnen“ (heute nur Meldung) | `src/components/drawers/Drawers.tsx` |
| 2.13 | **Maskottchen „Chibi-Engel“ + Logo** | Platzhalter in Seitenleiste und „Weitere Funktion“; Logo ist nur ein „E“ | `AppShell.tsx`, `NeuView.tsx` |

---

## 3. Offene fachliche Entscheidungen ❓

| # | Frage | Warum wichtig |
| --- | --- | --- |
| 3.1 | **Woran erkennt man Presetter & Closer in Pipedrive?** (Deal-Owner? Feld „VQ Berater“?) | Ohne das bekommen Presetter/Closer im Pipedrive-Modus keine Leads; Anrufliste und Kennzahlen bleiben Beispiel |
| 3.2 | **Wer ist die „Quelle der Wahrheit“ für Status-Änderungen?** Presetter/Closer ändern den Status heute nur im Dashboard (nicht gespeichert, nicht in Pipedrive). Vorschlag: jede Änderung per API/n8n **nach Pipedrive zurückschreiben** | Kernfunktion Presetting/Closing |
| 3.3 | **Ersetzt „Lead erfassen“ im Dashboard das bisherige HTML-Formular?** Dann schickt das Dashboard an dieselben n8n-Webhooks (`wp-lead`, `wp-vorqual`); der Setter ergibt sich aus dem Login statt aus dem Setter-Link | Heute legt der Assistent den Lead **nur im Browser** an |
| 3.4 | **Closer-Kalender:** eigene Slots im Dashboard (so gebaut) oder Outlook/Calendly anbinden (laut Planung)? | heute Beispieldaten, nicht gespeichert |
| 3.5 | **Provision & Auszahlung:** Sätze (Beispiel: Setter/Closer 1.000 € je Verkauf, Presetter 250 € je Termin), Widerrufsfrist 14 Tage, Auszahlung zum 15. des Folgemonats, Storno-Regeln | „Dein Geld“, Auszahlungen |
| 3.6 | **Zielwerte:** Terminquote 42 %, Checks 65 %, Verkauf 70 %, 65 Verkäufe/Monat, 5 Leads/Tag, 30 Anrufe/Tag, Erstanruf in 2 Std. | Einfärbung der Kennzahlen (`src/lib/domain.ts`, Beispielwerte) |
| 3.7 | **Rückmeldefrist Closer 24 Std.** + Sperre neuer Leads bei Überschreitung – so gewollt? | Regel ist aktiv |
| 3.8 | **Verlustgründe** (Listen für „abgesagt“ / „verloren“) | Pflichtauswahl |
| 3.9 | **Anrufversuche:** wie viele, welche Abstände, danach automatisch „abgesagt“? Heute feste Beispieltexte („Do 24.09. ab 18:00“) | Presetter-Anrufliste |
| 3.10 | **Benachrichtigungen an MAs:** E-Mail, WhatsApp (n8n) oder nur im Dashboard? | heute nur Glocke (Beispiel) |
| 3.11 | **Wettbewerbe:** Wärmepumpen-Cup manuell pflegen (so gebaut) oder automatisch aus Pipedrive? Prämienstufen? | Rangliste |
| 3.12 | **Fragen der Vorqualifizierung (TMVT)** überarbeiten? | stehen in `src/lib/vq.ts` |
| 3.13 | **PV und weitere Produkte** – ab wann? (heute nur Wärmepumpe) | Filter, Leitfaden je Produkt |
| 3.14 | **Punkt 2.3 und Schnittstelle 12** aus eurer Planung („Weitere Funktion“) | Platzhalter-Menüpunkt |
| 3.15 | **Löschkonzept:** wann werden Daten ausgeschiedener MAs und alter Leads gelöscht? | DSGVO-Pflicht, technisch noch nicht umgesetzt |

---

## 4. Sicherheit & Betrieb

| # | Punkt | Stand |
| --- | --- | --- |
| 4.1 | **Zwei-Faktor-Pflicht für Admins einschalten** (`ADMIN_2FA_PFLICHT` in `src/server/auth.ts`), nachdem alle Admins eingerichtet haben | 🟡 aus |
| 4.2 | Tägliche Erinnerungen per Cron im Hosting: `curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://<domain>/api/cron/reminders` | 🟡 |
| 4.3 | Datenbank-Backups (täglich, verschlüsselt, Wiederherstellung testen) | ❓ Hosting |
| 4.4 | Überwachung: Erreichbarkeit, Fehlerprotokoll | ❓ |
| 4.5 | Admin-Funktionen für echte MAs fehlen: Name/E-Mail/Rolle ändern, nach Aktivierung sperren/löschen, Datenauskunft (DSGVO) | 🔴 |
| 4.6 | IBAN-Anzeige für Admins bei echten MAs (mit Protokoll) – heute nur in der Beispiel-Teamliste | 🔴 |
| 4.7 | Telefonnummern je Rolle serverseitig ausliefern (Setter maskiert, Presetter/Closer voll) – heute im Pipedrive-Modus für alle maskiert | 🔴 |
| 4.8 | Automatische Tests (heute alles manuell durchgeklickt) | 🔴 |

---

## 5. Was im Dashboard noch Beispieldaten sind 🔴

Alles hier ist sichtbar, klickbar und rechnet richtig – wird aber **nicht gespeichert** (nach dem Neuladen weg) und kommt aus keiner echten Quelle.

| Ansicht | Beispiel / fehlt | Echte Quelle (Vorschlag) |
| --- | --- | --- |
| Übersicht **Presetter** | Anrufe heute, Ø bis Erstanruf (fest „3,4 Std.“), Terminquote | Pipedrive-Aktivitäten, sobald 3.1 geklärt |
| Übersicht **Closer** | Termine, Rückmeldungen, „Dein Geld“ | Kalender (3.4) + Pipedrive |
| Übersicht **Admin** | offene Verträge, offene Auszahlungen, „2 Abrechnungen in Prüfung“, „Auszahlung am 15.10.2026“ (fest) | eigene DB |
| **„Dein Geld“ / Monatsziel** | Beträge aus Beispiel-Abrechnungen; Ziel nur im Browser | Provisionslogik (3.5) + DB |
| **Lead erfassen** | Lead nur im Browser; fester Presetter „Inan“ / Closer „Leo“; „Adresse per Standort“ füllt eine Beispieladresse | n8n-Webhooks (3.3), GPS + Adress-Suche |
| **Telefonleitfaden** | Antworten/Notiz nur im Browser; fester Closer „Leo“ | Pipedrive-Felder (die VQ-Feldschlüssel gibt es schon in n8n) |
| **Kalender / Termine** | Slots, Termine, Rückmeldungen | 3.4 + DB |
| **Rangliste** | Wärmepumpen-Cup, Archiv (Setter-Rangliste im Pipedrive-Modus echt) | DB oder Pipedrive (3.11) |
| **Auszahlungen** | komplette Abrechnungen, Freigabe | DB + Provisionslogik |
| **Verträge** | Beispielverträge; „In DocuSign unterschreiben“ / „PDF ansehen“ sind Demo; Beschriftung noch **DocuSign statt Yousign** | Onboarding-Verträge aus der DB + Yousign |
| **Events** | Events, Zusagen; „In WhatsApp ankündigen“ ohne Funktion | DB + n8n |
| **Team (Admin)** | untere Tabelle „Team“ + Detail-Leiste; oben „Neue MAs“ ist echt | echte Nutzerliste aus der DB |
| **Glocke / Benachrichtigungen** | Beispiel + Knopf „Demo: Statusänderung simulieren“ | Pipedrive-Webhook → n8n → Dashboard |
| **Kopfzeile** | Hinweis „Prototyp · Beispieldaten“; Beispielpersonen bei „Ansicht als“ | entfällt mit echten Daten |

---

## 6. Abgleich mit eurer Planung („Vertriebs-Funnel & MB-Dashboard – TODOs“)

| Punkt | Stand |
| --- | --- |
| 1.1 Eigener Link pro Setter + Anlege-Tool | 🟡 Anlegen im Dashboard ✓; Setter-Link-Tokens stehen noch fest im n8n-Code → vom Dashboard verwalten lassen oder Login statt Link (3.3) |
| 1.2 TMVT-Fragen anpassen | ❓ 3.12 |
| 1.3 Wann Termin? | ❓ offen |
| 1.4 Status in Pipedrive automatisieren | 🟡 Stufen-Zuordnung bestätigt; Automatisierung offen (3.2) |
| 2.1 Leitfaden je Kunde/Produkt | 🟡 Wärmepumpe ✓; PV/Speicher/Energievertrag fehlen |
| 2.2 Status + Benachrichtigung an Setter | 🔴 3.2 / 3.10 |
| 2.3 | ❓ 3.14 |
| 3. Closing | 🟡 Termine + Pflicht-Rückmeldung gebaut (Beispiel), Anbindung offen |
| Schnittstellen 1–11 | 1 ✓ · 2 ✓ Setter/Admin · 3 🟡 · 4 🔴 · 5 ✓ · 6 🔴 · 7 🟡 · 8 ✓ Onboarding · 9 ✓ · 10 🔴 · 11 🟡 |
| Schnittstelle 12 | ❓ 3.14 |

---

## 7. Technisch als Nächstes (ohne eure Zuarbeit machbar)

1. Eigene Datenbank-Tabellen für Events, Wettbewerbe, Closer-Slots/Termine, Verträge, Abrechnungen – damit Änderungen gespeichert werden.
2. Verträge-Ansicht auf die echten Onboarding-Verträge umstellen (Beschriftung Yousign).
3. Team-Liste aus echten Nutzern inkl. Bearbeiten/Sperren/Löschen und IBAN-Anzeige mit Protokoll.
4. Lead erfassen an n8n anbinden (sobald 3.3 entschieden).
5. Automatische Tests für Login, Onboarding und Filter je Rolle.

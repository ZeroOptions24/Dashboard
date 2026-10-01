# MB-Dashboard – Gesamtliste aller To-dos

Stand: 01.10.2026. Ergänzt [`TODO-EnergyEngel.md`](TODO-EnergyEngel.md) (Platzhalter und Entscheidungen).
**Wer:** 🧑 ihr · 🤖 Entwicklung · 🤝 gemeinsam. **Wann:** P1 = vor/zum Livegang · P2 = erste 2 Wochen danach · P3 = später.

---

## 1. Livegang auf eigenem Server (Frist 23.10.)

| # | Wer | Wann | To-do | Mini-Anleitung |
|---|---|---|---|---|
| 1.1 | 🧑 | P1 | Strato **Linux V-Server** buchen | Server → V-Server → Linux. ≥ 2 Kerne, ≥ 4 GB RAM (besser 8), Ubuntu 24.04, Standort Deutschland. **Nicht** Webhosting/Windows/n8n-VPS |
| 1.2 | 🧑 | P1 | AV-Vertrag mit Strato abschließen | Strato-Kundenlogin → Verträge/Datenschutz → Auftragsverarbeitung |
| 1.3 | 🤝 | P1 | SSH-Zugang ohne Passwort | Entwicklung erzeugt Schlüssel, ihr hinterlegt den öffentlichen Teil im Strato-Serverpanel (oder beim Installieren angeben) |
| 1.4 | 🧑 | P1 | Subdomain festlegen + DNS | Strato → Domains → DNS → A-Record `dashboard` → Server-IP. Dauert bis zu 1 Std. |
| 1.5 | 🧑 | P1 | GitHub-Repository auf **privat** stellen | GitHub → Repo → Settings → ganz unten „Change visibility“ → Private |
| 1.6 | 🤖 | P1 | Server absichern | Nur Ports 22/80/443, Login nur per SSH-Schlüssel, automatische Sicherheitsupdates, fail2ban |
| 1.7 | 🤖 | P1 | Coolify installieren, PostgreSQL anlegen, App aus GitHub deployen, SSL (Let’s Encrypt) | – |
| 1.8 | 🤖 | P1 | Schlüssel erzeugen: `BETTER_AUTH_SECRET`, `DATA_ENCRYPTION_KEY`, `CRON_SECRET` | – |
| 1.9 | 🧑 | P1 | **`DATA_ENCRYPTION_KEY` sicher aufbewahren** (Passwortmanager + offline) | Ohne ihn sind alle gespeicherten IBANs unwiederbringlich verloren |
| 1.10 | 🧑 | P1 | Pipedrive-Token selbst in Coolify eintragen | Coolify → App → Environment → `PIPEDRIVE_API_TOKEN` |
| 1.11 | 🤖 | P1 | Server-Einstellungen | `BETTER_AUTH_URL`, `NEXT_PUBLIC_DATA_SOURCE=pipedrive` (gilt beim Build!), `PIPEDRIVE_WRITE=false`, `N8N_WP_LEAD_URL`, `STANDARD_PRESETTER_EMAIL`, `SIGNING_PROVIDER` |
| 1.12 | 🧑 | P1 | Sofort nach dem ersten Start: ersten Admin über `/setup` anlegen | Solange niemand angelegt ist, könnte das jeder mit dem Link |
| 1.13 | 🤖 | P1 | Tägliche Erinnerungen als Cron in Coolify | `POST /api/cron/reminders` mit `CRON_SECRET` |
| 1.14 | 🤖 | P1 | Tägliches Datenbank-Backup + Kopie außerhalb des Servers | Coolify-Backup → Strato HiDrive/S3; 14–30 Tage aufbewahren |
| 1.15 | 🤝 | P1 | Wiederherstellung einmal testen | Backup in leere Datenbank einspielen und anmelden |
| 1.16 | 🤖 | P1 | Erreichbarkeits-Überwachung + Fehlermeldung per E-Mail | Coolify-Benachrichtigungen oder Uptime-Dienst (EU) |
| 1.17 | 🧑 | P1 | Strato-Passwort ändern, falls es irgendwo vollständig zu sehen war | – |
| 1.18 | 🧑 | P1 | Lokale Kopien aufräumen | Token-Zeile in `~/Energy-Engel/.env.local` löschen; nach Livegang lokale Testdatenbank `~/Dashboard/.data/` löschen (enthält Pipedrive-Bezüge) |
| 1.19 | 🧑 | P1 | FileVault (Festplattenverschlüsselung) auf allen Macs mit Kundendaten prüfen | Systemeinstellungen → Datenschutz & Sicherheit → FileVault |

## 2. Team ins Dashboard holen

| # | Wer | Wann | To-do | Mini-Anleitung |
|---|---|---|---|---|
| 2.1 | 🧑 | P1 | Team importieren | Team → „Bestehende MAs übernehmen“ → Liste „Name – E-Mail – Rollen“, Haken „hat schon einen Vertrag“ → Vorschau → Übernehmen |
| 2.2 | 🧑 | P1 | Rollen prüfen (Setter/Presetter/Closer/Admin) | Nur wer Closer-Rolle hat, ist im Termin-Formular wählbar |
| 2.3 | 🧑 | P1 | Links verschicken | Ohne SMTP: Team → „E-Mails ohne Versand“ → „Link kopieren“ → per WhatsApp an die Person |
| 2.4 | 🧑 | P1 | Pipedrive-Setter-Namen prüfen | Team → je Setter genau der Name, der im Pipedrive-Feld „Setter“ steht (bei gleichen Vornamen eindeutig machen) |
| 2.5 | 🧑 | P1 | **Setter-Link-Codes eintragen** | Team → je Setter „Setter-Link-Code“ = der Teil nach `?setter=` aus seinem bisherigen Link. Ohne Code kann er keine Leads anlegen |
| 2.6 | 🧑 | P1 | Standard-Presetterin als Konto anlegen und ihre E-Mail in `STANDARD_PRESETTER_EMAIL` | Alle Leads ohne Dashboard-Aktion zählen dann zu ihr |
| 2.7 | 🧑 | P1 | Alle Admins richten Zwei-Faktor ein, danach Pflicht einschalten | Mein Konto → Sicherheit; danach `ADMIN_2FA_PFLICHT = true` (Entwicklung) |
| 2.8 | 🧑 | P1 | Jede Person füllt ihre Stammdaten aus (IBAN für Auszahlungen) | Kommt mit dem Einladungslink |
| 2.9 ✅ docs/ANLEITUNG.md | 🤝 | P2 | Kurze Einweisung je Rolle (15 Min.) | Entwicklung schreibt eine 1-Seiten-Anleitung je Rolle |
| 2.10 | 🧑 | P2 | Feedback-Kanal festlegen (z. B. WhatsApp-Gruppe „Dashboard“) | Fehler mit Screenshot + Uhrzeit melden |

## 3. Pipedrive & n8n

| # | Wer | Wann | To-do | Mini-Anleitung |
|---|---|---|---|---|
| 3.1 | 🧑 | P1 | **Setter-Feld füllen**: ~85 % der Wärmepumpen-Deals haben keinen Setter | Pipedrive → Liste filtern „Setter ist leer“ → Mehrfachbearbeitung; künftig nur noch mit Setter-Link/Dashboard erfassen |
| 3.2 | 🧑 | P1 | Doppelte Deals zusammenführen (z. B. gleicher Kunde zweimal) | Pipedrive → Deal → „Zusammenführen“ |
| 3.3 | 🧑 | P1 | Alte, nie erreichte Leads aufräumen (viele > 2 Wochen ohne Anruf) | Regel festlegen, z. B. > 30 Tage ohne Kontakt → verloren „nicht erreichbar“ |
| 3.4 | 🤝 | P1 | **Einmal-Test** „Lead erfassen“ auf dem Server mit Test-Kunde, danach Deal in Pipedrive löschen | Prüfen: Deal angelegt, Setter richtig, Notiz/Rückruf da, Deal-ID kommt zurück |
| 3.5 | 🧑 | P1 | n8n prüfen: akzeptiert `meta.quelle = "MB-Dashboard"` und liefert `dealId` zurück | Workflow `wp-lead` |
| 3.6 | 🧑 | P1 | Solange `PIPEDRIVE_WRITE=false`: Status in Pipedrive weiter von Hand nachziehen (Termin, Absage …) | Das Dashboard zeigt den richtigen Stand, Pipedrive nicht automatisch |
| 3.7 | 🧑 | P2 | Entscheiden, ab wann Notizen nach Pipedrive (`PIPEDRIVE_WRITE=notizen`) und später Stufen (`true`) | Erst an 1–2 Leads gemeinsam testen |
| 3.8 | 🧑 | P2 | Deals, die schon „Termin gelegt“ sind, einmal als Termin im Dashboard eintragen | Sonst sehen die Closer sie nicht (Closer-Leads kommen über Dashboard-Termine) |
| 3.9 | 🧑 | P2 | Eigenen Pipedrive-Nutzer „Dashboard/API“ für den Token | Heute hängt der Token an einer Person – fällt weg, wenn sie geht |
| 3.10 | 🧑 | P2 | Pipedrive-Firmen-Domain nennen | für den Knopf „In Pipedrive öffnen“ |
| 3.11 | 🤖 | P2 | Vorqualifizierung zusätzlich in die Pipedrive-VQ-Felder schreiben (wie `wp-vorqual`) | erst mit Freigabe 3.7 |
| 3.12 ✅ erledigt 01.10. | 🤖 | P2 | Dublettenprüfung bei „Lead erfassen“ (Telefon/E-Mail schon vorhanden?) | Warnung vor dem Absenden |
| 3.13 | 🤖 | P3 | Pipedrive-Webhook → Dashboard aktualisiert sofort (statt alle 60 Sek.) | – |
| 3.14 | 🤖 | P3 | Setter-Link-Codes im Dashboard verwalten statt fest im n8n-Code | – |
| 3.15 | 🧑 | P3 | Prüfen, ob n8n auf den eigenen Server umzieht (Datenschutz, Kosten) | n8n-Cloud: AV-Vertrag + Serverstandort prüfen |
| 3.16 | 🧑 | P3 | Deal-Titel-Schema beibehalten („Wärmepumpe – Name“ bzw. „Enpal – Name“) | Danach filtert das Dashboard; Enpal zählt wie Wärmepumpe (01.10.), PV wird ausgeblendet |

## 4. Setter

| # | Wer | Wann | To-do |
|---|---|---|---|
| 4.1 | 🤝 | P1 | Jeder Setter testet einmal: Login am Handy, Lead erfassen, Standort-Button, Tagesziel |
| 4.2 | 🧑 | P1 | Ziele bestätigen: 5 Leads/Tag (Tagesziel), Monatsziel Verdienst (Standard 3.000 €) |
| 4.3 ✅ erledigt 01.10. | 🤖 | P2 | Dashboard als App auf den Homescreen (PWA, eigenes Icon) |
| 4.4 | 🤖 | P2 | Erfassen ohne Netz an der Haustür (zwischenspeichern, später senden) |
| 4.5 | 🤖 | P2 | Hinweis an Setter, wenn sein Lead einen Termin bekommt/verkauft ist (gibt es in der Glocke – zusätzlich per WhatsApp/E-Mail? siehe 9.x) |
| 4.6 | 🤖 | P3 | Eigene Statistik-Seite (Verlauf über Monate) |

## 5. Presetter

| # | Wer | Wann | To-do |
|---|---|---|---|
| 5.1 | 🤝 | P1 | Testlauf mit der Presetterin: 10 echte Anrufe im Dashboard (Nicht erreicht, Rückruf, Termin direkt, Absage) |
| 5.2 | 🧑 | P1 | Regeln für Anrufversuche: wie viele, welche Abstände, danach automatisch absagen? (heute: 1 → in 2 Std., 2 → morgen, 3–4 → in 2 Tagen, 5 → letzter Versuch) |
| 5.3 | 🧑 | P2 | Leitfaden-Texte, Einwände und Vorqualifizierungsfragen (TMVT) durchsehen |
| 5.4 ✅ erledigt 01.10. | 🤖 | P2 | Anrufliste filtern/suchen (Ort, Alter, Setter), „Falsche Nummer“/„Mailbox“ als Ergebnis |
| 5.5 ✅ erledigt 01.10. (Hinweis im Leitfaden/Übersicht) | 🤖 | P2 | Erinnerung zur Rückrufzeit (Glocke/Push) |
| 5.6 ✅ erledigt 01.10. | 🤖 | P2 | „Wird gerade bearbeitet“, wenn zwei Presetter denselben Lead öffnen |
| 5.7 | 🤖 | P3 | WhatsApp-/SMS-Vorlage an Kunden („Wir haben Sie nicht erreicht …“) |
| 5.8 | 🧑 | P3 | Telefonie-Anbindung (z. B. sipgate) – Anrufe direkt aus dem Browser zählen |

## 6. Closer

| # | Wer | Wann | To-do |
|---|---|---|---|
| 6.1 | 🧑 | P1 | Closer tragen ihre freien Slots ein (Kalender → „Slots eintragen“, 4 Wochen wiederholen) |
| 6.2 | 🧑 | P1 | Regel bestätigen: Rückmeldung innerhalb 24 Std., sonst keine neuen Termine |
| 6.3 | 🤖 | P2 | Terminbestätigung an den Kunden (E-Mail/SMS) mit Erinnerung am Vortag |
| 6.4 | 🤖 | P3 | Kalender-Abgleich mit Outlook/Google (Termine automatisch im Handykalender) |
| 6.5 | 🤖 | P3 | Angebots-/Checks-Dokumente am Termin hochladen |

## 7. Admin & Auswertung

| # | Wer | Wann | To-do |
|---|---|---|---|
| 7.1 | 🧑 | P1 | Zielwerte bestätigen (Terminquote 42 %, Checks 65 %, Verkauf 70 %, 65 Verkäufe/Monat, 30 Anrufe/Tag, Erstanruf ≤ 2 Std.) |
| 7.2 | 🧑 | P2 | Wärmepumpen-Cup: Prämienstufen und Teamziel festlegen (heute Prototyp-Werte) |
| 7.3 ✅ erledigt 01.10. | 🤖 | P2 | „Neuen Wettbewerb starten“ (alten archivieren) |
| 7.4 ✅ erledigt 01.10. | 🤖 | P2 | Protokoll-Ansicht für Admins (wer hat wann IBAN gesehen, Vertrag gesendet …) |
| 7.5 | 🤖 | P2 | Export (CSV) für Leads/Quoten je Setter |
| 7.6 | 🤖 | P3 | Monats-Report automatisch per E-Mail an Admins |

## 8. Provision & Auszahlungen

| # | Wer | Wann | To-do |
|---|---|---|---|
| 8.1 | 🧑 | P1 | **Provisionsmodell festlegen**: Sätze je Rolle/Produkt, Widerrufsfrist, Storno, Auszahlungstag (heute Beispiel: 1.000 € je Verkauf, 250 € je Termin) |
| 8.2 | 🤖 | P2 | Monatsabrechnung automatisch erzeugen (danach Admin-Freigabe – gibt es schon) |
| 8.3 | 🤖 | P2 | Export für Buchhaltung/Steuerberater (CSV/DATEV), Gutschriften als PDF |
| 8.4 | 🧑 | P2 | Steuerfragen klären: Gutschrift mit/ohne USt (Kleinunternehmer), Gewerbenachweis |

## 9. Benachrichtigungen & E-Mail

| # | Wer | Wann | To-do | Mini-Anleitung |
|---|---|---|---|---|
| 9.1 | 🧑 | P1 | Absender-Postfach anlegen (z. B. `dashboard@…`) | Strato → E-Mail → Postfach anlegen |
| 9.2 | 🧑 | P1 | SMTP in Coolify eintragen (selbst, nicht im Chat) | `SMTP_HOST=smtp.strato.de`, `SMTP_PORT=465`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` |
| 9.3 | 🧑 | P2 | SPF/DKIM/DMARC der Domain prüfen (sonst Spam-Ordner) | Strato → Domain → DNS |
| 9.4 | 🧑 | P2 | Entscheiden: Benachrichtigungen zusätzlich per WhatsApp (über n8n)? | – |
| 9.5 | 🤖 | P2 | „In WhatsApp ankündigen/posten“ (Events, Rangliste) an n8n anbinden | – |

## 10. Verträge & Onboarding

| # | Wer | Wann | To-do |
|---|---|---|---|
| 10.1 | 🧑 | P1 | Vertragsvorlagen vom Anwalt (HV-Vertrag § 84 HGB, Provisionsvereinbarung je Rolle, Vertraulichkeit/Datenschutz) – heute Platzhalter-PDF |
| 10.2 | 🧑 | P2 | Yousign-Konto (API-Key, Webhook-Secret), erst Sandbox |
| 10.3 | 🤝 | P2 | Yousign-Test: Vertrag senden → unterschreiben → Zugang kommt automatisch |
| 10.4 | 🤖 | P2 | Unterschriebenes PDF von Yousign speichern (statt erzeugtem) |
| 10.5 | 🤖 | P3 | Alte Verträge bestehender MAs als PDF hochladen |
| 10.6 | 🤖 | P3 | Nachweise hochladen (Gewerbeschein, Steuernummer) |

## 11. Datenschutz & Recht

| # | Wer | Wann | To-do |
|---|---|---|---|
| 11.1 | 🧑 | P1 | **Datenschutzhinweise für MAs** (Text für `/datenschutz`) – vom Anwalt/DSB |
| 11.2 | 🧑 | P1 | AV-Verträge: Strato, Pipedrive, n8n, Yousign, Mail-Anbieter |
| 11.3 | 🧑 | P1 | Verzeichnis der Verarbeitungstätigkeiten ergänzen (Dashboard: MA-Stammdaten, Kundendaten aus Pipedrive, Standort an der Haustür) |
| 11.4 | 🧑 | P1 | Kundeninfo/Einwilligung an der Haustür prüfen (Daten + Standort gehen nach Pipedrive/n8n; Adresssuche über OpenStreetMap) |
| 11.5 | 🧑 | P2 | Löschkonzept: Fristen für ausgeschiedene MAs, abgesagte/alte Leads, Protokolle |
| 11.6 | 🤖 | P2 | Löschfristen automatisch umsetzen |
| 11.7 ✅ erledigt 01.10. | 🤖 | P2 | Datenauskunft je MA (DSGVO-Export) |
| 11.8 | 🧑 | P2 | TOMs (technisch-organisatorische Maßnahmen) dokumentieren – Entwicklung liefert die technischen Punkte |
| 11.9 | 🧑 | P2 | Wer ist Ansprechpartner für Datenschutz-Anfragen? |

## 12. Sicherheit & Technik (Entwicklung)

| # | Wann | To-do |
|---|---|---|
| 12.1 ✅ erledigt 01.10. | P1 | Sicherheits-Header (CSP, HSTS) und Login-Rate-Limit prüfen |
| 12.2 | P1 | `npm audit` durchgehen, kritische Pakete aktualisieren |
| 12.3 ✅ erledigt 01.10. (Dockerfile, docs/HOSTING.md) | P1 | Dockerfile/Coolify-Konfiguration ins Repo (Migrationen laufen beim Start) |
| 12.4 | P2 | Automatische Paket-Updates (Dependabot) + CI |
| 12.5 | P2 | Ende-zu-Ende-Tests im Browser für Login, Lead erfassen, Anruf, Termin, Rückmeldung |
| 12.6 | P2 | Alle Ansichten am Handy (375 px) durchtesten |
| 12.7 | P2 | Test-Umgebung (Staging) neben Produktion |
| 12.8 | P2 | Fehlerprotokoll (z. B. Sentry EU) |
| 12.9 | P3 | Code einheitlich formatieren (Prettier) |
| 12.10 | P3 | Barrierefreiheit prüfen (Tastatur, Kontraste) |

## 13. Design & Inhalte

| # | Wer | Wann | To-do |
|---|---|---|---|
| 13.1 | 🧑 | P2 | Logo und Maskottchen „Chibi-Engel“ liefern (heute Platzhalter „E“) |
| 13.2 | 🧑 | P3 | Inhalt für „Weitere Funktion“ (Planung Punkt 2.3 / Schnittstelle 12) |
| 13.3 | 🤖 | P3 | Favicon, App-Icon, Startbild |

## 14. Später / Wachstum

| # | To-do |
|---|---|
| 14.1 | PV, Speicher, Energievertrag als weitere Produkte (Leitfaden, Filter, Provision je Produkt) |
| 14.2 | Mehrere Teams/Regionen mit eigenen Teamleitern |
| 14.3 | Karte: Leads und Termine nach Ort (Routenplanung für Closer) |
| 14.4 | Gamification: Abzeichen, Serien, Team-Challenges |
| 14.5 | Schulungsbereich (Videos, Skripte, Quiz für neue Setter) |
| 14.6 | Recruiting-Funnel für neue MAs direkt ins Onboarding |

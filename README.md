# EnergyEngel MB-Dashboard

Dashboard für die MBs (Setter, Presetter, Closer) und Admins: Leads und Status aus Pipedrive, Zahlen, Ranglisten, Events, Auszahlungen, Verträge und Stammdaten.

**Stand:** Login mit mehreren Rollen je Person, Onboarding, Team-Verwaltung, Verträge, Events, Closer-Kalender und Termine, Wettbewerb, Auszahlungen und Benachrichtigungen laufen mit eigener Datenbank; Leads und Kennzahlen kommen aus Pipedrive. Echte Daten erst nach der Datenschutz-Freigabe (eigener Server, AV-Verträge).

**Zwei Betriebsarten** (`NEXT_PUBLIC_DATA_SOURCE`): `demo` zeigt den Prototyp mit erfundenen Beispieldaten (nichts wird gespeichert); `pipedrive` ist der echte Betrieb – Pipedrive + Datenbank, Beispieldaten werden nie angezeigt.

**Offene Punkte für EnergyEngel:** [`docs/TODO-EnergyEngel.md`](docs/TODO-EnergyEngel.md)

## Starten

```bash
npm install
npm run dev
```

`npm run dev` startet eine lokale PostgreSQL-kompatible Datenbank (Datei unter `.data/`, kein Docker nötig), spielt die Migrationen ein und startet die App auf http://localhost:3000.

Vorher einmalig `.env.example` nach `.env.local` kopieren und `BETTER_AUTH_SECRET` sowie `DATA_ENCRYPTION_KEY` erzeugen (`openssl rand -base64 32`).

Beim ersten Aufruf führt `/setup` durch das Anlegen des ersten Admins. Admins sehen oben rechts „Ansicht als“ und können in die anderen Rollen hineinschauen.

**Tests:** `npm test` (Vitest) – Logik, Pipedrive-Zuordnung und Rechteprüfungen gegen eine In-Memory-Datenbank mit den echten Migrationen.

**Nur lokal (Entwicklung):**
- `/dev/postfach` – alle E-Mails, die das System verschickt hätte (ohne SMTP-Zugang)
- `/dev/unterschrift/<id>` – simulierte Vertragsunterschrift (ohne Yousign)
- Lokale Datenbank zurücksetzen: Server stoppen, Ordner `.data/` löschen

## Login & Onboarding

| Schritt | Wer | Status |
| --- | --- | --- |
| Einladen (Name, E-Mail, Rolle) unter *Team & Setter* | Admin | Eingeladen – Mail mit Formular-Link (7 Tage gültig, einmalig) |
| Stammdaten ausfüllen: Adresse, Geburtsdatum, IBAN (Prüfsumme), Steuerdaten | MA | Daten erfasst – Admins bekommen eine Mail |
| Daten prüfen, „Vertrag senden“ | Admin | Vertrag versendet (Yousign bzw. Test-Unterschrift) |
| Unterschrift → Mail „Passwort festlegen“ (48 Std. gültig) | automatisch | Unterschrieben |
| Passwort festlegen | MA | Aktiv |

Außerdem: Link erneut senden, *Direkt freischalten* (bestehende MAs mit Vertrag), *Zurückziehen* (sperrt den Zugang). Jede Aktion landet im Protokoll (`audit_log`).

**Team-Verwaltung:** Rollen (mehrere je Person), Name und E-Mail ändern, sperren, löschen (DSGVO, samt aller Daten), Details und IBAN (Abruf protokolliert), bestehende MAs als Liste übernehmen („Name – E-Mail – Rollen“, optional ohne Vertragsschritt). Es bleibt immer mindestens ein aktiver Admin.

**Verträge:** MAs sehen ihre Verträge, öffnen das PDF und stellen Rückfragen (Mail an Admins). Admins sehen alle, erinnern, klären Rückfragen und schicken weitere Unterlagen zur Unterschrift.

**Erinnerungen** (täglich über `POST /api/cron/reminders` mit `CRON_SECRET`, oder per Button im Team-Bereich): Formular nach 3 Tagen erneut senden (max. 2×), abgelaufenen Passwort-Link neu senden, hängende Fälle (Vertrag nicht gesendet/unterschrieben) als Zusammenfassung an die Admins.

**Stammdaten:** Jeder MA sieht und ändert seine eigenen Daten (Name, Geburtsdatum, E-Mail nur durch Admins). Bei einer IBAN-Änderung bekommen MA und Admins eine E-Mail.

**Zwei-Faktor-Anmeldung:** Unter *Mein Konto / Stammdaten → Sicherheit* richtet jede Person optional einen zweiten Faktor ein (Authenticator-App, 10 Ersatz-Codes, Gerät 30 Tage merken). Die **Pflicht für Admins** ist gebaut, aber ausgeschaltet: `ADMIN_2FA_PFLICHT` in `src/server/auth.ts` auf `true` setzen – dann sind Admin-Aktionen ohne eingerichteten zweiten Faktor gesperrt und ein Hinweis erscheint.

**Sicherheit:** keine Selbstregistrierung; IBAN nur AES-256-GCM-verschlüsselt, Admins sehen sie maskiert; Einmal-Links nur als Hash gespeichert; jede Admin-Server-Action prüft die Rolle selbst.

## Pipedrive anbinden

1. `.env.example` nach `.env.local` kopieren.
2. `PIPEDRIVE_API_TOKEN` eintragen (Pipedrive → Persönliche Einstellungen → API).
3. `NEXT_PUBLIC_DATA_SOURCE=pipedrive` setzen und `npm run dev` neu starten.

Das Dashboard lädt dann die Wärmepumpen-Deals der Pipeline „Empfehlung kommt“ (ID 21) – **auf dem Server gefiltert**: Setter sehen nur Deals, in deren Feld „Setter“ ihr hinterlegter Pipedrive-Name steht (Team-Bereich, Standard: Vorname; Groß-/Kleinschreibung egal), Admins sehen alle. Deals werden 60 Sekunden zwischengespeichert, Telefonnummern maskiert.

**Kennzahlen** (`src/lib/stats.ts`, ausgeliefert über `/api/stats`): Leads, Termin-/Checks-/Verkaufsquoten, Funnel, Leads je Kalenderwoche, Verlustgründe, Setter-Rangliste und Tagesziel werden auf dem Server aus *allen* Deals berechnet. Admins bekommen alles; Setter nur ihre eigenen Zahlen, den Teamschnitt und die Rangliste (Namen + Anzahl Termine). Zielwerte stehen in `TARGETS` (`src/lib/domain.ts`). Im Beispiel-Modus bleiben die Beispielzahlen.

**Test ohne echten Token:** `PIPEDRIVE_API_BASE` kann auf einen nachgebauten Pipedrive-Server zeigen.

**Personen:** Im echten Betrieb ist jede Person über ihre Nutzer-ID bekannt. Der Pipedrive-Setter-Name wird auf dem Server dem passenden Konto zugeordnet; Setter ohne Konto erscheinen mit ihrem Namen. Closer sehen die Leads, für die bei ihnen ein Termin gebucht ist. Die volle Telefonnummer bekommen nur Admins und der zuständige Closer.

**Zuordnung** (`src/server/pipedrive/config.ts`, bestätigt am 25.09.2026):
- Empfehlung kommt, QUALI, Kontaktieren (2) → *Lead eingereicht* · An Mitarbeiter übergeben, Mitarbeiter in Bearbeitung → *Termin gelegt* · Checks → *In den Checks* · Verkauf / gewonnen → *Verkauf* · Später Interessant, Anderes Potential, Ablehnung → *Abgesagt*
- Setter: Deal-Feld „Setter“ (Name, von n8n über den Setter-Link gesetzt). Fehlt der Link, bleibt das Feld leer → Lead erscheint als „unbekannt“.
- Vorerst nur Wärmepumpen; PV und weitere Produkte kommen später.

**Noch offen:**
- Presetter: Woran erkennt man sie in Pipedrive? Bis dahin bekommen sie keine Leads.
- Status-Änderungen aus dem Dashboard werden noch nicht nach Pipedrive geschrieben.
- *Ausgezahlt* gibt es in Pipedrive nicht – kommt später aus der eigenen Datenbank.

## Aufbau

| Pfad | Inhalt |
| --- | --- |
| `src/app/layout.tsx` | HTML-Grundgerüst, Schriften (lokal über `next/font`, keine Google-Anfragen aus dem Browser) |
| `src/app/page.tsx` | Einstieg: Anmeldung prüfen, dann `AppShell` |
| `src/components/shell/` | App-Hülle: Seitenleiste, Kopfzeile, „Ansicht als“, Benachrichtigungen, Handy-Navigation, Kurzmeldungen |
| `src/components/drawers/` | Seitenleisten: Lead-Details, Absage-Grund, Rückruf, Termin-Rückmeldung, Termin, Team-Mitglied |
| `src/lib/ui.ts` / `nav.ts` | Oberflächen-Aktionen (Ansicht, Rolle, Overlays, Kurzmeldungen) und Navigation je Rolle |
| `src/app/globals.css` | Design-Tokens (hell/dunkel) und alle `ee-`-Komponenten-Styles |
| `src/lib/types.ts` | Datenmodell (Lead, Termin, Auszahlung, Vertrag, …) – Schnittstelle zur späteren Datenquelle |
| `src/lib/domain.ts` | Geschäftsregeln: Pipeline-Status, Provisionssätze, Verlustgründe, Leitfaden |
| `src/lib/demo-data.ts` | Beispieldaten (`createDemoData()`) für den Demo-Modus |
| `src/lib/store.ts` | Zustand im Browser (Daten, Ansicht, Assistent, Overlays); im echten Betrieb werden die Beispieldaten geleert und durch Pipedrive/Datenbank ersetzt |
| `src/lib/live.ts` / `src/components/DataSource.tsx` | Laden der echten Daten; `persist()` speichert Änderungen auf dem Server |
| `src/components/` | React-Komponenten – **alle Ansichten** (Übersicht, Pipeline, Lead erfassen, Leitfaden, Kalender, Termine, Rangliste, Auszahlungen, Verträge, Events, Stammdaten, Team) |
| `src/lib/vq.ts` | Fragen der Vorqualifizierung (Lead erfassen, Leitfaden), Heizlast-Schätzung |
| `src/lib/actions.ts` | Aktionen auf den Dashboard-Daten – sofort sichtbar, im echten Betrieb zusätzlich gespeichert |
| `src/server/workspace.ts` | Team-Alltag (Events, Kalender, Termine, Wettbewerb, Auszahlungen, Benachrichtigungen) mit Rechteprüfung je Aktion; Server Actions in `src/app/actions/workspace.ts` |
| `src/server/team.ts` / `contract-service.ts` | Team-Verwaltung und Verträge |
| `src/server/db/` | Datenbankschema (Drizzle) und Verbindung; Migrationen in `drizzle/` (`npm run db:generate`) |
| `src/server/auth.ts` | Login (Better Auth): Rollen, Passwort-Links, `requireAdmin()` |
| `src/server/onboarding.ts` | Onboarding-Ablauf; Server Actions in `src/app/actions/onboarding.ts` |
| `src/server/contracts.ts` / `signing.ts` | Vertrags-PDF (Platzhalter bis Vorlagen da sind) und Versand zur Unterschrift (Yousign / Test) |
| `src/server/mail.ts` / `crypto.ts` | E-Mail-Versand (SMTP oder Test-Postfach) und Verschlüsselung |
| `src/server/pipedrive/` | Pipedrive-Anbindung (nur Server): Client, Zuordnung Stufen/Felder, Deal → Lead |
| `src/app/api/leads/route.ts` | Endpunkt `/api/leads` – nur angemeldet, Leads je Person gefiltert |
| `src/server/profile.ts` | Eigene Stammdaten (lesen, ändern, IBAN-Änderung mit Benachrichtigung) |

Vorlage: [`mb-dashboard.html`](https://zerooptions24.github.io/EnergyEngel/mb-dashboard.html) im Repo `ZeroOptions24/EnergyEngel`.

## Nächste Schritte

Siehe [`docs/TODO-EnergyEngel.md`](docs/TODO-EnergyEngel.md): Presetter-Zuordnung, Rückschreiben nach Pipedrive, Lead erfassen über n8n, Provisionslogik, Hosting auf eigenem EU-Server (Hetzner + Coolify).

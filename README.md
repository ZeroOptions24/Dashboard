# EnergyEngel MB-Dashboard

Dashboard für die MBs (Setter, Presetter, Closer) und Admins: Leads und Status aus Pipedrive, Zahlen, Ranglisten, Events, Auszahlungen, Verträge und Stammdaten.

**Stand:** Login mit Rollen und Onboarding neuer MAs (Einladung → Daten → Vertrag → Unterschrift → Zugang) laufen mit eigener Datenbank. Die Dashboard-Inhalte sind noch Beispieldaten bzw. optional Pipedrive. Echte Setter-Daten erst nach der Datenschutz-Freigabe (eigener Server, AV-Verträge).

**Offene Punkte für EnergyEngel:** [`docs/TODO-EnergyEngel.md`](docs/TODO-EnergyEngel.md)

## Starten

```bash
npm install
npm run dev
```

`npm run dev` startet eine lokale PostgreSQL-kompatible Datenbank (Datei unter `.data/`, kein Docker nötig), spielt die Migrationen ein und startet die App auf http://localhost:3000.

Vorher einmalig `.env.example` nach `.env.local` kopieren und `BETTER_AUTH_SECRET` sowie `DATA_ENCRYPTION_KEY` erzeugen (`openssl rand -base64 32`).

Beim ersten Aufruf führt `/setup` durch das Anlegen des ersten Admins. Admins sehen oben rechts „Ansicht als“ und können in die anderen Rollen hineinschauen.

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

**Erinnerungen** (täglich über `POST /api/cron/reminders` mit `CRON_SECRET`, oder per Button im Team-Bereich): Formular nach 3 Tagen erneut senden (max. 2×), abgelaufenen Passwort-Link neu senden, hängende Fälle (Vertrag nicht gesendet/unterschrieben) als Zusammenfassung an die Admins.

**Stammdaten:** Jeder MA sieht und ändert seine eigenen Daten (Name, Geburtsdatum, E-Mail nur durch Admins). Bei einer IBAN-Änderung bekommen MA und Admins eine E-Mail.

**Sicherheit:** keine Selbstregistrierung; IBAN nur AES-256-GCM-verschlüsselt, Admins sehen sie maskiert; Einmal-Links nur als Hash gespeichert; jede Admin-Server-Action prüft die Rolle selbst.

## Pipedrive anbinden

1. `.env.example` nach `.env.local` kopieren.
2. `PIPEDRIVE_API_TOKEN` eintragen (Pipedrive → Persönliche Einstellungen → API).
3. `NEXT_PUBLIC_DATA_SOURCE=pipedrive` setzen und `npm run dev` neu starten.

Das Dashboard lädt dann die Wärmepumpen-Deals der Pipeline „Empfehlung kommt“ (ID 21) – **auf dem Server gefiltert**: Setter sehen nur Deals, in deren Feld „Setter“ ihr hinterlegter Pipedrive-Name steht (Team-Bereich, Standard: Vorname; Groß-/Kleinschreibung egal), Admins sehen alle. Deals werden 60 Sekunden zwischengespeichert, Telefonnummern maskiert.

**Zuordnung** (`src/server/pipedrive/config.ts`, bestätigt am 25.09.2026):
- Empfehlung kommt, QUALI, Kontaktieren (2) → *Lead eingereicht* · An Mitarbeiter übergeben, Mitarbeiter in Bearbeitung → *Termin gelegt* · Checks → *In den Checks* · Verkauf / gewonnen → *Verkauf* · Später Interessant, Anderes Potential, Ablehnung → *Abgesagt*
- Setter: Deal-Feld „Setter“ (Name, von n8n über den Setter-Link gesetzt). Fehlt der Link, bleibt das Feld leer → Lead erscheint als „unbekannt“.
- Vorerst nur Wärmepumpen; PV und weitere Produkte kommen später.

**Noch offen:**
- Presetter und Closer: Woran erkennt man sie in Pipedrive (Deal-Owner, Feld „VQ Berater“)? Bis dahin bekommen sie aus Pipedrive keine Leads.
- *Ausgezahlt* gibt es in Pipedrive nicht – kommt später aus der eigenen Datenbank.

## Aufbau

| Pfad | Inhalt |
| --- | --- |
| `src/app/layout.tsx` | HTML-Grundgerüst, Schriften (lokal über `next/font`, keine Google-Anfragen aus dem Browser) |
| `src/app/page.tsx` | App-Shell: Seitenleiste, Kopfzeile, Container für Ansichten und Overlays |
| `src/app/globals.css` | Design-Tokens (hell/dunkel) und alle `ee-`-Komponenten-Styles |
| `src/lib/types.ts` | Datenmodell (Lead, Termin, Auszahlung, Vertrag, …) – Schnittstelle zur späteren Datenquelle |
| `src/lib/domain.ts` | Geschäftsregeln: Pipeline-Status, Provisionssätze, Verlustgründe, Leitfaden |
| `src/lib/demo-data.ts` | Beispieldaten (`createDemoData()`), wird später durch Datenbank/Pipedrive ersetzt |
| `src/lib/store.ts` | Gemeinsamer Zustand für React-Ansichten und Übergangsschicht; `REACT_VIEWS` listet umgestellte Ansichten |
| `src/components/` | React-Komponenten (umgestellt: Übersicht aller Rollen, Pipeline, Team & Onboarding, Stammdaten) |
| `src/server/db/` | Datenbankschema (Drizzle) und Verbindung; Migrationen in `drizzle/` (`npm run db:generate`) |
| `src/server/auth.ts` | Login (Better Auth): Rollen, Passwort-Links, `requireAdmin()` |
| `src/server/onboarding.ts` | Onboarding-Ablauf; Server Actions in `src/app/actions/onboarding.ts` |
| `src/server/contracts.ts` / `signing.ts` | Vertrags-PDF (Platzhalter bis Vorlagen da sind) und Versand zur Unterschrift (Yousign / Test) |
| `src/server/mail.ts` / `crypto.ts` | E-Mail-Versand (SMTP oder Test-Postfach) und Verschlüsselung |
| `src/server/pipedrive/` | Pipedrive-Anbindung (nur Server): Client, Zuordnung Stufen/Felder, Deal → Lead |
| `src/app/api/leads/route.ts` | Endpunkt `/api/leads` – nur angemeldet, Leads je Person gefiltert |
| `src/server/profile.ts` | Eigene Stammdaten (lesen, ändern, IBAN-Änderung mit Benachrichtigung) |
| `src/legacy/prototype.js` | **Übergangsschicht:** Ansichten und Logik des Prototyps, unverändert übernommen |

Vorlage: [`mb-dashboard.html`](https://zerooptions24.github.io/EnergyEngel/mb-dashboard.html) im Repo `ZeroOptions24/EnergyEngel`.

## Nächste Schritte

1. Presetter/Closer-Zuordnung aus Pipedrive (sobald geklärt), Kennzahlen der Übersicht aus echten Daten berechnen.
2. Restliche Ansichten in React umbauen, danach `src/legacy/` löschen.
3. Anbindungen: Kalender, n8n-Webhooks, Auszahlungen.
4. Hosting auf eigenem EU-Server (geplant: Hetzner + Coolify).

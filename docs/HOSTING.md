# Hosting: Strato Linux V-Server + Docker

Live seit 03.10.2026: **https://dashboard.energyengel.de** (Strato V-Server, Ubuntu 24.04, 4 Kerne, 8 GB RAM).
🧑 = ihr · 🤖 = Entwicklung

## Aufbau

- **Docker Compose** (`deploy/docker-compose.yml`): PostgreSQL 16 · Dashboard (Next.js, `Dockerfile`) · **Caddy** (HTTPS automatisch per Let’s Encrypt).
- Nur Caddy ist von außen erreichbar (Ports 80/443); Datenbank und App nur intern.
- Server abgesichert: Firewall (ufw: 22/80/443), SSH nur mit Schlüssel, fail2ban, automatische Sicherheitsupdates, Zeitzone Europe/Berlin.
- Verzeichnisse auf dem Server:
  - `/opt/mb-dashboard/app` – Code (Git-Klon)
  - `/opt/mb-dashboard/secrets.env` – Geheimnisse und Einstellungen (nur root, nie im Repository)
  - `/opt/mb-dashboard/backups` – tägliche Datenbank-Sicherungen (30 Tage)

## Einstellungen (`/opt/mb-dashboard/secrets.env`)

| Variable | Bedeutung |
| --- | --- |
| `DOMAIN`, `BETTER_AUTH_URL` | `dashboard.energyengel.de` |
| `POSTGRES_PASSWORD`, `BETTER_AUTH_SECRET`, `CRON_SECRET` | auf dem Server erzeugt |
| `DATA_ENCRYPTION_KEY` | IBAN-Verschlüsselung – **zusätzlich im Passwortmanager sichern**, sonst sind IBANs bei Verlust weg |
| `PIPEDRIVE_API_TOKEN` | 🧑 selbst eintragen |
| `PIPEDRIVE_WRITE` | `false` – gilt nur für die alte Pipeline; in der Dashboard-Pipeline schreibt das Dashboard immer |
| `N8N_WP_LEAD_URL` | leer – nur Rückfall ohne Dashboard-Pipeline |
| `STANDARD_PRESETTER_EMAIL` | Presetterin für Leads ohne Dashboard-Aktion |
| `EPP_URL` | optional: Adresse eines Kunden im Enpal-Partnerportal mit `{id}` für die EPP-ID – dann erscheint „Im EPP öffnen“ (wird beim Bauen übernommen, also danach `deploy.sh`) |
| `GUTSCHRIFT_ABSENDER` | 🧑 Absender auf der Gutschrift, Zeilen mit `|` getrennt, z. B. `Firma GmbH|Straße 1|04109 Leipzig|USt-IdNr. DE…` |
| `SIGNING_PROVIDER` | leer (Unterschrift noch nicht angebunden) – später `yousign` + Schlüssel |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | 🧑 sobald das Absender-Postfach steht (`smtp.strato.de`, 465) |

Nach Änderungen: `cd /opt/mb-dashboard/app && docker compose --env-file /opt/mb-dashboard/secrets.env -f deploy/docker-compose.yml up -d --force-recreate app`

## Betrieb 🤖

- **Update ausrollen**: `ssh root@31.70.98.57 /opt/mb-dashboard/app/deploy/deploy.sh` (holt `main`, baut, startet; Migrationen laufen beim Start).
- **Backup**: täglich 03:00 (`deploy/backup.sh`, Cron `/etc/cron.d/mb-dashboard`), 30 Tage. **Offen:** Kopie außerhalb des Servers (z. B. Strato HiDrive).
- **Täglicher Lauf** 08:00: Onboarding-Erinnerungen, Pipedrive-Übertragung nachholen, unbestätigte Termin-Vormerkungen freigeben, Abrechnung am 1./15., Auszahlung am 10./25. (`/api/cron/reminders`).
- **Überwachung**: `https://dashboard.energyengel.de/api/health` → `{"ok":true}`. **Offen:** externer Check mit E-Mail-Alarm.
- **Logs**: `docker compose --env-file /opt/mb-dashboard/secrets.env -f deploy/docker-compose.yml logs -f app`

## Erster Start (Checkliste)

1. 🧑 `/setup` öffnen → erstes Admin-Konto.
2. 🧑 Pipedrive-Token eintragen (Befehl von der Entwicklung).
3. 🧑 Team importieren, Rollen prüfen, Links per „E-Mails ohne Versand“ verschicken.
4. 🤝 Team → „Pipedrive-Pipeline fürs Dashboard“ → anlegen.
5. 🤖 Setter-Zuweisungen eintragen.
6. 🤝 Testlauf nach [TESTLAUF-LIVEGANG.md](TESTLAUF-LIVEGANG.md).
7. 🧑 Zwei-Faktor für Admins, danach Pflicht einschalten.

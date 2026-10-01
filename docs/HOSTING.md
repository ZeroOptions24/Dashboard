# Hosting: Strato Linux V-Server + Coolify

Ziel: das MB-Dashboard läuft auf eurem eigenen Server in Deutschland, mit eigener Domain, SSL, täglichem Backup und Überwachung.
🧑 = ihr · 🤖 = Entwicklung

## 1. Server

1. 🧑 Strato → Server → **Linux V-Server**: mind. 2 Kerne, 4 GB RAM (besser 8), **Ubuntu 24.04**, Standort Deutschland. AV-Vertrag im Kundenbereich abschließen.
2. 🤝 SSH-Schlüssel hinterlegen (Entwicklung schickt den öffentlichen Teil), IP-Adresse an die Entwicklung.
3. 🧑 DNS: Strato → Domains → DNS → **A-Record** `dashboard` (oder Wunsch-Subdomain) → Server-IP.

## 2. Server absichern und Coolify installieren 🤖

```bash
# als root auf dem Server
apt update && apt -y upgrade
apt -y install ufw fail2ban unattended-upgrades
ufw allow 22 && ufw allow 80 && ufw allow 443 && ufw --force enable
# SSH nur mit Schlüssel: in /etc/ssh/sshd_config  PasswordAuthentication no  → systemctl restart ssh
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

Danach Coolify im Browser öffnen (`http://<IP>:8000`), Admin-Konto mit starkem Passwort + Zwei-Faktor anlegen, Port 8000 anschließend wieder schließen (Coolify über eigene Subdomain mit SSL erreichbar machen).

## 3. Datenbank 🤖

Coolify → New Resource → **PostgreSQL 16**. Interne Verbindungs-URL notieren → `DATABASE_URL` der App. Backups: siehe 6.

## 4. App 🤖

Coolify → New Resource → **GitHub (privates Repo `ZeroOptions24/Dashboard`)** über die Coolify-GitHub-App → Build Pack **Dockerfile**.

- Domain: `https://dashboard.<eure-domain>` (SSL kommt automatisch von Let’s Encrypt)
- Build-Argument: `NEXT_PUBLIC_DATA_SOURCE=pipedrive`
- Health-Check-Pfad: `/api/health`
- Beim Start laufen automatisch die Datenbank-Migrationen (`scripts/migrate.mjs`).

### Umgebungsvariablen (Coolify → App → Environment)

| Variable | Wert | Wer |
| --- | --- | --- |
| `DATABASE_URL` | interne URL aus Schritt 3 | 🤖 |
| `BETTER_AUTH_URL` | `https://dashboard.<eure-domain>` | 🤖 |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32` | 🤖 |
| `DATA_ENCRYPTION_KEY` | `openssl rand -base64 32` – **sicher aufbewahren, sonst sind IBANs verloren** | 🤖 erzeugt, 🧑 sichert |
| `CRON_SECRET` | `openssl rand -hex 24` | 🤖 |
| `PIPEDRIVE_API_TOKEN` | aus Pipedrive → Persönliche Einstellungen → API | 🧑 selbst eintragen |
| `PIPEDRIVE_WRITE` | `false` (in Pipedrive wird nichts verschoben) | 🤖 |
| `N8N_WP_LEAD_URL` | bisheriger wp-lead-Webhook | 🤖 |
| `STANDARD_PRESETTER_EMAIL` | E-Mail der Standard-Presetterin | 🤖 |
| `SIGNING_PROVIDER` | leer (Test) – später `yousign` + `YOUSIGN_API_KEY`, `YOUSIGN_WEBHOOK_SECRET` | 🧑 |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | `smtp.strato.de`, `465`, Postfach-Zugang | 🧑 selbst eintragen |

## 5. Erster Start

1. 🤖 Deploy auslösen, `https://dashboard.<domain>/api/health` muss `{"ok":true}` zeigen.
2. 🧑 **Sofort** `/setup` öffnen und das erste Admin-Konto anlegen.
3. 🧑 Team importieren (Team → „Bestehende MAs übernehmen“), Rollen prüfen, Setter-Namen und Setter-Link-Codes eintragen, Links per „E-Mails ohne Versand“ verschicken.
4. 🤖 Setter-Zuweisungen eintragen (Team → „Setter zuweisen“).

## 6. Betrieb 🤖

- **Backup**: Coolify → Datenbank → Backups → täglich 03:00, 30 Tage, Ziel S3-kompatibel (z. B. Strato HiDrive S3). Einmal Wiederherstellung testen.
- **Tägliche Erinnerungen**: Coolify → App → Scheduled Tasks → täglich 08:00
  `curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/reminders`
- **Überwachung**: Coolify-Benachrichtigungen (E-Mail) bei fehlgeschlagenem Deploy/Health-Check; zusätzlich externer Check auf `/api/health`.
- **Updates**: Push auf `main` → CI (Tests + Docker-Build) → in Coolify „Redeploy“ (oder automatisch).
- **Zwei-Faktor-Pflicht** für Admins einschalten, sobald alle eingerichtet sind (`ADMIN_2FA_PFLICHT` in `src/server/auth.ts`).

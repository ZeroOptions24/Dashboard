# Offene Punkte für EnergyEngel

Stand: 25.09.2026. Die Technik für Login, Einladung, Datenerfassung, Vertrag, Unterschrift und Zugang ist gebaut und lokal durchgetestet. Für den echten Betrieb fehlen nur noch Zugänge und Inhalte von euch.

## Vor dem Livegang (Pflicht)

- [ ] **Server / Hosting** (Frist 23.10.2026): EU-Server mit PostgreSQL, z. B. Hetzner + Coolify. Danach `DATABASE_URL` setzen und `npm run db:migrate` ausführen.
- [ ] **Schlüssel erzeugen** und auf dem Server hinterlegen (nie ins Repo):
  - `BETTER_AUTH_SECRET` – `openssl rand -base64 32`
  - `DATA_ENCRYPTION_KEY` – `openssl rand -base64 32` → **sicher aufbewahren** (z. B. im Passwort-Manager). Geht er verloren, sind gespeicherte IBANs nicht mehr lesbar.
- [ ] **E-Mail-Absender**: Adresse festlegen (z. B. `team@energyengel.com`) und SMTP-Zugang eintragen: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`. Bei Microsoft 365: `smtp.office365.com`, Port 587.
- [ ] **Signing-Tool (Empfehlung: Yousign)**:
  1. Konto anlegen und AV-Vertrag abschließen
  2. API-Key erzeugen → `YOUSIGN_API_KEY`, erst mit `YOUSIGN_SANDBOX=1` testen
  3. Webhook anlegen: Adresse `https://<eure-domain>/api/signing/webhook`, Ereignis `signature_request.done` → Secret als `YOUSIGN_WEBHOOK_SECRET`
  4. `SIGNING_PROVIDER=yousign` setzen
  - Hinweis: Die Yousign-Anbindung ist nach deren API-Dokumentation gebaut, aber mangels Zugang noch nicht gegen die echte API getestet. Beim ersten Test in der Sandbox gemeinsam prüfen.
- [ ] **Vertragsvorlagen** (Word oder PDF), vom Anwalt freigegeben:
  - Handelsvertretervertrag (§ 84 HGB)
  - Provisionsvereinbarung Setting / Presetting / Closing
  - Bis dahin verschickt das System einen deutlich gekennzeichneten **Platzhalter**-Vertrag (`src/server/contracts.ts`).
- [ ] **Datenschutzhinweise für MAs** (Text für `/datenschutz`): welche Daten, wofür, Speicherdauer, Zugriff, Rechte.
- [ ] **AV-Verträge** mit Hoster, Yousign, E-Mail-Anbieter, Pipedrive, n8n.

## Später / nice to have

- [ ] Erinnerungen, wenn Formular oder Unterschrift nach 2–3 Tagen fehlen (braucht einen zeitgesteuerten Job auf dem Server).
- [ ] Zweiter Faktor (App-Code) für Admin-Konten.
- [ ] Bestehende MAs (Tim, Florian, Max …) einladen und mit „Direkt freischalten“ ohne neuen Vertrag aktivieren.
- [ ] Offene Frage: Woran erkennt man Presetter und Closer in Pipedrive (Deal-Owner, Feld „VQ Berater“)?

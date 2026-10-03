# Verzeichnis von Verarbeitungstätigkeiten – Entwurf neuer Einträge (MB-Dashboard)

> Entwurf als Vorlage für Anwalt/DSB, Stand 03.10.2026. Felder mit **[PRÜFEN]** rechtlich bewerten.

## A) Verwaltung der Vertriebsmitarbeitenden (Onboarding, Stammdaten, Verträge, Auszahlungen)
- **Zweck**: Onboarding, Vertragsabschluss, Provisionsabrechnung, Kommunikation
- **Betroffene**: Setter, Presetter, Closer, Admins
- **Daten**: Name, E-Mail, Telefon, Anschrift, Geburtsdatum, IBAN (verschlüsselt), Steuernummer, Kleinunternehmer/Gewerbe, Vertrags-PDFs, Auszahlungen
- **Rechtsgrundlage**: Art. 6 (1) b, c **[PRÜFEN]**
- **Empfänger**: Admins; Strato (Hosting); E-Mail-Anbieter; Yousign (sobald angebunden)
- **Drittland**: keine (Server DE) **[PRÜFEN je E-Mail-/Signatur-Dienst]**
- **Löschfrist**: **[PRÜFEN]**
- **TOM**: siehe unten

## B) Vertriebssteuerung (Leads, Anrufe, Termine, Kennzahlen)
- **Zweck**: Bearbeitung von Interessenten (Wärmepumpe/Enpal), Terminvereinbarung, Leistungsübersicht
- **Betroffene**: Interessenten/Kunden; Mitarbeitende (Leistungsdaten)
- **Daten Kunden**: Name, Anschrift, Telefon, E-Mail, Thema, Entscheider, Rückrufwunsch, Notizen, Vorqualifizierung (Haus, Heizung, Eigentum, Haushaltseinkommen-Spanne), GPS-Standort beim Erfassen, Anrufversuche, Termine, Ergebnis
- **Daten Mitarbeitende**: Zuordnung zu Leads, Anrufe, Quoten, Ranglisten
- **Rechtsgrundlage**: Kunden Art. 6 (1) b (vorvertraglich auf Anfrage) / f **[PRÜFEN]**; Mitarbeitende b/f **[PRÜFEN]**
- **Empfänger**: Mitarbeitende je Rolle (Setter: eigene Leads, Telefon maskiert; Presetter: offener Pool; Closer: eigene Termine), Pipedrive (CRM), n8n (bisheriges Formular), Strato, OpenStreetMap/Nominatim (Standort → Adresse)
- **Drittland**: **[PRÜFEN: Pipedrive, n8n Cloud]**
- **Löschfrist**: **[PRÜFEN – z. B. abgesagte Leads nach X Monaten]**

## C) Protokollierung und Sicherheit
- **Zweck**: Nachvollziehbarkeit sensibler Zugriffe, Missbrauchsschutz
- **Daten**: wer, wann, welche Aktion (z. B. IBAN angesehen, Vertrag gesendet, Lead gelöscht), Sitzungsdaten (IP, Browser)
- **Rechtsgrundlage**: Art. 6 (1) f **[PRÜFEN]**
- **Löschfrist**: **[PRÜFEN]**

## Technische und organisatorische Maßnahmen (Auszug, technisch umgesetzt)
- Server in Deutschland (Strato), Firewall nur 22/80/443, SSH nur mit Schlüssel, automatische Sicherheitsupdates, Schutz gegen Passwort-Raten
- HTTPS (Let’s Encrypt), Sicherheits-Header, keine Einbettung in fremde Seiten
- Rollen- und Rechtekonzept serverseitig geprüft; Telefonnummern nur für berechtigte Rollen
- IBAN AES-256-GCM-verschlüsselt; Schlüssel getrennt gesichert
- Passwörter gehasht; Zwei-Faktor für Admins vorbereitet
- Protokoll sensibler Zugriffe; Datenauskunft je Person
- Tägliche Datenbanksicherung (30 Tage), Wiederherstellung getestet 03.10.2026
- Offen: externe Sicherungskopie, Löschkonzept, Überwachung mit Alarm

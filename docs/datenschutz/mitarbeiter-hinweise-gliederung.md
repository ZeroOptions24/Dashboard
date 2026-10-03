# Datenschutzhinweise für Mitarbeitende im MB-Dashboard – Gliederung (Entwurf)

> Entwurf als Vorlage für Anwalt/DSB. Fakten stammen aus dem tatsächlichen Aufbau des Dashboards (Stand 03.10.2026).

## 1. Verantwortlicher
EnergyEngel – Firmierung, Anschrift, Kontakt **[PRÜFEN: genaue Firma]**. Datenschutzbeauftragter, falls bestellt **[PRÜFEN]**.

## 2. Welche Daten wir verarbeiten
- **Konto**: Name, E-Mail, Rolle(n), Passwort (nur als sicherer Hash), optional Zwei-Faktor-Geheimnis, Anmeldezeitpunkte/Sitzungen (IP-Adresse und Browser der Sitzung).
- **Stammdaten** (Onboarding-Formular): Anschrift, Geburtsdatum, Telefon, IBAN (verschlüsselt gespeichert, AES-256), Kontoinhaber, Steuernummer, Kleinunternehmer-Status, Gewerbeanmeldung, Zeitpunkt der Kenntnisnahme dieser Hinweise.
- **Vertrag**: erzeugte Vertrags-PDFs, Status, Unterschriftszeitpunkt, Rückfragen.
- **Tätigkeit im Vertrieb**: erfasste Leads (Setter), Anrufversuche, Rückrufe, Notizen, Vorqualifizierung, Termine, Rückmeldungen (Presetter/Closer), daraus berechnete Kennzahlen und Ranglisten (für Kolleg:innen sichtbar: Vorname + Anzahl), Zusagen zu Events, Monatsziel.
- **Abrechnung**: Provisionen und Auszahlungen.
- **Protokoll**: sicherheitsrelevante Aktionen (z. B. wer wann eine IBAN angesehen hat).
- **Standort**: nur wenn an der Haustür „Adresse per Standort“ gedrückt wird – der Standort des Geräts wird zur Adresssuche an OpenStreetMap (Nominatim) gesendet und mit dem Lead gespeichert.

## 3. Zwecke und Rechtsgrundlagen **[PRÜFEN]**
- Durchführung der Zusammenarbeit (Handelsvertreter-/Vertriebsvertrag), Abrechnung und Auszahlung → Art. 6 Abs. 1 lit. b DSGVO
- Steuer- und handelsrechtliche Pflichten → lit. c
- Sicherheit des Systems, Protokollierung, Missbrauchsschutz → lit. f
- Leistungsübersichten, Ranglisten, Wettbewerbe → lit. b oder f **[PRÜFEN, ggf. Einwilligung]**

## 4. Wer Zugriff hat
- Admins (Geschäftsführung/Teamleitung): alle Daten; Abruf der vollen IBAN wird protokolliert.
- Kolleg:innen: nur Vorname, Rolle, Ranglistenwerte, Zusagen zu Events.
- Dienstleister (Auftragsverarbeiter): Strato (Server, Deutschland), Pipedrive (CRM), n8n (Automatisierung), Yousign (Unterschrift, sobald angebunden), E-Mail-Anbieter. **[PRÜFEN: Drittlandübermittlung je Dienst, z. B. n8n Cloud, Pipedrive]**

## 5. Speicherort und Sicherheit
Eigener Server in Deutschland (Strato), verschlüsselte Verbindung (HTTPS), IBAN verschlüsselt, tägliche Sicherung (30 Tage), Zugriff nur mit Passwort (Admins zusätzlich Zwei-Faktor).

## 6. Speicherdauer **[PRÜFEN – Löschkonzept fehlt noch]**
Vorschlag: Konto und Tätigkeitsdaten bis Ende der Zusammenarbeit + X Monate; Abrechnungsdaten nach steuerlichen Fristen (6/10 Jahre); Protokolle X Monate; Sicherungen 30 Tage.

## 7. Rechte
Auskunft (Datenauskunft wird im Dashboard als Datei erstellt), Berichtigung (Stammdaten selbst änderbar), Löschung, Einschränkung, Widerspruch, Datenübertragbarkeit, Beschwerde bei der Aufsichtsbehörde **[PRÜFEN: zuständige Behörde]**.

## 8. Stand / Änderungen
Datum, Versionshinweis.

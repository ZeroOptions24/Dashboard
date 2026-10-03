# Kundeninformation an der Haustür – Fakten + Formulierungsvorschlag (Entwurf)

> Entwurf als Vorlage für Anwalt/DSB. **Keine Rechtsberatung.** Ob und wie die Information (Art. 13 DSGVO) gegeben wird – mündlich, Flyer/Karte mit Link oder QR-Code –, entscheidet der Anwalt.

## Was technisch passiert, wenn ein Setter einen Lead erfasst
1. Erfasst werden: Anrede, Name, Telefon, E-Mail, Anschrift, Thema, ob alle Entscheider dabei sind, Rückrufwunsch, Notizen des Setters, optional Vorqualifizierung (Haus, Heizung, Dämmung, Eigentum, Haushaltseinkommen als Spanne, Smartphone vorhanden).
2. Optional „Adresse per Standort“: der Standort des Setter-Handys wird an OpenStreetMap (Nominatim) gesendet, um die Adresse zu ermitteln; der Standort wird mit dem Lead gespeichert.
3. Die Daten werden im MB-Dashboard (Server in Deutschland) und im CRM Pipedrive gespeichert; beim bisherigen Formular zusätzlich über n8n verarbeitet.
4. Das Presetting ruft an, um einen Termin zu vereinbaren; ein Energieberater (Closer) kommt zum Termin.

## Formulierungsvorschlag für eine kurze Information (z. B. Karte zum Hinterlassen) **[PRÜFEN]**
> **Ihre Daten bei EnergyEngel**
> Sie haben uns erlaubt, Sie zu Ihrer Heizung / Wärmepumpe zu kontaktieren. Dafür speichern wir Ihren Namen, Ihre Kontaktdaten, Ihre Anschrift und Ihre Angaben zum Haus. Wir nutzen die Daten nur, um Sie zu beraten und einen Termin zu vereinbaren. Sie können jederzeit Auskunft, Berichtigung oder Löschung verlangen und der Nutzung widersprechen: **[Kontakt]**. Ausführliche Informationen: **[Link/QR zur Datenschutzerklärung]**.

## Offene Punkte für den Anwalt
- Rechtsgrundlage für die Kontaktaufnahme (Anfrage an der Tür → vorvertraglich?) und für die Einkommensspanne
- Ob der GPS-Standort gespeichert werden darf bzw. nur zur Adresssuche genutzt und dann verworfen werden soll (technisch beides möglich)
- Speicherdauer für abgesagte/nicht erreichte Leads
- Drittlandbezug Pipedrive / n8n

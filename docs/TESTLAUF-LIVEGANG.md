# Testlauf beim Livegang: Lead → Presetter → Closer

Ziel: einmal den ganzen Weg mit einem Test-Kunden auf dem echten Server, danach aufräumen. Dauer ca. 20 Minuten.
Beteiligt: 1 Admin (führt durch), 1 Setter, 1 Presetter, 1 Closer – geht auch mit einer Person, die alle Rollen hat und oben rechts die Rolle wechselt.

## 0. Vorbereitung (Admin)

1. Server läuft, `https://<domain>/api/health` zeigt `{"ok":true}`.
2. Team importiert, Rollen geprüft (mind. 1 Setter, 1 Presetter, 1 Closer haben Zugang).
3. **Team → „Pipedrive-Pipeline fürs Dashboard“ → „Pipeline in Pipedrive anlegen“** (bzw. „Stufen aktualisieren“, falls sie schon mit 4 Stufen angelegt wurde).
   Ergebnis prüfen: Pipeline „MB-Dashboard Wärmepumpe“ mit 9 Stufen (Lead eingereicht · An Presetter übergeben · 2.–4. Kontaktversuch · 5. Anruf + · An Closer übergeben · Aufmaßtermin · Checks · Verkaufstermin · Verkauf · Auszahlung) und Feldern „MB …“. Steht dort „Fehlt in Pipedrive: …“, Bescheid geben.
4. Der Closer trägt für morgen 2 freie Slots ein (Kalender → Slots eintragen).

## 1. Setter: Lead erfassen (Handy)

Test-Kunde (bitte genau so, damit man ihn erkennt):

| Feld | Wert |
| --- | --- |
| Anrede | Herr |
| Vorname / Nachname | **TEST** / Livegang |
| Telefon | eigene Handynummer des Setters |
| E-Mail | eigene E-Mail |
| Adresse | „Adresse per Standort ausfüllen“ testen, dann prüfen |
| Thema | Wärmepumpe |
| Rückrufwunsch | morgen, 18:00 |
| Notizen | „Testlauf – bitte nicht anrufen“ |

→ „Direkt an der Tür vorqualifizieren“ → 3–4 Fragen beantworten (z. B. Wohnfläche 140, Heizung Gas) → „Rest telefonisch“ → **Termin vormerken** (freier Slot des Closers).
**Prüfen:** Closer bekommt noch **keine** Nachricht, sieht im Kalender nur „reserviert“. Presetter bekommt „Termin vorgemerkt …“.

**Prüfen:** Meldung „angelegt“ ohne Warnung. In Pipedrive: neue Person **mit Adresse**, Deal „Wärmepumpe – TEST Livegang“ in der Pipeline „MB-Dashboard Wärmepumpe“, Stufe „An Presetter übergeben“, Felder MB Setter-Notiz, MB Rückrufwunsch, MB PLZ/Ort, Setter, VQ-Felder befüllt.

## 2. Presetter: qualifizieren und Termin legen

1. Übersicht → Anrufliste: „TEST Livegang“ suchen.
2. „Anrufen“ → Leitfaden. **Prüfen:** Adresse, Rückrufwunsch, Setter-Notiz und die Vorqualifizierung von der Tür sind sichtbar.
3. „Mailbox“ drücken → **Dashboard:** Lead steht in „Terminierung“. **Pipedrive:** Stufe „2.–4. Kontaktversuch“, Feld „MB Anrufversuche“ = 1, Notiz „Nicht erreicht (Versuch 1) – Mailbox“.
4. Lead wieder öffnen. **Prüfen:** Hinweis „… Antworten hat … schon an der Tür aufgenommen“, diese Fragen sind ausgeblendet. Restliche Vorqualifizierung ergänzen (1–2 Fragen).
5. Unten „Vorgemerkten Termin bestätigen“ → **Termin bestätigen**. (Ohne Vormerkung: freien Slot wählen oder „Termin direkt eintragen“.)
   **Pipedrive:** Stufe „An Closer übergeben · Aufmaßtermin“, Felder „MB Closer“, „MB Termin“, „MB Presetter“ befüllt. Der Setter hat eine Benachrichtigung.

## 3. Closer: ansehen und weiterverarbeiten

1. Glocke: „Neuer Aufmaßtermin: TEST Livegang …“.
2. Termine → Termin öffnen. **Prüfen:** Adresse + „Route“, Telefon, Setter-Notiz, Vorqualifizierung.
3. Rückmeldung „Aufmaß fand statt – Kunde in den Checks“ mit Verkaufstermin.
   **Pipedrive:** Stufe „Verkaufstermin“ (ohne eingetragenen Termin: „Checks“). Setter bekommt Benachrichtigung.
4. Verkaufstermin: Rückmeldung „Verloren“, Grund „Sonstiges“, Notiz „Testlauf“.
   **Pipedrive:** Deal verloren mit Grund „Sonstiges – Testlauf“.

## 4. Aufräumen (Admin)

Lead „TEST Livegang“ öffnen → **„Lead löschen (Test/Fehleingabe)“**. Der Deal geht in Pipedrive in den Papierkorb, die Person bitte in Pipedrive von Hand löschen.

## Wenn etwas hakt

- Meldung „Lead gespeichert, Pipedrive folgt“: Team → Pipeline-Karte → „Übertragung nachholen“; Fehlertext an die Entwicklung.
- Lead fehlt beim Setter: Rolle „Setter“ vorhanden? Richtig angemeldet?
- Closer sieht den Termin nicht: hat er die Rolle „Closer“? Termin wirklich bei ihm eingetragen?

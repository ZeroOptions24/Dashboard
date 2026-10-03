# MB-Dashboard – Kurzanleitungen

Eine Seite je Rolle. Wer mehrere Rollen hat, wechselt oben rechts unter „Rolle“.

---

## Für alle: Erste Schritte

1. Zugangslink öffnen (kommt per E-Mail oder WhatsApp, nur einmal gültig).
2. Stammdaten ausfüllen: Adresse, Geburtsdatum, IBAN (für die Auszahlung). Die IBAN wird verschlüsselt gespeichert.
3. Eigenes Passwort festlegen. Danach anmelden unter der Dashboard-Adresse.
4. **Aufs Handy holen:** Seite im Handy-Browser öffnen →
   - iPhone (Safari): Teilen-Symbol → „Zum Home-Bildschirm“
   - Android (Chrome): Menü ⋮ → „App installieren“ bzw. „Zum Startbildschirm hinzufügen“
5. Glocke oben rechts = Benachrichtigungen (Aufmaßtermin gelegt, Rückmeldung, Abrechnung …).

---

## Setter

**Lead an der Tür erfassen** → Menü „Lead erfassen“ (ersetzt das bisherige Formular)
1. **Kontaktdaten**: Anrede, Vor- und Nachname, Telefon, E-Mail (Pflicht). „Adresse per Standort ausfüllen“ füllt Straße, PLZ und Ort per GPS – **Hausnummer immer prüfen**.
2. **Termin & Rückruf**: Thema, sind alle Entscheider dabei, Rückrufwunsch (Datum/Uhrzeit oder Zeitfenster).
3. **Notizen aus dem Gespräch**: alles, was das Presetting wissen muss (Heizung, Hund, „Frau entscheidet mit“ …).
4. **„Lead erstellen“** → der Lead ist sofort im Dashboard und als Deal in Pipedrive (Pipeline „MB-Dashboard Wärmepumpe“) – mit dir als Setter, ohne Setter-Link.
   - Warnt das Dashboard „Diesen Kunden gibt es vermutlich schon“: nur „Trotzdem anlegen“, wenn es wirklich ein anderes Haus ist.
5. Optional **„Direkt an der Tür vorqualifizieren“**: Fragen zum Haus, zur Heizung, zum Eigentum. Teilweise reicht – den Rest klärt das Presetting am Telefon.
6. Optional **Termin legen**: freien Closer-Slot wählen oder „Termin direkt eintragen“ (Datum, Uhrzeit, Closer).

Alles wird als eigenes Feld gespeichert (nicht nur als Notiz) – Presetter und Closer sehen Adresse, Rückrufwunsch, Notizen und Vorqualifizierung direkt.

**Übersicht**: Dein Geld (Monat), Tagesziel (5 Leads), deine Quote im Vergleich zum Team, Setter-Rangliste, letzte Leads.
**Pipeline**: alle deine Leads mit Stand – 7 Stufen: Lead eingereicht · Terminierung (Presetter in Kontakt) · Aufmaßtermin · Checks · Verkaufstermin · Verkauf · Ausgezahlt. Lead antippen → Verlauf (auch, wann das Presetting angerufen hat).

> Fehlt ein Lead bei dir? Dann steht in Pipedrive ein anderer oder kein Setter. Kurz beim Admin melden – er weist ihn dir im Dashboard zu.

---

## Presetter

**Anrufliste** (Übersicht) – alle offenen Leads, dringendste oben. Suchen (Name, Ort, Telefon) und filtern: Überfällig · Rückruf vereinbart · Noch nicht angerufen · Mit Versuchen.

**Telefonleitfaden** → „Anrufen“ öffnet Skript und wählt die Nummer.
- **Nicht erreicht** / **Mailbox** → Versuch wird gezählt, nächster Versuch vorgeschlagen, weiter zum nächsten Lead.
- **Rückruf vereinbaren** → Datum/Uhrzeit; zur Zeit erscheint oben „Rückruf ist jetzt dran“.
- **Abgesagt** (mit Grund) · **Falsche Nummer** (sofort abgesagt).
- **Termin legen**: freien Closer-Slot wählen oder „Termin direkt eintragen“. Setter und Closer werden informiert.
- Notizen und Vorqualifizierung werden automatisch gespeichert.
- Hinweis „… hat diesen Lead gerade offen“: Kollegin telefoniert vermutlich gerade – lieber den nächsten nehmen.

**Kennzahlen**: Anrufe heute (Ziel 30), Ø Zeit bis zum ersten Anruf (Ziel 2 Std.), Terminquote – jeweils mit Teamschnitt.

> Pipedrive wird vom Dashboard (noch) nicht verändert: Termin/Absage bitte wie bisher auch in Pipedrive nachziehen.

---

## Closer

**Kalender** → „Slots eintragen“: Tag, von–bis, optional „4 Wochen wiederholen“. Freie Slots sieht das Presetting zum Buchen.
**Termine** → anstehende Termine mit Adresse, Route, Telefon, Kundensteckbrief.
**Rückmeldung nach jedem Termin – Pflicht innerhalb 24 Std.**: Aufmaß fand statt (Checks, mit Verkaufstermin) · Nicht angetroffen (zurück an den Presetter) · Verloren (Grund) · Verkauft. Ohne Rückmeldung bekommst du keine neuen Termine.
**Wärmepumpen-Cup**: dein Platz im Wettbewerb.

---

## Admin

- **Team & Setter**: einladen, bestehende MAs übernehmen (Liste), Rollen ändern, sperren, löschen, Details + IBAN (protokolliert), Datenauskunft (JSON).
  - Je Setter: **Pipedrive-Setter** (Name wie im Pipedrive-Feld) und **Setter-Link-Code**.
  - **Setter zuweisen**: Liste `Deal-ID – Setter` → Vorschau → übernehmen. Gilt vor dem Pipedrive-Feld, Pipedrive bleibt unverändert.
  - **E-Mails ohne Versand**: Links kopieren und per WhatsApp schicken, solange kein E-Mail-Versand eingerichtet ist.
  - **Protokoll**: wer hat wann was getan.
- **Verträge**: senden, erinnern, Rückfragen klären.
- **Ranglisten**: Wärmepumpen-Cup pflegen, veröffentlichen, abschließen & neuen starten.
- **Events**: posten (Zielgruppe wird benachrichtigt).
- **Auszahlungen**: Abrechnungen freigeben.
- In Lead-Details: **Setter zuweisen**.

---

## WhatsApp-Vorlage: Zugang verschicken

> Hi {Vorname}! 👋 Ab sofort arbeiten wir mit dem EnergyEngel MB-Dashboard – da siehst du deine Leads, Termine, Rangliste und dein Geld auf einen Blick.
>
> Dein persönlicher Link (nur für dich, nur einmal gültig):
> {Link}
>
> 1. Link öffnen, Stammdaten + IBAN ausfüllen (für die Auszahlung)
> 2. Passwort festlegen
> 3. Tipp: Seite aufs Handy legen („Zum Home-Bildschirm“)
>
> Fragen? Melde dich einfach. 🙌

## WhatsApp-Vorlage: neuer Setter-Link

> Hi {Vorname}, hier ist dein persönlicher Setter-Link für neue Leads an der Tür: {Link}
> Bitte **nur diesen** Link benutzen (nicht den von Kollegen) – sonst landen deine Leads nicht bei dir.

# EnergyEngel MB-Dashboard

Dashboard für die MBs (Setter, Presetter, Closer) und Admins: Leads und Status aus Pipedrive, Zahlen, Ranglisten, Events, Auszahlungen, Verträge (DocuSign) und Stammdaten.

**Stand:** UI-Prototyp in Next.js übernommen – nur Beispieldaten, noch kein Backend. Echte Kunden- und Setter-Daten erst nach der Datenschutz-Freigabe (eigener Server, AV-Verträge).

## Starten

```bash
npm install
npm run dev
```

Dann http://localhost:3000 öffnen. Oben rechts lässt sich die Rolle wechseln (Setter, Presetter, Closer, Admin).

## Pipedrive anbinden

1. `.env.example` nach `.env.local` kopieren.
2. `PIPEDRIVE_API_TOKEN` eintragen (Pipedrive → Persönliche Einstellungen → API).
3. `NEXT_PUBLIC_DATA_SOURCE=pipedrive` setzen und `npm run dev` neu starten.

Das Dashboard lädt dann alle Wärmepumpen-Deals der Pipeline „Empfehlung kommt“ (ID 21). Telefonnummern werden maskiert, und `/api/leads` antwortet nur im lokalen Entwicklungsmodus, solange es keinen Login gibt.

**Noch zu klären** (Zuordnung in `src/server/pipedrive/config.ts`):
- Stufen → Status: „An Mitarbeiter übergeben“ und „Mitarbeiter in Bearbeitung“ gelten als *Termin gelegt*; „Später Interessant“, „Anderes Potential“ und „Ablehnung“ als *Abgesagt*.
- Setter: kommt aus dem Deal-Feld „Setter“ (Name, von n8n gesetzt). Besser wäre eine feste Setter-ID.
- Presetter und Closer: Woran erkennt man sie in Pipedrive (Deal-Owner, Feld „VQ Berater“)?
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
| `src/components/` | React-Komponenten (umgestellt: Pipeline) |
| `src/server/pipedrive/` | Pipedrive-Anbindung (nur Server): Client, Zuordnung Stufen/Felder, Deal → Lead |
| `src/app/api/leads/route.ts` | Endpunkt `/api/leads` – vorerst nur lokal, bis Login steht |
| `src/legacy/prototype.js` | **Übergangsschicht:** Ansichten und Logik des Prototyps, unverändert übernommen |

Vorlage: [`mb-dashboard.html`](https://zerooptions24.github.io/EnergyEngel/mb-dashboard.html) im Repo `ZeroOptions24/EnergyEngel`.

## Nächste Schritte

1. Ansichten schrittweise in React-Komponenten umbauen, danach `src/legacy/` löschen.
2. Datenbank (PostgreSQL) und Login mit Rollen.
3. Anbindungen: Pipedrive (Status, Zahlen, Ranglisten, Auszahlungen), Kalender, DocuSign, n8n-Webhooks.
4. Hosting auf eigenem EU-Server (geplant: Hetzner + Coolify).

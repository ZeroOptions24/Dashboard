# EnergyEngel MB-Dashboard

Dashboard für die MBs (Setter, Presetter, Closer) und Admins: Leads und Status aus Pipedrive, Zahlen, Ranglisten, Events, Auszahlungen, Verträge (DocuSign) und Stammdaten.

**Stand:** UI-Prototyp in Next.js übernommen – nur Beispieldaten, noch kein Backend. Echte Kunden- und Setter-Daten erst nach der Datenschutz-Freigabe (eigener Server, AV-Verträge).

## Starten

```bash
npm install
npm run dev
```

Dann http://localhost:3000 öffnen. Oben rechts lässt sich die Rolle wechseln (Setter, Presetter, Closer, Admin).

## Aufbau

| Pfad | Inhalt |
| --- | --- |
| `src/app/layout.tsx` | HTML-Grundgerüst, Schriften (lokal über `next/font`, keine Google-Anfragen aus dem Browser) |
| `src/app/page.tsx` | App-Shell: Seitenleiste, Kopfzeile, Container für Ansichten und Overlays |
| `src/app/globals.css` | Design-Tokens (hell/dunkel) und alle `ee-`-Komponenten-Styles |
| `src/lib/types.ts` | Datenmodell (Lead, Termin, Auszahlung, Vertrag, …) – Schnittstelle zur späteren Datenquelle |
| `src/lib/domain.ts` | Geschäftsregeln: Pipeline-Status, Provisionssätze, Verlustgründe, Leitfaden |
| `src/lib/demo-data.ts` | Beispieldaten (`createDemoData()`), wird später durch Datenbank/Pipedrive ersetzt |
| `src/legacy/prototype.js` | **Übergangsschicht:** Ansichten und Logik des Prototyps, unverändert übernommen |

Vorlage: [`mb-dashboard.html`](https://zerooptions24.github.io/EnergyEngel/mb-dashboard.html) im Repo `ZeroOptions24/EnergyEngel`.

## Nächste Schritte

1. Ansichten schrittweise in React-Komponenten umbauen, danach `src/legacy/` löschen.
2. Datenbank (PostgreSQL) und Login mit Rollen.
3. Anbindungen: Pipedrive (Status, Zahlen, Ranglisten, Auszahlungen), Kalender, DocuSign, n8n-Webhooks.
4. Hosting auf eigenem EU-Server (geplant: Hetzner + Coolify).

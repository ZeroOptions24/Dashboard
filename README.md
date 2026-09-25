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
| `src/legacy/prototype.js` | **Übergangsschicht:** Logik und Beispieldaten des Prototyps, unverändert übernommen |

Vorlage: [`mb-dashboard.html`](https://zerooptions24.github.io/EnergyEngel/mb-dashboard.html) im Repo `ZeroOptions24/EnergyEngel`.

## Nächste Schritte

1. Beispieldaten aus `src/legacy/prototype.js` in ein typisiertes Datenmodul auslagern (Schnittstelle für die spätere Datenbank).
2. Ansichten schrittweise in React-Komponenten umbauen, danach `src/legacy/` löschen.
3. Datenbank (PostgreSQL) und Login mit Rollen.
4. Anbindungen: Pipedrive (Status, Zahlen, Ranglisten, Auszahlungen), Kalender, DocuSign, n8n-Webhooks.
5. Hosting auf eigenem EU-Server (geplant: Hetzner + Coolify).

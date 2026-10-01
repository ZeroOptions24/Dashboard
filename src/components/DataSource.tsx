"use client";

import { useEffect, useState } from "react";
import { reloadLeads, reloadWorkspace } from "@/lib/live";
import { LIVE } from "@/lib/store";

/* Datenquelle: NEXT_PUBLIC_DATA_SOURCE=pipedrive lädt echte Daten – Leads und Kennzahlen aus
   Pipedrive (auf dem Server nach angemeldeter Person gefiltert) und den Team-Alltag aus der
   Datenbank. Sonst bleiben die Beispieldaten des Prototyps. */

export default function DataSource() {
  const [state, setState] = useState<string | null>(LIVE ? "Lade Daten …" : null);

  useEffect(() => {
    if (!LIVE) return;
    let cancelled = false;
    const pipedrive = reloadLeads();
    pipedrive.catch(() => {}); /* Fehler wird unten angezeigt */
    (async () => {
      await reloadWorkspace();
      let msg: string;
      try {
        msg = await pipedrive;
      } catch (e) {
        /* Keine Beispieldaten im echten Betrieb – lieber leer mit klarer Meldung */
        msg = `Pipedrive-Fehler: ${(e as Error).message} – Leads konnten nicht geladen werden`;
      }
      if (cancelled) return;
      setState(msg);
      setTimeout(() => !cancelled && setState(null), 4000);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!state) return null;
  return (
    <div className="ee-toasts" style={{ bottom: "auto", top: 72 }} aria-live="polite">
      <div className="ee-toast">
        <span>{state}</span>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { notify, store } from "@/lib/store";
import type { Lead } from "@/lib/types";

/* Datenquelle umschalten: NEXT_PUBLIC_DATA_SOURCE=pipedrive lädt die Leads über
   /api/leads aus Pipedrive, sonst bleiben die Beispieldaten. */
const SOURCE = process.env.NEXT_PUBLIC_DATA_SOURCE === "pipedrive" ? "pipedrive" : "demo";

export default function DataSource() {
  const [state, setState] = useState<string | null>(SOURCE === "pipedrive" ? "Lade Leads aus Pipedrive …" : null);

  useEffect(() => {
    if (SOURCE !== "pipedrive") return;
    let cancelled = false;
    fetch("/api/leads")
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error || `HTTP ${r.status}`);
        return body.leads as Lead[];
      })
      .then((leads) => {
        if (cancelled) return;
        /* in place ersetzen, damit Übergangsschicht und React dasselbe Array behalten */
        store.data.LEADS.splice(0, store.data.LEADS.length, ...leads);
        store.data.APPTS.splice(0);
        if (store.legacy) store.legacy.render();
        else notify();
        setState(`Pipedrive · ${leads.length} Leads`);
      })
      .catch((e: Error) => !cancelled && setState(`Pipedrive-Fehler: ${e.message} – zeige Beispieldaten`));
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

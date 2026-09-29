"use client";

import { useEffect, useState } from "react";
import { applyLiveLeads, applyLiveStats } from "@/lib/store";
import type { Lead } from "@/lib/types";

/* Datenquelle umschalten: NEXT_PUBLIC_DATA_SOURCE=pipedrive lädt die Leads über
   /api/leads aus Pipedrive – bereits auf dem Server nach angemeldeter Person gefiltert –,
   sonst bleiben die Beispieldaten. */
const SOURCE = process.env.NEXT_PUBLIC_DATA_SOURCE === "pipedrive" ? "pipedrive" : "demo";

export default function DataSource() {
  const [state, setState] = useState<string | null>(SOURCE === "pipedrive" ? "Lade Leads aus Pipedrive …" : null);

  useEffect(() => {
    if (SOURCE !== "pipedrive") return;
    let cancelled = false;
    const get = async <T,>(url: string): Promise<T> => {
      const r = await fetch(url);
      const body = await r.json();
      if (!r.ok) throw new Error(body.error || `HTTP ${r.status}`);
      return body as T;
    };
    (async () => {
      try {
        const { leads, userKey, note } = await get<{ leads: Lead[]; userKey: string; note?: string }>("/api/leads");
        if (cancelled) return;
        applyLiveLeads(leads, userKey);
        applyLiveStats(await get<Parameters<typeof applyLiveStats>[0]>("/api/stats"));
        if (!cancelled) setState(note ? `Pipedrive: ${note}` : `Pipedrive · ${leads.length} Leads`);
      } catch (e) {
        if (!cancelled) setState(`Pipedrive-Fehler: ${(e as Error).message} – zeige Beispieldaten`);
      }
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

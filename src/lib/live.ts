"use client";

/* Echte Daten aus der Datenbank: Laden, Zähler und Speichern von Änderungen.
   Änderungen erscheinen sofort im Browser; im Live-Modus werden sie zusätzlich auf dem
   Server gespeichert. Schlägt das fehl, gibt es eine Meldung und der Stand wird neu geladen. */

import { contractSummaryAction } from "@/app/actions/contracts";
import { loadWorkspaceAction } from "@/app/actions/workspace";
import { applyWorkspace, LIVE, notify, store } from "./store";
import { toast } from "./ui";

export async function refreshContractSummary() {
  const res = await contractSummaryAction();
  if (!res.ok) return;
  store.live.contracts = res.data;
  notify();
}

export async function reloadWorkspace(): Promise<boolean> {
  const res = await loadWorkspaceAction();
  if (!res.ok) {
    toast(`Daten konnten nicht geladen werden: ${res.error}`, "info");
    return false;
  }
  applyWorkspace(res.data);
  return true;
}

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

/** Änderung auf dem Server speichern (nur im Live-Modus). reload = danach frisch laden (z. B. für neue IDs). */
export function persist<T>(call: () => Promise<Result<T>>, opts: { reload?: boolean; onOk?: (data: T) => void } = {}) {
  if (!LIVE) return;
  void call()
    .then((res) => {
      if (!res.ok) {
        toast(res.error, "info");
        return reloadWorkspace();
      }
      opts.onOk?.(res.data);
      if (opts.reload) return reloadWorkspace();
    })
    .catch(() => {
      toast("Keine Verbindung – Änderung nicht gespeichert", "info");
      void reloadWorkspace();
    });
}

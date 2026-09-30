"use client";

/* Live-Zähler aus der Datenbank (Menü-Zähler, Admin-Übersicht). */

import { contractSummaryAction } from "@/app/actions/contracts";
import { notify, store } from "./store";

export async function refreshContractSummary() {
  const res = await contractSummaryAction();
  if (!res.ok) return;
  store.live.contracts = res.data;
  notify();
}

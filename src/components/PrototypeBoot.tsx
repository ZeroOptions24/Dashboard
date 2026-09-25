"use client";

import { useEffect } from "react";
import { startPrototype } from "@/legacy/prototype";
import { store } from "@/lib/store";
import type { Role } from "@/lib/types";

/* Startet die Prototyp-Logik, sobald das Grundgerüst im Browser steht.
   Vorher werden Rolle und Startansicht aus der Anmeldung übernommen. */
export default function PrototypeBoot({ role, view, name }: { role: Role; view?: string; name: string }) {
  useEffect(() => {
    store.ui.role = role;
    store.session = { name, role };
    if (view) store.ui.view = view;
    startPrototype();
  }, [role, view, name]);
  return null;
}

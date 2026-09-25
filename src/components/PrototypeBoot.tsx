"use client";

import { useEffect } from "react";
import { startPrototype } from "@/legacy/prototype";

/* Startet die Prototyp-Logik, sobald das Grundgerüst im Browser steht. */
export default function PrototypeBoot() {
  useEffect(() => {
    startPrototype();
  }, []);
  return null;
}

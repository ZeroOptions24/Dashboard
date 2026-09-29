"use client";

import { useSyncExternalStore } from "react";

/** true unter 900 px Breite (Handy-Layout wie im Prototyp) */
const MOBILE = "(max-width: 900px)";

export function useMobile() {
  return useSyncExternalStore(
    (cb) => {
      const m = matchMedia(MOBILE);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => matchMedia(MOBILE).matches,
    () => false,
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { openAngel } from "@/lib/ui";

/* Der 3D-Engel (Tims Maskottchen). Modell und Renderer liegen unter /engel/ (eingebettete three.js-Fassung, kein Netzwerk
   nach außen). Geladen wird erst im Browser; ohne WebGL bleibt das „E“-Zeichen bzw. nur die Beschriftung stehen. */

type Angel = { snapshot: () => string };
declare global {
  interface Window {
    EEAngel3D?: (canvas: HTMLCanvasElement, glbBase64: string, opts?: { onReady?: () => void }) => Angel;
  }
}

let scriptLoad: Promise<void> | null = null;
function loadScript() {
  scriptLoad ??= new Promise<void>((resolve, reject) => {
    if (window.EEAngel3D) return resolve();
    const s = document.createElement("script");
    s.src = "/engel/angel3d.js";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Engel-Skript nicht geladen"));
    document.head.appendChild(s);
  });
  return scriptLoad;
}

let glb: Promise<string> | null = null;
function loadGlb() {
  glb ??= fetch("/engel/engel.glb")
    .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error("Engel-Modell nicht geladen"))))
    .then((buf) => {
      const bytes = new Uint8Array(buf);
      let bin = "";
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      return btoa(bin);
    });
  return glb;
}

/** alle eingehängten Engel; für das Bild in Sprechblase und Hilfe zählt der, der gerade sichtbar ist */
const angels: { canvas: HTMLCanvasElement; angel: Angel }[] = [];
export function angelAvatar() {
  try {
    const a = angels.find((x) => x.canvas.isConnected && x.canvas.offsetParent && x.canvas.clientWidth > 0);
    return a ? a.angel.snapshot() : "";
  } catch {
    return "";
  }
}

/** variant side: große Fläche in der Seitenleiste · top: runder Knopf in der Kopfzeile (Handy) */
export default function EngelButton({ variant }: { variant: "side" | "top" }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const cv = canvas.current;
    if (!cv || cv.dataset.mounted) return;
    /* je Leinwand nur einmal – bleibt auch im Entwicklungsmodus (doppelter Effekt) bei einem Renderer */
    cv.dataset.mounted = "1";
    Promise.all([loadScript(), loadGlb()])
      .then(([, b64]) => {
        if (!window.EEAngel3D) return;
        const angel = window.EEAngel3D(cv, b64, { onReady: () => setReady(true) });
        angels.push({ canvas: cv, angel });
      })
      .catch((e) => console.warn("3D-Engel nicht verfügbar", e));
  }, []);

  if (variant === "top")
    return (
      <button className={ready ? "ee-angelbtn is-ready" : "ee-angelbtn"} onClick={openAngel} aria-label="Frag den Engel: Rundgang und Hilfe" data-component="AngelHelper">
        <canvas ref={canvas} data-angel="" />
        <span className="ee-brand__mark" aria-hidden="true">
          E
        </span>
      </button>
    );
  return (
    <button className={ready ? "ee-angel is-ready" : "ee-angel"} onClick={openAngel} aria-label="Frag den Engel: Rundgang und Hilfe" data-component="AngelHelper">
      <canvas ref={canvas} data-angel="" />
      <span className="ee-angel__tip">Frag mich!</span>
    </button>
  );
}

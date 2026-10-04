"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Icon from "@/components/ui/Icon";
import { stepsFor } from "@/lib/engel";
import { store, useStore } from "@/lib/store";
import { go, tourEnd, tourGo } from "@/lib/ui";

/* Rundgang: Der Engel hebt nacheinander die wichtigsten Bereiche hervor und erklärt sie. Pfeiltasten blättern, Esc beendet. */

interface Place {
  ring: React.CSSProperties;
  bubble: React.CSSProperties;
  top: boolean;
}

export default function EngelTour() {
  const { tour, ui, session } = useStore();
  const steps = stepsFor(ui.role, session?.locked);
  const st = tour.on ? steps[tour.i] : undefined;
  const target = useRef<Element | null>(null);
  const [place, setPlace] = useState<Place | null>(null);

  const compute = useCallback(() => {
    const el = target.current;
    /* Bereich nicht da (z. B. noch keine Daten): Hinweis in der Mitte, Rest der Seite abgedunkelt */
    if (!el) return setPlace({ ring: { left: "50%", top: "40%", width: 0, height: 0 }, bubble: innerWidth > 900 ? { left: "50%", top: "30%", transform: "translateX(-50%)" } : {}, top: false });
    const r = el.getBoundingClientRect(),
      pad = 6,
      top = Math.max(4, r.top - pad),
      h = Math.min(r.bottom + pad, innerHeight - 4) - top,
      mobile = innerWidth <= 900;
    const ring: React.CSSProperties = { left: r.left - pad, top, width: r.width + pad * 2, height: Math.max(0, h) };
    let bubble: React.CSSProperties = {};
    if (!mobile) {
      const bw = 340,
        right = r.right + 16 + bw < innerWidth,
        below = r.bottom + 16 + 220 < innerHeight;
      bubble =
        right && r.height < innerHeight * 0.6
          ? { left: r.right + 16, top: Math.max(76, Math.min(r.top, innerHeight - 260)) }
          : below
            ? { left: Math.max(16, Math.min(r.left, innerWidth - bw - 16)), top: r.bottom + 16 }
            : { left: Math.max(16, Math.min(r.left, innerWidth - bw - 16)), top: Math.max(76, r.top + 16) };
    }
    setPlace({ ring, bubble, top: mobile && (r.top + r.bottom) / 2 > innerHeight * 0.5 });
  }, []);

  /* Ansicht wechseln, Bereich suchen (Ansichten laden teils nach), hinscrollen, hervorheben */
  const view = st?.view;
  const sel = st?.sel;
  useEffect(() => {
    if (!view || !sel) return;
    if (store.ui.view !== view) go(view);
    let tries = 0;
    let timer: ReturnType<typeof setTimeout>;
    const find = () => {
      const el = [...document.querySelectorAll(sel)].find((e) => (e as HTMLElement).offsetParent || getComputedStyle(e).position === "fixed") ?? null;
      if (!el && tries++ < 15) {
        timer = setTimeout(find, 100);
        return;
      }
      target.current = el;
      if (el) el.scrollIntoView({ block: (el as HTMLElement).offsetHeight > innerHeight * 0.6 ? "start" : "center" });
      /* nach dem Scrollen neu messen */
      timer = setTimeout(compute, el ? 120 : 0);
    };
    timer = setTimeout(find, 60);
    return () => clearTimeout(timer);
  }, [view, sel, tour.i, compute]);

  /* Position nachführen, Tastatur */
  const on = tour.on && !!st;
  useEffect(() => {
    if (!on) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") tourEnd();
      if (e.key === "ArrowRight") tourGo(1);
      if (e.key === "ArrowLeft") tourGo(-1);
    };
    addEventListener("resize", compute);
    addEventListener("scroll", compute, { passive: true });
    addEventListener("keydown", onKey);
    return () => {
      removeEventListener("resize", compute);
      removeEventListener("scroll", compute);
      removeEventListener("keydown", onKey);
    };
  }, [on, compute]);

  /* Rollenwechsel beendet den Rundgang */
  const role = ui.role;
  const first = useRef(role);
  useEffect(() => {
    if (first.current !== role) {
      first.current = role;
      tourEnd();
    }
  }, [role]);

  if (!tour.on || !st) return null;
  const last = tour.i + 1 >= steps.length;
  return (
    <div className="ee-tour" role="dialog" aria-label="Rundgang">
      <div className="ee-tour__ring" style={place?.ring} />
      <div className={place?.top ? "ee-tour__bubble is-top" : "ee-tour__bubble"} style={place?.bubble} data-component="TourBubble">
        <div className="ee-tour__head">
          {/* eslint-disable-next-line @next/next/no-img-element -- Momentaufnahme des 3D-Engels (data-URL) */}
          {tour.img ? <img src={tour.img} alt="" /> : null}
          <div>
            <span className="eyebrow">
              Schritt {tour.i + 1} von {steps.length}
            </span>
            <h3>{st.t}</h3>
          </div>
        </div>
        <p>{st.x}</p>
        <div className="ee-tour__nav">
          <button className="ee-btn ee-btn--ghost ee-btn--sm" onClick={tourEnd}>
            Beenden
          </button>
          <span />
          {tour.i > 0 && (
            <button className="ee-btn ee-btn--sm" onClick={() => tourGo(-1)}>
              <Icon name="left" small /> Zurück
            </button>
          )}
          <button className="ee-btn ee-btn--primary ee-btn--sm" onClick={() => tourGo(1)}>
            {last ? (
              "Fertig"
            ) : (
              <>
                Weiter <Icon name="right" small />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

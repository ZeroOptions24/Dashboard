"use client";

import { useState } from "react";
import Icon from "@/components/ui/Icon";
import { bookDirect, closerOptions } from "@/lib/actions";
import { dkey, fmtDay, fmtHour } from "@/lib/format";
import type { Lead } from "@/lib/types";
import { useDashboard } from "@/lib/useDashboard";

const TIMES = Array.from({ length: 27 }, (_, i) => 8 + i * 0.5); /* 08:00 – 21:00 */

/** Termin direkt eintragen, wenn kein passender freier Slot da ist (Datum, Uhrzeit, Closer). */
export default function DirectBooking({ lead, onBooked }: { lead: Lead; onBooked?: () => void }) {
  const { now, person, toast, me, role } = useDashboard();
  /* Setter merken nur vor – der Presetter bestätigt (Zwei-Schritte-System) */
  const verb = role === "setter" ? "vormerken" : "eintragen";
  const closers = closerOptions();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(dkey(now));
  const [start, setStart] = useState(17);
  const [picked, setCloser] = useState("");
  /* Auswahl gilt nur, wenn die Person (noch) Closer ist – sonst Vorschlag: ich selbst oder der erste Closer */
  const closer = closers.includes(picked) ? picked : closers.includes(me) ? me : (closers[0] ?? "");
  if (!open)
    return (
      <button className="ee-btn ee-btn--ghost ee-btn--sm" type="button" onClick={() => setOpen(true)} data-component="DirectBookingOpen">
        <Icon name="cal" small /> Termin direkt {verb} (ohne freien Slot)
      </button>
    );
  return (
    <form
      className="stack"
      style={{ gap: 10 }}
      data-component="DirectBooking"
      onSubmit={(e) => {
        e.preventDefault();
        if (!closer) return toast("Bitte einen Closer wählen", "info");
        const err = bookDirect(lead, date, start, closer);
        if (err) return toast(err, "info");
        toast(
          role === "setter"
            ? `Termin vorgemerkt: ${fmtDay(date)} ${fmtHour(start)} · Presetting bestätigt nach dem Anruf`
            : `Termin eingetragen: ${fmtDay(date)} ${fmtHour(start)} · ${person(closer).first} informiert`,
        );
        setOpen(false);
        onBooked?.();
      }}
    >
      <div className="ee-grid g-2" style={{ gap: 10 }}>
        <div className="ee-field">
          <label htmlFor="dbDate">Datum</label>
          <input className="ee-input" type="date" id="dbDate" min={dkey(now)} value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <div className="ee-field">
          <label htmlFor="dbTime">Uhrzeit</label>
          <select className="ee-select" id="dbTime" value={start} onChange={(e) => setStart(Number(e.target.value))}>
            {TIMES.map((t) => (
              <option key={t} value={t}>
                {fmtHour(t)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="ee-field">
        <label htmlFor="dbCloser">Closer</label>
        <select className="ee-select" id="dbCloser" value={closer} onChange={(e) => setCloser(e.target.value)} required>
          {!closers.length && <option value="">Noch keine Closer im Team</option>}
          {closers.map((k) => (
            <option key={k} value={k}>
              {person(k).name}
            </option>
          ))}
        </select>
      </div>
      <div className="row">
        <button className="ee-btn ee-btn--primary" type="submit" disabled={!closers.length}>
          <Icon name="cal" small /> Termin {fmtDay(date)} {fmtHour(start)} {verb}
        </button>
        <button className="ee-btn ee-btn--ghost" type="button" onClick={() => setOpen(false)}>
          Abbrechen
        </button>
      </div>
    </form>
  );
}

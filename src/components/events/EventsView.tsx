"use client";

import { useState } from "react";
import EventCard from "@/components/events/EventCard";
import Icon from "@/components/ui/Icon";
import { PageHead } from "@/components/ui/Kpi";
import { postEvent } from "@/lib/actions";
import { useDashboard } from "@/lib/useDashboard";

const EMPTY = {
  title: "Team-Frühstück vor der Tour",
  date: "2026-10-03",
  time: "08:30",
  ort: "Büro Leipzig, Fabrikstraße 21",
  type: "Team",
  target: "Alle",
  desc: "Gemeinsam starten, Gebiete verteilen, dann raus an die Türen.",
  whatsapp: true,
};

function EventForm() {
  const { toast } = useDashboard();
  const [f, setF] = useState(EMPTY);
  const set = <K extends keyof typeof EMPTY>(k: K, v: (typeof EMPTY)[K]) => setF((x) => ({ ...x, [k]: v }));
  return (
    <section className="ee-card" data-component="EventForm">
      <h2>Neues Event</h2>
      <form
        className="ee-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (!f.title.trim()) return;
          const { whatsapp, ...ev } = f;
          postEvent({ ...ev, title: ev.title.trim() });
          toast(whatsapp ? "Event gepostet und in WhatsApp angekündigt" : "Event gepostet", "send");
        }}
      >
        <div className="ee-field ee-field--full">
          <label htmlFor="evTitle">Titel</label>
          <input className="ee-input" id="evTitle" required value={f.title} onChange={(e) => set("title", e.target.value)} />
        </div>
        <div className="ee-field">
          <label htmlFor="evDate">Datum</label>
          <input className="ee-input" type="date" id="evDate" required value={f.date} onChange={(e) => set("date", e.target.value)} />
        </div>
        <div className="ee-field">
          <label htmlFor="evTime">Uhrzeit</label>
          <input className="ee-input" id="evTime" value={f.time} onChange={(e) => set("time", e.target.value)} />
        </div>
        <div className="ee-field ee-field--full">
          <label htmlFor="evOrt">Ort</label>
          <input className="ee-input" id="evOrt" value={f.ort} onChange={(e) => set("ort", e.target.value)} />
        </div>
        <div className="ee-field">
          <label htmlFor="evType">Art</label>
          <select className="ee-select" id="evType" value={f.type} onChange={(e) => set("type", e.target.value)}>
            {["Team", "Training", "Schulung", "Onboarding"].map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </div>
        <div className="ee-field">
          <label htmlFor="evTarget">Zielgruppe</label>
          <select className="ee-select" id="evTarget" value={f.target} onChange={(e) => set("target", e.target.value)}>
            {["Alle", "Setter", "Presetter", "Closer"].map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </div>
        <div className="ee-field ee-field--full">
          <label htmlFor="evDesc">Beschreibung</label>
          <textarea className="ee-textarea" id="evDesc" value={f.desc} onChange={(e) => set("desc", e.target.value)} />
        </div>
        <label className="ee-check ee-field--full">
          <input type="checkbox" id="evWa" checked={f.whatsapp} onChange={(e) => set("whatsapp", e.target.checked)} />
          <span>Zusätzlich in der WhatsApp-Gruppe ankündigen (über n8n)</span>
        </label>
        <button className="ee-btn ee-btn--primary ee-field--full" type="submit">
          <Icon name="send" small /> Event posten
        </button>
      </form>
    </section>
  );
}

export default function EventsView() {
  const { data, role } = useDashboard();
  const list = data.EVENTS.slice().sort((a, b) => (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0) || a.date.localeCompare(b.date));
  if (role !== "admin")
    return (
      <>
        <PageHead title="Events" />
        {list.length ? (
          <div className="ee-grid g-2">
            {list.map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </div>
        ) : (
          <div className="ee-empty">Gerade stehen keine Events an.</div>
        )}
      </>
    );
  return (
    <>
      <PageHead title="Events posten" />
      <div className="ee-grid g-main" style={{ alignItems: "start" }}>
        <div className="ee-grid" style={{ gap: 14 }}>
          {list.map((e) => (
            <EventCard key={e.id} event={e} />
          ))}
        </div>
        <EventForm />
      </div>
    </>
  );
}

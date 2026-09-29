"use client";

import { useState } from "react";
import Icon from "@/components/ui/Icon";
import { PageHead } from "@/components/ui/Kpi";
import { addSlot, addSlotRange, removeSlot } from "@/lib/actions";
import { kindLabel, needsFeedback } from "@/lib/appointments";
import { WD, dkey, fmtDay, fmtHour, pad, parseKey } from "@/lib/format";
import { useDashboard } from "@/lib/useDashboard";
import { useMobile } from "@/lib/useMobile";
import { openDrawer } from "@/lib/ui";

const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];

/** Montag der Woche von d, verschoben um offset Wochen */
function weekDays(now: Date, offset: number) {
  const mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7) + offset * 7);
  return [...Array(7)].map((_, i) => new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + i));
}

function CalCell({ k, h }: { k: string; h: number }) {
  const { data, me, now, toast } = useDashboard();
  const a = data.APPTS.find((x) => x.closer === me && x.date === k && Math.floor(x.start) === h);
  const s = data.SLOTS.find((x) => x.closer === me && x.date === k && x.start === h);
  const t = parseKey(k);
  t.setHours(h);
  const past = t < now;
  if (a) {
    const l = data.LEADS.find((x) => x.id === a.lead);
    return (
      <div className="ee-cal__cell" style={{ cursor: "default" }}>
        <button
          className={`ee-slot ee-slot--appt ${past ? "ee-slot--past" : ""} ${needsFeedback(a, now) ? "is-due" : ""}`}
          style={{ height: `${a.dur * 52 - 6}px` }}
          title={`${l?.kunde} · ${kindLabel(a)}`}
          onClick={() => openDrawer({ kind: "appt", id: a.id })}
        >
          <b>{fmtHour(a.start)}</b>
          <span>{l?.kunde}</span>
          <small>{kindLabel(a)}</small>
        </button>
      </div>
    );
  }
  if (s)
    return (
      <div className="ee-cal__cell" style={{ cursor: "default" }}>
        <button
          className="ee-slot ee-slot--free"
          style={{ height: "46px" }}
          title="Freier Slot – klicken zum Entfernen"
          aria-label={`Freien Slot ${fmtDay(k)} ${fmtHour(h)} entfernen`}
          onClick={() => {
            removeSlot(s.id);
            toast("Slot entfernt", "close");
          }}
        >
          <b>{fmtHour(h)}</b>
          <span>frei</span>
        </button>
      </div>
    );
  if (past) return <div className="ee-cal__cell is-past" aria-hidden="true" />;
  return <button className="ee-cal__cell" aria-label={`Freien Slot ${fmtDay(k)} ${fmtHour(h)} eintragen`} onClick={() => toast(addSlot(k, h))} />;
}

function SlotForm({ days, mobile }: { days: Date[]; mobile: boolean }) {
  const { data, me, now, toast } = useDashboard();
  const dates = [...Array(21)].map((_, i) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + i)).filter((x) => x.getDay() !== 0);
  const [f, setF] = useState({ date: dkey(dates[0]), from: 10, to: 13, repeat: false });
  const inWeek = (x: { date: string }) => days.some((d) => dkey(d) === x.date);
  const slots = data.SLOTS.filter((s) => s.closer === me && inWeek(s)).length;
  return (
    <details className="ee-card ee-slotbar" data-component="SlotForm" open={!mobile}>
      <summary className="ee-slotbar__sum">
        <Icon name="plus" small /> Freie Slots eintragen
      </summary>
      <form
        className="ee-slotbar__form"
        onSubmit={(e) => {
          e.preventDefault();
          if (f.to <= f.from) return toast("„Bis“ muss nach „Von“ liegen", "info");
          const n = addSlotRange(f.date, f.from, f.to, f.repeat);
          toast(`${n} freie Slot${n === 1 ? "" : "s"} eingetragen`);
        }}
      >
        <div className="ee-field">
          <label htmlFor="slotDate">Tag</label>
          <select className="ee-select" id="slotDate" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })}>
            {dates.map((d) => (
              <option key={dkey(d)} value={dkey(d)}>
                {fmtDay(dkey(d))}
              </option>
            ))}
          </select>
        </div>
        <div className="ee-field">
          <label htmlFor="slotFrom">Von</label>
          <select className="ee-select" id="slotFrom" value={f.from} onChange={(e) => setF({ ...f, from: +e.target.value })}>
            {HOURS.map((h) => (
              <option key={h} value={h}>
                {fmtHour(h)}
              </option>
            ))}
          </select>
        </div>
        <div className="ee-field">
          <label htmlFor="slotTo">Bis</label>
          <select className="ee-select" id="slotTo" value={f.to} onChange={(e) => setF({ ...f, to: +e.target.value })}>
            {HOURS.map((h) => (
              <option key={h} value={h + 1}>
                {fmtHour(h + 1)}
              </option>
            ))}
          </select>
        </div>
        <label className="ee-check">
          <input type="checkbox" id="slotRepeat" checked={f.repeat} onChange={(e) => setF({ ...f, repeat: e.target.checked })} />
          <span>4 Wochen wiederholen</span>
        </label>
        <button className="ee-btn ee-btn--primary" type="submit">
          <Icon name="plus" small /> Slots eintragen
        </button>
      </form>
      <div className="ee-slotbar__stats">
        <div>
          <b className={slots < 4 ? "num is-bad" : "num is-good"}>{slots}</b>
          <span>freie Slots</span>
        </div>
        <div>
          <b className="num">{data.APPTS.filter((a) => a.closer === me && inWeek(a)).length}</b>
          <span>Termine</span>
        </div>
      </div>
    </details>
  );
}

export default function KalenderView() {
  const { data, me, now } = useDashboard();
  const mobile = useMobile();
  const [week, setWeek] = useState(0);
  const [dayIdx, setDayIdx] = useState((now.getDay() + 6) % 7);
  const days = weekDays(now, week);
  const title = `${pad(days[0].getDate())}.${pad(days[0].getMonth() + 1)}. – ${pad(days[6].getDate())}.${pad(days[6].getMonth() + 1)}.`;
  const nav = (
    <div className="row">
      <button className="ee-iconbtn" aria-label="Vorige Woche" onClick={() => setWeek(week - 1)}>
        <Icon name="left" />
      </button>
      <b className="num" style={{ minWidth: 120, textAlign: "center" }}>
        {title}
      </b>
      <button className="ee-iconbtn" aria-label="Nächste Woche" onClick={() => setWeek(week + 1)}>
        <Icon name="right" />
      </button>
    </div>
  );
  let grid: React.ReactNode;
  if (mobile) {
    const k = dkey(days[dayIdx]);
    grid = (
      <>
        <div className="ee-daypick" data-component="CalendarDayPicker">
          {days.map((x, i) => {
            const kk = dkey(x);
            const has = data.SLOTS.some((s) => s.closer === me && s.date === kk) || data.APPTS.some((a) => a.closer === me && a.date === kk);
            return (
              <button key={kk} aria-pressed={i === dayIdx} onClick={() => setDayIdx(i)}>
                {WD[x.getDay()]}
                <b>{x.getDate()}</b>
                {has && <span className="dot" />}
              </button>
            );
          })}
        </div>
        <section className="ee-card ee-card--flush">
          <div className="ee-calday" data-component="CalendarDay">
            {HOURS.map((h) => (
              <div key={h} className="ee-calday__row">
                <div className="ee-cal__time">{fmtHour(h)}</div>
                <CalCell k={k} h={h} />
              </div>
            ))}
          </div>
        </section>
      </>
    );
  } else {
    grid = (
      <section className="ee-card ee-card--flush">
        <div className="ee-cal" data-component="CalendarWeek">
          <div className="ee-cal__corner" />
          {days.map((d) => (
            <div key={dkey(d)} className={dkey(d) === dkey(now) ? "ee-cal__dayhead is-today" : "ee-cal__dayhead"}>
              <span>{WD[d.getDay()]}</span>
              <b>{d.getDate()}</b>
            </div>
          ))}
          {HOURS.map((h) => (
            <CalRow key={h} h={h} days={days} />
          ))}
        </div>
      </section>
    );
  }
  return (
    <>
      <PageHead title="Kalender" actions={nav} />
      <SlotForm days={days} mobile={mobile} />
      {grid}
    </>
  );
}

/* Eine Stundenzeile der Wochenansicht: Zeit + 7 Zellen, ohne Wrapper-Element (CSS-Grid) */
function CalRow({ h, days }: { h: number; days: Date[] }) {
  return (
    <>
      <div className="ee-cal__time">{fmtHour(h)}</div>
      {days.map((d) => (
        <CalCell key={dkey(d)} k={dkey(d)} h={h} />
      ))}
    </>
  );
}

"use client";

import { useState } from "react";
import { TodoRow, leadsTodayOf, useTodos } from "@/components/overview/Cards";
import Icon from "@/components/ui/Icon";
import { PageHead } from "@/components/ui/Kpi";
import { closerPaused } from "@/lib/appointments";
import type { DoneItem } from "@/lib/lead-activity";
import { TODO_CATS, type Todo, type TodoGroup } from "@/lib/todos";
import { useDashboard } from "@/lib/useDashboard";

/* To-Dos: Überfällig · Heute · Demnächst, darunter „Heute erledigt“ (Tims Vorlage).
   Bei vielen Einträgen (Presetter-Pool) mit Suche und „weitere anzeigen“. */

const PAGE = 15;
const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

function Group({
  title,
  items,
  tone,
}: {
  title: string;
  items: Todo[];
  tone?: "bad";
}) {
  const [shown, setShown] = useState(PAGE);
  if (!items.length) return null;
  return (
    <section className="stack" style={{ gap: 10 }}>
      <h2 className={tone ? `ee-todohead is-${tone}` : "ee-todohead"}>
        {title} <span className="num">{items.length}</span>
      </h2>
      <div className="ee-todos">
        {items.slice(0, shown).map((t) => (
          <TodoRow key={t.key} t={t} />
        ))}
      </div>
      {items.length > shown && (
        <button
          className="ee-btn ee-btn--sm ee-todo__more"
          onClick={() => setShown(shown + PAGE * 2)}
        >
          {Math.min(PAGE * 2, items.length - shown)} weitere anzeigen
        </button>
      )}
    </section>
  );
}

/** Heute erledigt: Setter = heute eingereichte Leads, Presetter = Anrufe, Closer = Rückmeldungen */
function useDoneToday(): DoneItem[] {
  const ctx = useDashboard();
  const { data, role } = ctx;
  const kunde = (d: DoneItem) =>
    d.who ?? data.LEADS.find((l) => l.id === d.leadId)?.kunde ?? "Kunde";
  if (role === "setter")
    return leadsTodayOf(ctx).map((l) => ({
      what: "Lead eingereicht",
      who: l.kunde,
      time: l.hist[l.hist.length - 1]?.[1].split(" ")[1] ?? "",
    }));
  const log =
    role === "presetter"
      ? data.CALL_DAY.log
      : role === "closer"
        ? data.CLOSER_DAY.log
        : [];
  return log.map((d) => ({ ...d, who: kunde(d) }));
}

/** Admin: Bereich-Chips und Auswahl der Person (Tims Vorlage) */
function AdminFilter({
  all,
  cat,
  who,
  setCat,
  setWho,
}: {
  all: Todo[];
  cat: string;
  who: string;
  setCat: (k: string) => void;
  setWho: (k: string) => void;
}) {
  const { data, person } = useDashboard();
  const byWho = all.filter((t) => who === "alle" || (t.mb ?? []).includes(who));
  const people = Object.values(data.PEOPLE)
    .filter((p) => p.role !== "admin" && p.key !== "unbekannt")
    .sort((a, b) => a.first.localeCompare(b.first, "de"));
  return (
    <div className="ee-todofilter" data-component="TodoFilter">
      <div className="ee-chips" role="group" aria-label="Bereich">
        {[["alle", "Alle"], ...TODO_CATS].map(([k, l]) => {
          const n =
            k === "alle"
              ? byWho.length
              : byWho.filter((t) => t.cat === k).length;
          if (!n && k !== "alle" && cat !== k) return null;
          const over = byWho.some(
            (t) => (k === "alle" || t.cat === k) && t.group === "over",
          );
          return (
            <button
              key={k}
              className={over ? "ee-fchip has-over" : "ee-fchip"}
              aria-pressed={cat === k}
              onClick={() => setCat(k)}
            >
              {l} <span className="num">{n}</span>
            </button>
          );
        })}
      </div>
      <label className="sr" htmlFor="admTodoWho">
        Mitarbeiter
      </label>
      <select
        className="ee-select"
        id="admTodoWho"
        style={{ width: "auto", minHeight: 40 }}
        value={who}
        onChange={(e) => setWho(e.target.value)}
      >
        <option value="alle">Alle MBs</option>
        {(
          [
            ["setter", "Setter"],
            ["presetter", "Presetter"],
            ["closer", "Closer"],
          ] as const
        ).map(([r, l]) => {
          const ps = people.filter((p) => p.role === r);
          return ps.length ? (
            <optgroup key={r} label={l}>
              {ps.map((p) => (
                <option key={p.key} value={p.key}>
                  {person(p.key).first} (
                  {all.filter((t) => (t.mb ?? []).includes(p.key)).length})
                </option>
              ))}
            </optgroup>
          ) : null;
        })}
      </select>
      {cat !== "alle" || who !== "alle" ? (
        <button
          className="ee-btn ee-btn--ghost ee-btn--sm"
          onClick={() => {
            setCat("alle");
            setWho("alle");
          }}
        >
          <Icon name="close" small /> Filter zurücksetzen
        </button>
      ) : null}
    </div>
  );
}

export default function TodosView() {
  const { data, role, me, now } = useDashboard();
  const all = useTodos();
  const done = useDoneToday();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("alle");
  const [who, setWho] = useState("alle");
  const isAdmin = role === "admin";
  const needle = norm(q.trim());
  const searched = needle
    ? all.filter((t) =>
        norm(`${t.what} ${t.when ?? ""} ${t.who} ${t.where ?? ""}`).includes(
          needle,
        ),
      )
    : all;
  const list = isAdmin
    ? searched.filter(
        (t) =>
          (who === "alle" || (t.mb ?? []).includes(who)) &&
          (cat === "alle" || t.cat === cat),
      )
    : searched;
  const of = (g: TodoGroup) => list.filter((t) => t.group === g);
  return (
    <>
      <PageHead title="To-Dos" />
      {role === "closer" && closerPaused(data.APPTS, me, now) && (
        <div className="ee-alert ee-alert--bad">
          <Icon name="lock" small /> Deine Slots sind für neue Leads pausiert,
          bis alle Rückmeldungen erledigt sind.
        </div>
      )}
      {isAdmin && (
        <AdminFilter
          all={all}
          cat={cat}
          who={who}
          setCat={setCat}
          setWho={setWho}
        />
      )}
      {all.length > PAGE && (
        <input
          className="ee-input"
          type="search"
          placeholder="Name, Ort oder Aufgabe suchen"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="To-Dos durchsuchen"
        />
      )}
      {list.length ? (
        <>
          <Group title="Überfällig" items={of("over")} tone="bad" />
          <Group title="Heute" items={of("today")} />
          <Group title="Demnächst" items={of("later")} />
        </>
      ) : (
        <div className="ee-alert ee-alert--ok">
          <Icon name="check" small />{" "}
          {needle
            ? "Nichts gefunden"
            : isAdmin && all.length
              ? "Für diesen Filter ist nichts offen"
              : "Alles erledigt"}
        </div>
      )}
      {!isAdmin && (
        <section className="stack" style={{ gap: 10 }}>
          <h2 className="ee-todohead is-good">
            Heute erledigt <span className="num">{done.length}</span>
          </h2>
          {done.length ? (
            <div className="ee-todos">
              {done.map((d, i) => (
                <div key={i} className="ee-todo2 is-done">
                  <div className="ee-todo2__what">
                    <b>
                      <Icon name="check" small /> {d.what}
                    </b>
                    {d.time ? <span>{d.time} Uhr</span> : null}
                  </div>
                  <div className="ee-todo2__who">
                    <b>{d.who}</b>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="ee-empty">Noch nichts erledigt</div>
          )}
        </section>
      )}
    </>
  );
}

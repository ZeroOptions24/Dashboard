"use client";

import { useState } from "react";
import { TodoRow, leadsTodayOf, useTodos } from "@/components/overview/Cards";
import Icon from "@/components/ui/Icon";
import { PageHead } from "@/components/ui/Kpi";
import { closerPaused } from "@/lib/appointments";
import type { DoneItem } from "@/lib/lead-activity";
import type { Todo, TodoGroup } from "@/lib/todos";
import { useDashboard } from "@/lib/useDashboard";

/* To-Dos: Überfällig · Heute · Demnächst, darunter „Heute erledigt“ (Tims Vorlage).
   Bei vielen Einträgen (Presetter-Pool) mit Suche und „weitere anzeigen“. */

const PAGE = 15;
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

function Group({ title, items, tone }: { title: string; items: Todo[]; tone?: "bad" }) {
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
        <button className="ee-btn ee-btn--sm ee-todo__more" onClick={() => setShown(shown + PAGE * 2)}>
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
  const kunde = (d: DoneItem) => d.who ?? data.LEADS.find((l) => l.id === d.leadId)?.kunde ?? "Kunde";
  if (role === "setter")
    return leadsTodayOf(ctx).map((l) => ({ what: "Lead eingereicht", who: l.kunde, time: l.hist[l.hist.length - 1]?.[1].split(" ")[1] ?? "" }));
  const log = role === "presetter" ? data.CALL_DAY.log : role === "closer" ? data.CLOSER_DAY.log : [];
  return log.map((d) => ({ ...d, who: kunde(d) }));
}

export default function TodosView() {
  const { data, role, me, now } = useDashboard();
  const all = useTodos();
  const done = useDoneToday();
  const [q, setQ] = useState("");
  const needle = norm(q.trim());
  const list = needle ? all.filter((t) => norm(`${t.what} ${t.when ?? ""} ${t.who} ${t.where ?? ""}`).includes(needle)) : all;
  const of = (g: TodoGroup) => list.filter((t) => t.group === g);
  return (
    <>
      <PageHead title="To-Dos" />
      {role === "closer" && closerPaused(data.APPTS, me, now) && (
        <div className="ee-alert ee-alert--bad">
          <Icon name="lock" small /> Deine Slots sind für neue Leads pausiert, bis alle Rückmeldungen erledigt sind.
        </div>
      )}
      {all.length > PAGE && (
        <input className="ee-input" type="search" placeholder="Name, Ort oder Aufgabe suchen" value={q} onChange={(e) => setQ(e.target.value)} aria-label="To-Dos durchsuchen" />
      )}
      {list.length ? (
        <>
          <Group title="Überfällig" items={of("over")} tone="bad" />
          <Group title="Heute" items={of("today")} />
          <Group title="Demnächst" items={of("later")} />
        </>
      ) : (
        <div className="ee-alert ee-alert--ok">
          <Icon name="check" small /> {needle ? "Nichts gefunden" : "Alles erledigt"}
        </div>
      )}
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
    </>
  );
}

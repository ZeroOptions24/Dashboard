"use client";

/* Bausteine der Übersicht (gleiches Schema für Setter, Presetter und Closer, wie in Tims Vorlage):
   Heute (TodayHero) · Monat (MonthCard) → Zu erledigen (TodoCard) → Rangliste (RankCard) · Quote (QuoteCard) */

import { useState, type ReactNode } from "react";
import Icon from "@/components/ui/Icon";
import { AFTER_TERMIN, PAYOUT_STATUS, PROV } from "@/lib/domain";
import { WD, eur } from "@/lib/format";
import { leadsForUser } from "@/lib/leads";
import { perfTone, rankOf, ranked } from "@/lib/ranking";
import { setMoneyGoal, LIVE, useStore } from "@/lib/store";
import { openTodoCount, todoItems, type Todo } from "@/lib/todos";
import { callLead, openDrawer } from "@/lib/ui";
import { useDashboard, type DashboardCtx } from "@/lib/useDashboard";
import type { Board } from "@/lib/types";

/* ---------- To-Dos der angemeldeten Person ---------- */

/** Leads, die der Setter heute eingereicht hat */
export function leadsTodayOf(ctx: DashboardCtx) {
  const { data, role, me, now } = ctx;
  const todayStr = `${String(now.getDate()).padStart(2, "0")}.${String(now.getMonth() + 1).padStart(2, "0")}.${now.getFullYear()}`;
  return leadsForUser(data.LEADS, role, me).filter((l) => l.datum === todayStr);
}

export function useTodos(): Todo[] {
  const ctx = useDashboard();
  const { live } = useStore();
  const { data, role, me, now, person } = ctx;
  const openContracts = live.contracts ? live.contracts.openMine : data.CONTRACTS.filter((c) => c.who === me && c.status === "open").length;
  return todoItems({
    role,
    me,
    now,
    leads: data.LEADS,
    appts: data.APPTS,
    slots: data.SLOTS,
    person,
    openContracts,
    leadsToday: role === "setter" ? leadsTodayOf(ctx).length : undefined,
    dayGoal: data.DAY_GOAL.goal,
  });
}

export const useOpenTodoCount = () => openTodoCount(useTodos());

export function runTodo(t: Todo, go: (v: string) => void) {
  if (t.act.kind === "view") go(t.act.view);
  else if (t.act.kind === "call") callLead(t.act.id);
  else if (t.act.kind === "feedback") openDrawer({ kind: "feedback", id: t.act.id });
  else openDrawer({ kind: "lead", id: t.act.id });
}

/** Ein To-Do: links was zu tun ist (groß, farbig), rechts um wen es geht */
export function TodoRow({ t }: { t: Todo }) {
  const { go } = useDashboard();
  return (
    <button className={`ee-todo2 is-${t.tone}`} onClick={() => runTodo(t, go)} data-component="TodoRow">
      <div className="ee-todo2__what">
        <b>{t.what}</b>
        {t.when ? <span>{t.when}</span> : null}
      </div>
      <div className="ee-todo2__who">
        <b>{t.who}</b>
        {t.where ? <span>{t.where}</span> : null}
      </div>
      <Icon name="right" small />
    </button>
  );
}

export function TodoCard() {
  const { go } = useDashboard();
  const all = useTodos();
  const top = all.slice(0, 3),
    open = openTodoCount(all);
  return (
    <section className="ee-card" data-component="TodoCard">
      <div className="ee-card__head">
        <h2>Zu erledigen</h2>
        {open ? <span className={all.some((t) => t.group === "over") ? "ee-count is-bad" : "ee-count"}>{open}</span> : null}
      </div>
      {top.length ? (
        <div className="ee-todos">
          {top.map((t) => (
            <TodoRow key={t.key} t={t} />
          ))}
        </div>
      ) : (
        <div className="ee-alert ee-alert--ok">
          <Icon name="check" small /> Alles erledigt
        </div>
      )}
      {all.length > 3 && (
        <button className="ee-btn ee-btn--sm ee-todo__more" onClick={() => go("todos")}>
          Alle To-Dos ({all.length}) <Icon name="right" small />
        </button>
      )}
    </section>
  );
}

/* ---------- TodayHero: Tagesziel mit Woche und Serie ---------- */

export function WeekStrip({ today, goal, week }: { today: number; goal: number; week: [string, number | null, number?][] }) {
  const { now } = useDashboard();
  if (!week.length) return null;
  return (
    <div className="ee-week" aria-label="Diese Woche">
      {week.map(([d, v, dayGoal]) => {
        const isToday = d === WD[now.getDay()];
        const val = isToday ? today : v;
        const g = isToday ? goal : (dayGoal ?? goal);
        const hit = val !== null && g > 0 && val >= g;
        return (
          <div key={d} className={`ee-week__day ${hit ? "is-hit" : ""} ${isToday ? "is-today" : ""} ${val === null ? "is-future" : ""}`}>
            <span>{d}</span>
            <b className="num">{val === null ? "·" : val}</b>
          </div>
        );
      })}
    </div>
  );
}

export function TodayHero({ num, goal, unit, extra, line, cta }: { num: number; goal: number; unit: string; extra?: ReactNode; line: ReactNode; cta?: ReactNode }) {
  const { now } = useDashboard();
  const done = goal > 0 && num >= goal;
  return (
    <section className={`ee-card ee-card--forest ee-hero ee-daygoal ${done ? "is-done" : ""}`} data-component="TodayHero">
      <div className="ee-card__head">
        <span className="eyebrow">
          Heute · {WD[now.getDay()]}, {String(now.getDate()).padStart(2, "0")}.{String(now.getMonth() + 1).padStart(2, "0")}.
        </span>
        {done ? (
          <span className="ee-daygoal__badge">
            <Icon name="check" small /> Tagesziel erreicht
          </span>
        ) : (
          <span className="eyebrow">
            Ziel {goal} {unit}
          </span>
        )}
      </div>
      <div className="ee-daygoal__main">
        <div className="ee-daygoal__num">
          <b className="num">{num}</b>
          <span>
            / {goal} {unit}
          </span>
        </div>
        <div className="ee-daygoal__bar" role="progressbar" aria-valuenow={num} aria-valuemax={goal} aria-label="Tagesziel">
          <i style={{ width: `${goal ? Math.min(100, (num / goal) * 100) : 0}%` }} />
        </div>
      </div>
      {extra}
      <div className="ee-today__foot">
        <p className="ee-daygoal__streak">{line}</p>
        {cta}
      </div>
    </section>
  );
}

/* ---------- MonthCard: Geld im Monat ---------- */

function GoalForm({ ctx, goal, onDone }: { ctx: DashboardCtx; goal: number; onDone: () => void }) {
  const [value, setValue] = useState(String(goal));
  return (
    /* bewusst ohne id="goalForm" – sonst reagiert zusätzlich der Formular-Handler der Übergangsschicht */
    <form
      className="row"
      style={{ gap: 8 }}
      onSubmit={(e) => {
        e.preventDefault();
        const val = Math.max(100, Math.round(+value || 0));
        onDone();
        setMoneyGoal(ctx.me, val);
        ctx.toast(`Monatsziel: ${eur(val)}`);
      }}
    >
      <label className="sr" htmlFor="goalInput">
        Monatsziel in Euro
      </label>
      <input className="ee-input num" id="goalInput" type="number" min={100} step={100} value={value} autoFocus onChange={(e) => setValue(e.target.value)} style={{ maxWidth: 160 }} />
      <button className="ee-btn ee-btn--primary ee-btn--sm" type="submit">
        Speichern
      </button>
    </form>
  );
}

export function MonthCard() {
  const ctx = useDashboard();
  const { data, role, me } = ctx;
  const [editing, setEditing] = useState(false);
  const L = leadsForUser(data.LEADS, role, me);
  const cur = (data.PAYOUTS[me] || [])[0];
  const presetter = role === "presetter";
  const rate = presetter ? PROV.presetter.termin : role === "closer" ? PROV.closer.abschluss : PROV.setter.abschluss;
  const per = presetter ? ["Termin", "Termine"] : ["Verkauf", "Verkäufe"];
  /* Echte Daten ohne Abrechnung: verdient = Verkäufe (Setter, Closer) bzw. gelegte Termine (Presetter) in diesem Monat */
  const thisMonth = (l: (typeof L)[number]) => {
    const d = l.pdChangedAt ? new Date(l.pdChangedAt) : null;
    return !!d && d.getFullYear() === data.NOW.getFullYear() && d.getMonth() === data.NOW.getMonth();
  };
  const liveEarned = (presetter ? L.filter((l) => l.presetter === me && AFTER_TERMIN.includes(l.status) && thisMonth(l)) : L.filter((l) => ["verkauft", "ausgezahlt"].includes(l.status) && thisMonth(l))).length * rate;
  const goal = data.MONEY_GOAL[me] || (role === "closer" ? 8000 : 3000),
    earned = cur ? cur.betrag : LIVE ? liveEarned : 0;
  /* in Aussicht: Presetter = Leads, die gerade angerufen werden; Setter/Closer = Kunden zwischen Aufmaß und Verkauf */
  const openL = presetter ? [] : L.filter((l) => ["aufmass", "checks", "verkaufstermin"].includes(l.status));
  const soon = openL.length * rate;
  const pE = Math.min(100, (earned / goal) * 100),
    pS = Math.min(100 - pE, (soon / goal) * 100);
  const toGoal = Math.max(0, Math.ceil((goal - earned) / rate));
  return (
    <section className="ee-card ee-month" data-component="MonthCard">
      <div className="ee-card__head">
        <span className="eyebrow">Monat · {data.ADMIN_KPI.monat}</span>
        <button className="ee-btn ee-btn--ghost ee-btn--sm" onClick={() => setEditing(!editing)}>
          <Icon name="edit" small /> Ziel
        </button>
      </div>
      {editing && <GoalForm ctx={ctx} goal={goal} onDone={() => setEditing(false)} />}
      <div className="ee-month__num">
        <b className="num is-money">{eur(earned)}</b>
        <span>von {eur(goal)}</span>
      </div>
      <div className="ee-goalbar" role="progressbar" aria-valuenow={earned} aria-valuemax={goal} aria-label="Monatsziel">
        <i className="is-earned" style={{ width: `${pE}%` }} />
        <i className="is-soon" style={{ width: `${pS}%` }} />
      </div>
      <div className="ee-month__stats">
        <div>
          <b className="num">{toGoal ? `${toGoal} ${toGoal === 1 ? per[0] : per[1]}` : "✓"}</b>
          <span>{toGoal ? "bis zum Ziel" : "Ziel erreicht"}</span>
        </div>
        {soon ? (
          <div>
            <b className="num is-money">+{eur(soon)}</b>
            <span>in Aussicht · {openL.length} Kunden</span>
          </div>
        ) : (
          <div>
            <b className="num">{eur(rate)}</b>
            <span>je {per[0]}</span>
          </div>
        )}
        <button onClick={() => ctx.go("auszahlungen")} title={cur ? PAYOUT_STATUS[cur.status].label : undefined}>
          <b className="num">{cur ? cur.datum.slice(0, 6) : "–"}</b>
          <span>
            Auszahlung <Icon name="right" small />
          </span>
        </button>
      </div>
    </section>
  );
}

/* ---------- RankCard: eigene Rangliste (Setter, Presetter, Closer-Cup) ---------- */

export function boardOf(ctx: DashboardCtx): Board {
  const { data, role } = ctx;
  return role === "setter" ? data.SETTER_BOARD : role === "presetter" ? data.PRESETTER_BOARD : data.BOARD;
}

export function RankCard() {
  const ctx = useDashboard();
  const { me, person, go } = ctx;
  const B = boardOf(ctx),
    R = ranked(B.rows),
    my = rankOf(me, B),
    top = R[0]?.val || 1;
  const above = R.filter((r) => r.val > my.val).slice(-1)[0];
  const shown = R.filter((r, i) => i < 4 || r.key === me);
  const next = B.marks.find((m) => my.val < m);
  const prize = next != null ? B.prizes.find(([t]) => parseInt(t) === next)?.[1] : undefined;
  return (
    <section className="ee-card ee-rankcard" data-component="RankCard">
      <div className="ee-card__head">
        <span className="eyebrow">{B.title.replace(/ \S+ \d{4}$/, "")}</span>
        <button className="ee-btn ee-btn--ghost ee-btn--sm" onClick={() => go("rangliste")}>
          Alle <Icon name="right" small />
        </button>
      </div>
      {R.length ? (
        <>
          <div className="ee-month__num">
            <b className="num">Platz {my.rank}</b>
            <span>
              von {R.length} · {my.val} {B.unit}
            </span>
          </div>
          <div className="ee-ranks">
            {shown.map((r) => (
              <div key={r.key} className={r.key === me ? "ee-ranks__row is-me" : "ee-ranks__row"}>
                <span>{r.rank}.</span>
                <b>{r.key === me ? "Du" : person(r.key).first}</b>
                <div className="ee-ranks__bar">
                  <i style={{ width: `${(r.val / top) * 100}%` }} />
                </div>
                <span className="num">{r.val}</span>
              </div>
            ))}
          </div>
          <p className="ee-rankcard__line">
            {above ? (
              <>
                Noch <b>{above.val - my.val + 1}</b> bis Platz {above.rank}
              </>
            ) : my.val > 0 ? (
              <b>Du führst</b>
            ) : (
              "Dein erster Termin bringt dich nach vorn."
            )}
            {next != null && prize ? (
              <>
                {" "}
                · noch <b>{next - my.val}</b> bis <b className="is-money">{prize}</b>
              </>
            ) : null}
          </p>
        </>
      ) : (
        <div className="ee-empty">Noch keine Einträge diesen Monat</div>
      )}
    </section>
  );
}

/* ---------- QuoteCard: eigene Quoten gegen den Teamschnitt ---------- */

export interface QuoteRow {
  label: string;
  me: number | null | undefined;
  team: number | null | undefined;
  /** kleiner ist besser (z. B. Stunden bis zum Erstanruf) */
  lowerIsBetter?: boolean;
  /** Skala der Leiste (Standard 100) */
  max?: number;
  /** Zielwert (Marke, solange es keinen Teamschnitt gibt) */
  ziel?: number;
  fmt?: (v: number) => string;
}

export function QuoteCard({ rows }: { rows: QuoteRow[] }) {
  const { data, go } = useDashboard();
  return (
    <section className="ee-card ee-quotes" data-component="QuoteCard">
      <div className="ee-card__head">
        <span className="eyebrow">Quote · {data.ADMIN_KPI.monat}</span>
        <button className="ee-btn ee-btn--ghost ee-btn--sm" onClick={() => go("leads")}>
          Pipeline <Icon name="right" small />
        </button>
      </div>
      {rows.map((q) => {
        const fmt = q.fmt ?? ((v: number) => `${v} %`);
        const max = q.max ?? 100;
        const ref = q.team ?? q.ziel;
        const t = q.me != null && ref != null ? perfTone(q.me, ref, !q.lowerIsBetter) : "";
        return (
          <div key={q.label} className="ee-qrow">
            <div className="ee-qrow__top">
              <span>{q.label}</span>
              <b className={t ? `num is-${t}` : "num"}>{q.me != null ? fmt(q.me) : "–"}</b>
            </div>
            <div className="ee-qrow__bar">
              <i className={t ? `is-${t}` : undefined} style={{ width: `${q.me != null ? Math.min(100, (q.me / max) * 100) : 0}%` }} />
              {ref != null ? <s style={{ left: `${Math.min(100, (ref / max) * 100)}%` }} title={q.team != null ? "Teamschnitt" : "Ziel"} /> : null}
            </div>
            <div className="ee-qrow__sub">
              {[q.team != null && `Team ${fmt(q.team)}`, q.ziel != null && `Ziel ${fmt(q.ziel)}`].filter(Boolean).join(" · ") || (q.me == null ? "noch keine Daten diesen Monat" : "Teamschnitt folgt")}
              {q.me == null && (q.team != null || q.ziel != null) ? " · noch keine eigenen Daten" : ""}
            </div>
          </div>
        );
      })}
    </section>
  );
}

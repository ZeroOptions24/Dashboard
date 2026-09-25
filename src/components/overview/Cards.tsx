"use client";

import { useState } from "react";
import Icon from "@/components/ui/Icon";
import { PAYOUT_STATUS, PROV } from "@/lib/domain";
import { WD, dkey, eur } from "@/lib/format";
import { leadsForUser } from "@/lib/leads";
import { rankOf, ranked } from "@/lib/ranking";
import { setMoneyGoal } from "@/lib/store";
import { useDashboard, type DashboardCtx } from "@/lib/useDashboard";

/* ---------- Monatsziel bearbeiten (Setter, Presetter, Closer) ---------- */
function GoalForm({ ctx, goal, onDone, accent }: { ctx: DashboardCtx; goal: number; onDone: () => void; accent?: boolean }) {
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
      <input
        className="ee-input num"
        id="goalInput"
        type="number"
        min={100}
        step={100}
        value={value}
        autoFocus
        onChange={(e) => setValue(e.target.value)}
        style={{ maxWidth: 160 }}
      />
      <button className={`ee-btn ${accent ? "ee-btn--accent" : "ee-btn--primary"} ee-btn--sm`} type="submit">
        Speichern
      </button>
    </form>
  );
}

/* ---------- MoneyGoal: Monatsziel Verdienst (Setter, Presetter) ---------- */
export function MoneyCard() {
  const ctx = useDashboard();
  const { data, role, me } = ctx;
  const [editing, setEditing] = useState(false);
  const L = leadsForUser(data.LEADS, role, me);
  const cur = (data.PAYOUTS[me] || [])[0];
  const rate = role === "presetter" ? PROV.presetter.termin : role === "closer" ? PROV.closer.abschluss : PROV.setter.abschluss;
  const per = role === "presetter" ? "Termine" : "Verkäufe";
  const goal = data.MONEY_GOAL[me] || 3000,
    earned = cur ? cur.betrag : 0;
  const soonLeads = role === "presetter" ? [] : L.filter((l) => ["termin", "checks"].includes(l.status));
  const soon = soonLeads.length * rate;
  const pE = Math.min(100, (earned / goal) * 100),
    pS = Math.min(100 - pE, (soon / goal) * 100);
  const missing = Math.max(0, goal - earned - soon);
  const line =
    earned >= goal ? (
      <>
        <Icon name="check" small /> Monatsziel erreicht
      </>
    ) : !missing ? (
      <>
        Schaffbar: Wenn deine {soonLeads.length} laufenden Termine verkaufen, kommst du auf <b>{eur(earned + soon)}</b>
      </>
    ) : (
      <>
        Noch{" "}
        <b>
          {Math.ceil(missing / rate)} {per}
        </b>{" "}
        bis zum Ziel{soon ? ` – zusätzlich zu ${soonLeads.length} laufenden Terminen` : ""}
      </>
    );
  return (
    <section className="ee-card ee-goalcard" data-component="MoneyGoal">
      <div className="ee-card__head">
        <span className="eyebrow">Dein Geld · September</span>
        <button className="ee-btn ee-btn--ghost ee-btn--sm" onClick={() => setEditing(!editing)}>
          <Icon name="edit" small /> Ziel ändern
        </button>
      </div>
      {editing && <GoalForm ctx={ctx} goal={goal} onDone={() => setEditing(false)} />}
      <div className="ee-goalcard__num">
        <b className="num is-money">{eur(earned)}</b>
        <span>von {eur(goal)} Ziel</span>
      </div>
      <div className="ee-goalbar" role="progressbar" aria-valuenow={earned} aria-valuemax={goal} aria-label="Monatsziel Verdienst">
        <i className="is-earned" style={{ width: `${pE}%` }} />
        <i className="is-soon" style={{ width: `${pS}%` }} />
      </div>
      <div className="ee-goalcard__legend">
        <span>
          <i className="is-earned" />
          verdient
        </span>
        {soon ? (
          <span>
            <i className="is-soon" />
            in Aussicht {eur(soon)}
          </span>
        ) : null}
      </div>
      <p className="ee-goalcard__line">{line}</p>
      <div className="ee-goalcard__foot">
        <div>
          <span className="eyebrow">Auszahlung</span>
          <span>
            {cur ? (
              <>
                am <b>{cur.datum}</b> · {PAYOUT_STATUS[cur.status].label}
              </>
            ) : (
              "–"
            )}
          </span>
        </div>
        <button className="ee-btn ee-btn--sm" onClick={() => ctx.go("auszahlungen")}>
          Abrechnung <Icon name="right" small />
        </button>
      </div>
    </section>
  );
}

/* ---------- CloserMoneyHero: Geld auf einen Blick (Closer-Startseite) ---------- */
export function CloserMoneyHero() {
  const ctx = useDashboard();
  const { data, role, me } = ctx;
  const [editing, setEditing] = useState(false);
  const cur = (data.PAYOUTS[me] || [])[0],
    rate = PROV.closer.abschluss;
  const goal = data.MONEY_GOAL[me] || 8000,
    earned = cur ? cur.betrag : 0;
  const open = leadsForUser(data.LEADS, role, me).filter((l) => ["termin", "checks"].includes(l.status)).length,
    soon = open * rate;
  const pE = Math.min(100, (earned / goal) * 100),
    pS = Math.min(100 - pE, (soon / goal) * 100);
  const toGoal = Math.max(0, Math.ceil((goal - earned) / rate));
  return (
    <section className="ee-card ee-card--forest ee-hero ee-chero" data-component="CloserMoneyHero">
      <div className="ee-card__head">
        <span className="eyebrow">Dein Geld · September</span>
        <button className="ee-btn ee-btn--sm" onClick={() => setEditing(!editing)}>
          <Icon name="edit" small /> Ziel
        </button>
      </div>
      {editing && <GoalForm ctx={ctx} goal={goal} onDone={() => setEditing(false)} accent />}
      <div className="ee-chero__num">
        <b className="num">{eur(earned)}</b>
        <span>von {eur(goal)}</span>
      </div>
      <div className="ee-chero__bar" role="progressbar" aria-valuenow={earned} aria-valuemax={goal} aria-label="Monatsziel">
        <i className="is-earned" style={{ width: `${pE}%` }} />
        <i className="is-soon" style={{ width: `${pS}%` }} />
      </div>
      <div className="ee-chero__stats">
        <div>
          <b className="num">{toGoal ? toGoal + (toGoal === 1 ? " Verkauf" : " Verkäufe") : "✓"}</b>
          <span>{toGoal ? "bis zum Ziel" : "Ziel erreicht"}</span>
        </div>
        <div>
          <b className="num">+{eur(soon)}</b>
          <span>in Aussicht · {open} Kunden</span>
        </div>
        <button onClick={() => ctx.go("auszahlungen")}>
          <b className="num">{cur ? cur.datum.slice(0, 6) : "–"}</b>
          <span>
            Auszahlung <Icon name="right" small />
          </span>
        </button>
      </div>
    </section>
  );
}

/* ---------- DailyGoal (Setter) – Hero-Karte ---------- */
export function DailyGoal() {
  const { data, role, me, now } = useDashboard();
  const todayStr = dkey(now).split("-").reverse().join(".");
  const today = leadsForUser(data.LEADS, role, me).filter((l) => l.datum === todayStr).length;
  const g = data.DAY_GOAL.goal,
    done = today >= g,
    streak = data.DAY_GOAL.streak + (done ? 1 : 0);
  return (
    <section className={`ee-card ee-card--forest ee-hero ee-daygoal ${done ? "is-done" : ""}`} data-component="DailyGoal">
      <div className="ee-card__head">
        <span className="eyebrow">Heute</span>
        {done ? (
          <span className="ee-daygoal__badge">
            <Icon name="check" small /> Tagesziel erreicht
          </span>
        ) : (
          <span className="eyebrow">Ziel {g} Leads</span>
        )}
      </div>
      <div className="ee-daygoal__main">
        <div className="ee-daygoal__num">
          <b className="num">{today}</b>
          <span>/ {g} Leads</span>
        </div>
        <div className="ee-daygoal__bar" role="progressbar" aria-valuenow={today} aria-valuemax={g} aria-label="Tagesziel">
          <i style={{ width: `${Math.min(100, (today / g) * 100)}%` }} />
        </div>
      </div>
      <div className="ee-week" aria-label="Diese Woche">
        {data.DAY_GOAL.week.map(([d, v]) => {
          const isToday = d === WD[now.getDay()];
          const val = isToday ? today : v;
          const hit = val !== null && val >= g;
          return (
            <div key={d} className={`ee-week__day ${hit ? "is-hit" : ""} ${isToday ? "is-today" : ""} ${val === null ? "is-future" : ""}`}>
              <span>{d}</span>
              <b className="num">{val === null ? "·" : val}</b>
            </div>
          );
        })}
      </div>
      <p className="ee-daygoal__streak">
        <Icon name="bolt" small /> Serie: <b>{streak} Tage</b>
        {done ? null : (
          <>
            {" "}
            · noch <b>{g - today}</b> bis zum Ziel
          </>
        )}
      </p>
    </section>
  );
}

/* ---------- SetterRankCard: Setter-Rangliste in Klartext (Startseite Setter) ---------- */
export function SetterRankCard() {
  const { data, me, person, go } = useDashboard();
  const B = data.SETTER_BOARD,
    R = ranked(B.rows),
    my = rankOf(me, B),
    n = R.length,
    top = R[0].val || 1;
  const above = R.filter((r) => r.val > my.val).slice(-1)[0];
  return (
    <section className="ee-card ee-cup" data-component="SetterRankCard">
      <div className="ee-card__head">
        <span className="eyebrow">Setter-Rangliste · bis {B.ends.slice(0, 6)}</span>
        <button className="ee-btn ee-btn--ghost ee-btn--sm" onClick={() => go("rangliste")}>
          Rangliste <Icon name="right" small />
        </button>
      </div>
      <div className="ee-cup__head">
        <b className="num">Platz {my.rank}</b>
        <span>
          von {n} · {my.val} {B.unit}
        </span>
      </div>
      <div className="ee-ranks">
        {R.map((r) => (
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
      <p className="ee-cup__list" style={{ display: "block" }}>
        {above ? (
          <>
            Noch{" "}
            <b>
              {above.val - my.val + 1} {B.unit}
            </b>{" "}
            bis Platz {above.rank}
          </>
        ) : (
          <b>Du führst die Setter-Rangliste</b>
        )}
      </p>
    </section>
  );
}

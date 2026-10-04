"use client";

import { useState } from "react";
import { TodoCard, useTodos } from "@/components/overview/Cards";
import { clickableRow } from "@/components/pipeline/LeadTable";
import { ToneChip } from "@/components/ui/Chips";
import Icon from "@/components/ui/Icon";
import { PageHead } from "@/components/ui/Kpi";
import { closerPaused, pendingFeedback } from "@/lib/appointments";
import { TARGETS } from "@/lib/domain";
import { WD, eur } from "@/lib/format";
import { callbackLate, isCalling, isOverdue } from "@/lib/leads";
import { perfTone } from "@/lib/ranking";
import { nextRun } from "@/lib/payouts";
import { openTodoCount } from "@/lib/todos";
import { openDrawer } from "@/lib/ui";
import { useDashboard } from "@/lib/useDashboard";

/* =====================================================================
   Übersicht für Admins (Tims Vorlage vom 03.10.2026):
   1. Heute zu tun (offene Aufgaben)  ·  Team-Monat gegen das Ziel (mit Soll bis heute)
   2. Zu erledigen (die wichtigsten Aufgaben, alle unter „To-Dos“)
   3. Trichter mit Umwandlungsquoten  ·  Verlustgründe
   4. Quoten je Rolle (Setter · Presetter · Closer)
   ===================================================================== */

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const de = (n: number) => String(n).replace(".", ",");
const dm = (datum: string) => datum.slice(0, 6);

/** Zahl mit Balken, grün/rot gegen den Teamschnitt */
function Quote({ v, avg }: { v: number | null; avg?: number }) {
  if (v == null) return <span className="faint">–</span>;
  const t = avg ? perfTone(v, avg) : "";
  return (
    <div className="ee-quote">
      <span className={t ? `num is-${t}` : "num"}>{v} %</span>
      <i>
        <b className={t ? `is-${t}` : undefined} style={{ width: `${Math.min(100, v)}%` }} />
      </i>
    </div>
  );
}

/** Mittelwert, gewichtet mit den Leads/Terminen je Person */
const weighted = (rows: { w: number; v: number | null }[]) => {
  const xs = rows.filter((r) => r.v != null && r.w > 0);
  const w = xs.reduce((s, r) => s + r.w, 0);
  return w ? Math.round(xs.reduce((s, r) => s + r.v! * r.w, 0) / w) : null;
};

function Hero() {
  const { data, now, go } = useDashboard();
  const todos = useTodos();
  const over = todos.filter((t) => t.group === "over").length;
  const open = openTodoCount(todos);
  /* nächster Lauf: früheste offene Abrechnung, sonst der nächste Stichtag */
  const openPayouts = Object.values(data.PAYOUTS)
    .flat()
    .filter((p) => p.status !== "ausgezahlt");
  const key = (d: string) => d.split(".").reverse().join("");
  const runDatum = openPayouts.map((p) => p.datum).sort((a, b) => key(a).localeCompare(key(b)))[0];
  const runSum = openPayouts.filter((p) => p.datum === runDatum && !p.hinweis).reduce((s, p) => s + p.betrag, 0);
  const next = nextRun(now);
  const nextDatum = `${String(next.zahltag.getDate()).padStart(2, "0")}.${String(next.zahltag.getMonth() + 1).padStart(2, "0")}.`;
  return (
    <section className="ee-card ee-card--forest ee-hero ee-daygoal" data-component="TodayHero">
      <div className="ee-card__head">
        <span className="eyebrow">
          Heute · {WD[now.getDay()]}, {String(now.getDate()).padStart(2, "0")}.{String(now.getMonth() + 1).padStart(2, "0")}.
        </span>
        {over ? <span className="eyebrow">{over} überfällig</span> : <span className="eyebrow">alles im Plan</span>}
      </div>
      <div className="ee-daygoal__main">
        <div className="ee-daygoal__num">
          <b className="num">{open}</b>
          <span>{open === 1 ? "offene Aufgabe" : "offene Aufgaben"}</span>
        </div>
      </div>
      <div className="ee-today__foot">
        <p className="ee-daygoal__streak">
          <span>
          {runDatum ? (
            <>
              Nächste Auszahlung: <b>{dm(runDatum)}</b> ({eur(runSum)})
            </>
          ) : (
            <>
              Nächster Abrechnungs-Stichtag: <b>{dm(`${String(next.stichtag.getDate()).padStart(2, "0")}.${String(next.stichtag.getMonth() + 1).padStart(2, "0")}.`)}</b> · Auszahlung am {nextDatum}
            </>
          )}
          </span>
        </p>
        <button className="ee-btn ee-btn--accent ee-btn--sm" onClick={() => go("todos")}>
          <Icon name="check" small /> To-Dos
        </button>
      </div>
    </section>
  );
}

function TeamMonth() {
  const { data, now, go } = useDashboard();
  const K = data.ADMIN_KPI;
  const goal = TARGETS.verkaufMonat;
  const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const soll = Math.round((goal * now.getDate()) / days);
  const sold = K.verkauft;
  const inSight = Math.max(0, K.verkaufstermin - K.verkauft);
  const growth = K.leadsVormonat ? Math.round((K.leads / K.leadsVormonat - 1) * 100) : 0;
  const diff = sold - soll;
  return (
    <section className="ee-card ee-month" data-component="TeamMonth">
      <div className="ee-card__head">
        <span className="eyebrow">Team · {K.monat}</span>
        <button className="ee-btn ee-btn--ghost ee-btn--sm" onClick={() => go("rangliste")}>
          Ranglisten <Icon name="right" small />
        </button>
      </div>
      <div className="ee-month__num">
        <b className="num">{sold} Anlagen</b>
        <span>von {goal} (Monatsziel)</span>
      </div>
      <div className="ee-goalbar ee-goalbar--soll" role="progressbar" aria-valuenow={sold} aria-valuemax={goal} aria-label="Teamziel">
        <i className="is-earned" style={{ width: `${Math.min(100, (sold / goal) * 100)}%` }} />
        <i className="is-soon" style={{ width: `${Math.min(100 - Math.min(100, (sold / goal) * 100), (inSight / goal) * 100)}%` }} />
        <s style={{ left: `${Math.min(100, (soll / goal) * 100)}%` }} title="Soll bis heute" />
      </div>
      <div className="ee-month__stats">
        <div>
          <b className={sold < soll * 0.85 ? "num is-bad" : "num"}>
            {diff > 0 ? "+" : ""}
            {diff}
          </b>
          <span>ggü. Soll heute ({soll})</span>
        </div>
        <div>
          <b className="num">{K.leads}</b>
          <span>
            Leads · <span className={growth >= 0 ? "is-good" : "is-bad"}>{growth >= 0 ? "+" : ""}{growth} %</span>
          </span>
        </div>
        <button onClick={() => go("auszahlungen")}>
          <b className="num is-money">{eur(Object.values(data.PAYOUTS).flat().filter((p) => p.status !== "ausgezahlt").reduce((s, p) => s + p.betrag, 0))}</b>
          <span>
            Auszahlungen offen <Icon name="right" small />
          </span>
        </button>
      </div>
    </section>
  );
}

function Funnel() {
  const { data, go } = useDashboard();
  const { WEEKLY, ADMIN_KPI: K } = data;
  const max = Math.max(1, ...WEEKLY.map((w) => w[1]));
  const steps: [string, number, number | null, string][] = [
    ["Eingereicht", K.leads, null, "eingereicht"],
    ["Aufmaßtermin", K.termin, TARGETS.terminQuote, "aufmass"],
    ["Checks", K.checks, TARGETS.checksQuote, "checks"],
    ["Verkaufstermin", K.verkaufstermin, null, "verkaufstermin"],
    ["Verkauf", K.verkauft, TARGETS.verkaufQuote, "verkauft"],
  ];
  return (
    <section className="ee-card" data-component="Funnel">
      <div className="ee-card__head">
        <h2>Pipeline {K.monat}</h2>
        <button className="ee-btn ee-btn--ghost ee-btn--sm" onClick={() => go("leads")}>
          Board <Icon name="right" small />
        </button>
      </div>
      <div className="ee-fun">
        {steps.map(([k, n, target, cls], i) => {
          const conv = i ? pct(n, steps[i - 1][1]) : null;
          const t = conv !== null && target ? perfTone(conv, target) : "";
          return (
            <div className="ee-fun__row" key={k}>
              <span className="ee-fun__lab">{k}</span>
              <div className="ee-fun__track">
                <i style={{ width: `${K.leads ? (n / K.leads) * 100 : 0}%`, background: `var(--st-${cls})` }} />
                <b className="num">{n}</b>
              </div>
              <span className={t ? `ee-fun__conv is-${t}` : "ee-fun__conv"}>
                {conv === null ? null : (
                  <>
                    <b className="num">{conv} %</b>
                    {target ? <small>Ziel {target} %</small> : null}
                  </>
                )}
              </span>
            </div>
          );
        })}
      </div>
      <div className="ee-flow__total">
        Von {K.leads} Leads wurden <b className="is-money">{K.verkauft} verkauft ({pct(K.verkauft, K.leads)} %)</b> · Quote = Anteil aus der Stufe davor
      </div>
      <hr className="divider" />
      <div className="ee-card__head">
        <h3>Eingereichte Leads je Woche</h3>
      </div>
      <div className="ee-bars" data-component="BarChart">
        {WEEKLY.map(([k, v], i) => (
          <div key={k} className={i === WEEKLY.length - 1 ? "ee-bars__col is-cur" : "ee-bars__col"}>
            <span className="ee-bars__v">{v}</span>
            <div className="ee-bars__bar" style={{ height: `${(v / max) * 100}%` }} />
            <span className="ee-bars__l">{k}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Loss() {
  const { data } = useDashboard();
  const { LOSS_STATS, ADMIN_KPI: K } = data;
  const lossMax = Math.max(1, ...LOSS_STATS.map((x) => x[1]));
  return (
    <section className="ee-card" data-component="LossReasons">
      <div className="ee-card__head">
        <h2>Verlustgründe</h2>
        <span className="muted">
          {K.monat} · {LOSS_STATS.reduce((s, x) => s + x[1], 0)} Leads
        </span>
      </div>
      <div className="ee-funnel">
        {LOSS_STATS.map(([k, v]) => (
          <div key={k} className="ee-funnel__row ee-funnel__row--loss">
            <span>{k}</span>
            <div className="ee-funnel__track">
              <i style={{ width: `${(v / lossMax) * 100}%` }} />
            </div>
            <b className="num" style={{ textAlign: "right" }}>
              {v}
            </b>
          </div>
        ))}
      </div>
    </section>
  );
}

function RoleQuotes() {
  const { data, now, person, go } = useDashboard();
  const [tab, setTab] = useState<"setter" | "presetter" | "closer">("setter");
  const { MB_STATS, PRESETTER_ROWS, CLOSER_ROWS, BENCH, APPTS, SLOTS, LEADS, ADMIN_KPI: K } = data;
  /* Beispieldaten: Seitenleiste mit Stammdaten; echte Daten: Team-Verwaltung */
  const open = (key: string) => () => (data.PROFILES[key] ? openDrawer({ kind: "team", key }) : go("team"));
  const days = (m: (typeof MB_STATS)[number]) =>
    m.days >= 5 ? <ToneChip label={`seit ${m.days} Tagen`} tone="bad" /> : m.days >= 3 ? <ToneChip label={`seit ${m.days} Tagen`} tone="warn" /> : <span className="sub">{m.days ? "gestern" : "heute"}</span>;

  let head: React.ReactNode, body: React.ReactNode;
  if (tab === "setter") {
    const t = MB_STATS.reduce((a, m) => ({ leads: a.leads + m.leads, termin: a.termin + m.termin, checks: a.checks + m.checks, verkauft: a.verkauft + m.verkauft }), { leads: 0, termin: 0, checks: 0, verkauft: 0 });
    const aQ = pct(t.termin, t.leads),
      aC = pct(t.checks, t.leads),
      aV = pct(t.verkauft, t.leads);
    head = (
      <tr>
        <th>Setter</th>
        <th className="r">Leads</th>
        <th>Terminquote</th>
        <th>Checks</th>
        <th>Verkauft</th>
        <th>Letzter Lead</th>
      </tr>
    );
    body = (
      <>
        {MB_STATS.map((m) => (
          <tr key={m.key} {...clickableRow(open(m.key))}>
            <td className="who">{person(m.key).first}</td>
            <td className="r num">{m.leads}</td>
            <td>
              <Quote v={pct(m.termin, m.leads)} avg={aQ} />
            </td>
            <td data-hide-sm="">
              <Quote v={pct(m.checks, m.leads)} avg={aC} />
            </td>
            <td>
              <Quote v={pct(m.verkauft, m.leads)} avg={aV} />
            </td>
            <td className="r-sm">{days(m)}</td>
          </tr>
        ))}
        <tr className="is-total">
          <td className="who">Setter gesamt</td>
          <td className="r num">
            <b>{t.leads}</b>
          </td>
          <td className="num">{aQ} %</td>
          <td data-hide-sm="" className="num">
            {aC} %
          </td>
          <td className="num">{aV} %</td>
          <td data-hide-sm="" />
        </tr>
      </>
    );
  } else if (tab === "presetter") {
    const aE = weighted(PRESETTER_ROWS.map((m) => ({ w: m.leads, v: m.reachQuote }))),
      aT = weighted(PRESETTER_ROWS.map((m) => ({ w: m.leads, v: m.terminQuote })));
    const goalH = BENCH.firstCallH;
    const overdue = (k: string) => LEADS.filter((l) => l.presetter === k && isCalling(l.status) && (isOverdue(l, now) || callbackLate(l, now))).length;
    head = (
      <tr>
        <th>Presetter</th>
        <th className="r">Leads</th>
        <th>Erreicht</th>
        <th>Terminquote</th>
        <th className="r">Ø bis Erstanruf</th>
        <th>Jetzt überfällig</th>
      </tr>
    );
    body = (
      <>
        {PRESETTER_ROWS.map((m) => {
          const od = overdue(m.key),
            tone = m.firstCallH != null && goalH ? perfTone(m.firstCallH, goalH, false) : "";
          return (
            <tr key={m.key} {...clickableRow(open(m.key))}>
              <td className="who">{person(m.key).first}</td>
              <td className="r num">{m.leads}</td>
              <td>
                <Quote v={m.reachQuote} avg={aE ?? undefined} />
              </td>
              <td>
                <Quote v={m.terminQuote} avg={aT ?? undefined} />
              </td>
              <td className="r num" data-hide-sm="" style={{ whiteSpace: "nowrap" }}>
                {m.firstCallH == null ? <span className="faint">–</span> : <b className={tone ? `is-${tone}` : undefined}>{de(m.firstCallH)} Std.</b>}
              </td>
              <td className="r-sm">{od ? <ToneChip label={`${od} überfällig`} tone="bad" /> : <ToneChip label="alles im Plan" tone="ok" />}</td>
            </tr>
          );
        })}
        {PRESETTER_ROWS.length ? (
          <tr className="is-total">
            <td className="who">Gesamt</td>
            <td className="r num">
              <b>{PRESETTER_ROWS.reduce((s, m) => s + m.leads, 0)}</b>
            </td>
            <td className="num">{aE == null ? "–" : `${aE} %`}</td>
            <td className="num">{aT == null ? "–" : `${aT} %`}</td>
            <td className="r num" data-hide-sm="">
              {goalH ? `Ziel ${de(goalH)} Std.` : ""}
            </td>
            <td data-hide-sm="" />
          </tr>
        ) : null}
      </>
    );
  } else {
    const nextMon = new Date(now.getFullYear(), now.getMonth(), now.getDate() + ((8 - now.getDay()) % 7 || 7));
    const nextSun = new Date(nextMon.getFullYear(), nextMon.getMonth(), nextMon.getDate() + 6);
    const k = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const slots = (c: string) => SLOTS.filter((s) => s.closer === c && s.date >= k(nextMon) && s.date <= k(nextSun)).length;
    head = (
      <tr>
        <th>Closer</th>
        <th className="r">Aufmaßtermine</th>
        <th>Aufmaß → Checks</th>
        <th>Verkaufsquote</th>
        <th className="r">Slots n. Woche</th>
        <th>Rückmeldungen</th>
      </tr>
    );
    body = CLOSER_ROWS.map((m) => {
      const pf = pendingFeedback(APPTS, m.key, now).length,
        sl = slots(m.key);
      return (
        <tr key={m.key} {...clickableRow(open(m.key))}>
          <td className="who">{person(m.key).first}</td>
          <td className="r num">{m.termine}</td>
          <td>
            <Quote v={m.checksQuote} avg={BENCH.checks} />
          </td>
          <td>
            <Quote v={m.verkaufQuote} avg={BENCH.closerQuote} />
          </td>
          <td className={sl < 4 ? "r num is-bad" : "r num"} data-hide-sm="">
            {sl}
          </td>
          <td className="r-sm">
            {closerPaused(APPTS, m.key, now) ? <ToneChip label={`pausiert · ${pf} offen`} tone="bad" /> : pf ? <ToneChip label={`${pf} offen`} tone="warn" /> : <ToneChip label="vollständig" tone="ok" />}
          </td>
        </tr>
      );
    });
  }
  const empty = tab === "presetter" ? !PRESETTER_ROWS.length : tab === "closer" ? !CLOSER_ROWS.length : !MB_STATS.length;
  return (
    <section className="ee-card ee-card--flush" data-component="QuoteTable">
      <div className="ee-card__head">
        <h2>Quoten je Rolle</h2>
        <div className="ee-seg" role="group" aria-label="Rolle">
          {(
            [
              ["setter", "Setter"],
              ["presetter", "Presetter"],
              ["closer", "Closer"],
            ] as const
          ).map(([k, l]) => (
            <button key={k} aria-pressed={tab === k} onClick={() => setTab(k)}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <div className="ee-table-wrap">
        <table className="ee-table ee-table--stack">
          <thead>{head}</thead>
          <tbody>{body}</tbody>
        </table>
        {empty && <div className="ee-empty">Noch keine Zahlen für diese Rolle.</div>}
      </div>
      <p className="ee-card__foot faint">
        {K.monat} · grün/rot = deutlich über/unter dem Teamschnitt
      </p>
    </section>
  );
}

export default function AdminOverview() {
  const { firstName, go } = useDashboard();
  return (
    <>
      <PageHead
        title={`Hallo ${firstName}`}
        actions={
          <>
            <button className="ee-btn ee-btn--primary" onClick={() => go("team")}>
              <Icon name="plus" small /> MB anlegen
            </button>
            <button className="ee-btn" onClick={() => go("events")}>
              <Icon name="flag" small /> Event posten
            </button>
          </>
        }
      />
      <div className="ee-grid g-2 g-ovtop">
        <Hero />
        <TeamMonth />
      </div>
      <TodoCard />
      <div className="ee-grid g-main" style={{ alignItems: "start" }}>
        <Funnel />
        <div className="stack">
          <Loss />
        </div>
      </div>
      <RoleQuotes />
    </>
  );
}

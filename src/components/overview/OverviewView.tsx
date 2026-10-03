"use client";

import { Fragment, type ReactNode } from "react";
import LeadTable, { clickableRow } from "@/components/pipeline/LeadTable";
import { CallbackAlerts } from "@/components/presetter/CallTools";
import { leadsTodayOf, MonthCard, QuoteCard, RankCard, TodayHero, TodoCard, useTodos, WeekStrip, type QuoteRow } from "@/components/overview/Cards";
import Icon from "@/components/ui/Icon";
import { ToneChip } from "@/components/ui/Chips";
import { Kpi, PageHead } from "@/components/ui/Kpi";
import { apptEnd, closerPaused, pendingFeedback } from "@/lib/appointments";
import { TARGETS } from "@/lib/domain";
import { eur, fmtDay, fmtHour } from "@/lib/format";
import { activeLeads, apptStart, callbackLate, isCalling, isOverdue, leadsForUser, newestFirst, urgencySort } from "@/lib/leads";
import { perfTone } from "@/lib/ranking";
import { useStore } from "@/lib/store";
import { useDashboard } from "@/lib/useDashboard";
import { openDrawer } from "@/lib/ui";


/* =====================================================================
   Übersicht – gleiches Schema für Setter, Presetter und Closer (Tims Vorlage):
   1. Heute (Tagesziel)  ·  Monat (Geld)
   2. Zu erledigen (die 3 wichtigsten To-Dos)
   3. Rangliste  ·  Quote gegen den Teamschnitt
   ===================================================================== */
function OverviewLayout({ hero, quotes, top }: { hero: ReactNode; quotes: QuoteRow[]; top?: ReactNode }) {
  const { firstName } = useDashboard();
  return (
    <>
      <PageHead title={`Hallo ${firstName}`} />
      {top}
      <div className="ee-grid g-2 g-ovtop">
        {hero}
        <MonthCard />
      </div>
      <TodoCard />
      <div className="ee-grid g-2 g-ovbot">
        <RankCard />
        <QuoteCard rows={quotes} />
      </div>
    </>
  );
}

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : null);
/** 3.4 → „3,4 Std.“ */
const hours = (n: number) => `${n.toLocaleString("de-DE", { maximumFractionDigits: 1 })} Std.`;

/* ======================= Setter ======================= */
function SetterOverview() {
  const ctx = useDashboard();
  const { data, me, go } = ctx;
  const today = leadsTodayOf(ctx).length,
    g = data.DAY_GOAL.goal;
  const m = data.MB_STATS.find((x) => x.key === me);
  return (
    <OverviewLayout
      hero={
        <TodayHero
          num={today}
          goal={g}
          unit="Leads"
          extra={<WeekStrip today={today} goal={g} week={data.DAY_GOAL.week} />}
          line={
            <>
              <Icon name="bolt" small /> Serie: <b>{data.DAY_GOAL.streak + (today >= g ? 1 : 0)} Tage</b>
            </>
          }
          cta={
            <button className="ee-btn ee-btn--accent ee-btn--sm" onClick={() => go("erfassen")}>
              <Icon name="plus" small /> Lead erfassen
            </button>
          }
        />
      }
      quotes={[
        { label: "Terminquote", me: m ? pct(m.termin, m.leads) : null, team: data.BENCH.setterTermin },
        { label: "Verkaufsquote", me: m ? pct(m.verkauft, m.leads) : null, team: data.BENCH.setterVerkauf, max: 40 },
      ]}
    />
  );
}

/* ======================= Presetter ======================= */
function PresetterOverview() {
  const { data, role, me, now, go } = useDashboard();
  const queue = leadsForUser(data.LEADS, role, me)
    .filter((l) => isCalling(l.status))
    .sort(urgencySort(now));
  const overdue = queue.filter((l) => isOverdue(l, now) || callbackLate(l, now)).length;
  const { CALL_DAY: C, BENCH } = data;
  return (
    <OverviewLayout
      top={<CallbackAlerts leads={queue} />}
      hero={
        <TodayHero
          num={C.done}
          goal={C.goal}
          unit="Anrufe"
          extra={<WeekStrip today={C.done} goal={C.goal} week={C.week} />}
          line={
            <>
              <Icon name="bolt" small /> Serie: <b>{C.streak + (C.done >= C.goal ? 1 : 0)} Tage</b> · <b>{C.termine}</b> {C.termine === 1 ? "Termin" : "Termine"}
              {overdue ? (
                <>
                  {" "}
                  · <b>{overdue}</b> überfällig
                </>
              ) : null}
            </>
          }
          cta={
            <button className="ee-btn ee-btn--accent ee-btn--sm" onClick={() => go("leitfaden")}>
              <Icon name="phone" small /> Anrufe starten
            </button>
          }
        />
      }
      quotes={[
        { label: "Terminquote", me: BENCH.presetterTerminMe, team: BENCH.presetterTermin },
        { label: "Erreichquote", me: BENCH.reachMe, team: BENCH.reach },
        { label: "Ø bis Erstanruf", me: BENCH.firstCallMe, team: BENCH.firstCallTeam, ziel: BENCH.firstCallH, lowerIsBetter: true, max: 6, fmt: hours },
      ]}
    />
  );
}

/* ======================= Closer ======================= */
function CloserOverview() {
  const { data, me, now, go } = useDashboard();
  const todos = useTodos();
  const open = todos.filter((t) => t.group !== "later" && t.tone !== "ok").length;
  const next = data.APPTS.filter((a) => a.closer === me && apptEnd(a) > now).sort((a, b) => apptStart(a).getTime() - apptStart(b).getTime())[0];
  const { CLOSER_DAY: C, BENCH } = data;
  return (
    <OverviewLayout
      top={
        closerPaused(data.APPTS, me, now) && (
          <div className="ee-alert ee-alert--bad">
            <Icon name="lock" small /> Deine Slots sind für neue Leads pausiert, bis alle Rückmeldungen erledigt sind.
          </div>
        )
      }
      hero={
        <TodayHero
          num={C.done}
          goal={C.done + open}
          unit={C.done + open === 1 ? "Aufgabe" : "Aufgaben"}
          extra={<WeekStrip today={C.done} goal={C.done + open} week={C.week} />}
          line={
            <>
              <Icon name="bolt" small /> Serie: <b>{C.streak + (!open ? 1 : 0)} Tage</b> alles erledigt
              {next ? (
                <>
                  {" "}
                  · Nächster Termin: <b>
                    {fmtDay(next.date)} {fmtHour(next.start)}
                  </b>
                </>
              ) : null}
            </>
          }
          cta={
            <button className="ee-btn ee-btn--accent ee-btn--sm" onClick={() => go("todos")}>
              <Icon name="check" small /> To-Dos
            </button>
          }
        />
      }
      quotes={[
        { label: "Verkaufsquote", me: BENCH.closerQuoteMe, team: BENCH.closerQuote },
        { label: "Aufmaß → Checks", me: BENCH.checksMe, team: BENCH.checks },
      ]}
    />
  );
}

/* ======================= Admin ======================= */
function QuoteCell({ v, avg }: { v: number; avg: number }) {
  const t = perfTone(v, avg);
  return (
    <div className="ee-quote">
      <span className={t ? `num is-${t}` : "num"}>{v} %</span>
      <i>
        <b className={t ? `is-${t}` : undefined} style={{ width: `${Math.min(100, v)}%` }} />
      </i>
    </div>
  );
}

function AdminOverview() {
  const { data, now, person, go, openLead } = useDashboard();
  const { WEEKLY, PAYOUTS, MB_STATS, LOSS_STATS, ADMIN_KPI: K } = data;
  const { live } = useStore();
  const lead = (id: string) => data.LEADS.find((l) => l.id === id)!;
  const openC = live.contracts?.openAll ?? 0,
    questionsC = live.contracts?.questions ?? 0;
  const max = Math.max(1, ...WEEKLY.map((w) => w[1]));
  const payOpen = Object.values(PAYOUTS)
    .flat()
    .filter((p) => p.status !== "ausgezahlt")
    .reduce((s, p) => s + p.betrag, 0);
  const openPayouts = Object.values(PAYOUTS)
    .flat()
    .filter((p) => p.status !== "ausgezahlt");
  const inReview = openPayouts.filter((p) => p.status === "pruefung");
  const nextPayout = openPayouts.map((p) => p.datum).sort((x, y) => x.split(".").reverse().join().localeCompare(y.split(".").reverse().join()))[0];
  const inactive = MB_STATS.filter((m) => m.days >= 3);
  const lossMax = Math.max(1, ...LOSS_STATS.map((x) => x[1]));
  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
  const team = MB_STATS.reduce(
    (t, m) => ({ leads: t.leads + m.leads, termin: t.termin + m.termin, checks: t.checks + m.checks, verkauft: t.verkauft + m.verkauft }),
    { leads: 0, termin: 0, checks: 0, verkauft: 0 },
  );
  const avgQ = pct(team.termin, team.leads),
    avgT = pct(team.checks, team.leads),
    avgA = pct(team.verkauft, team.leads);
  /* Beispieldaten: Seitenleiste mit Stammdaten; echte Daten: Team-Verwaltung */
  const teamRow = (key: string) => () => (data.PROFILES[key] ? openDrawer({ kind: "team", key }) : go("team"));
  const closers = [...new Set(data.APPTS.map((a) => a.closer))];
  const todo = [
    ...closers
      .filter((k) => pendingFeedback(data.APPTS, k, now).length)
      .map((k) => {
        const paused = closerPaused(data.APPTS, k, now),
          pend = pendingFeedback(data.APPTS, k, now);
        return {
          tone: paused ? "bad" : "warn",
          chip: paused ? "Pausiert" : "Offen",
          title: `${person(k).first}: ${pend.length} Rückmeldungen offen`,
          sub: pend.map((a) => lead(a.lead).kunde).join(", "),
          onClick: teamRow(k),
        };
      }),
    ...inactive.map((m) => ({
      tone: m.days >= 5 ? "bad" : "warn",
      chip: "Inaktiv",
      title: `${person(m.key).first} seit ${m.days} Tagen ohne Lead`,
      sub: `Letzter Lead am ${m.last}`,
      onClick: teamRow(m.key),
    })),
    ...(questionsC
      ? [{ tone: "warn", chip: "Klären", title: `${questionsC} ${questionsC === 1 ? "Rückfrage" : "Rückfragen"} zu Verträgen`, sub: "Unter Verträge beantworten", onClick: () => go("vertraege") }]
      : []),
    ...(openC
      ? [{ tone: "warn", chip: "Offen", title: `${openC} ${openC === 1 ? "Vertrag" : "Verträge"} nicht unterschrieben`, sub: "Erinnerung per E-Mail möglich", onClick: () => go("vertraege") }]
      : []),
    ...(inReview.length
      ? [
          {
            tone: "info",
            chip: "Freigeben",
            title: `${inReview.length} ${inReview.length === 1 ? "Abrechnung" : "Abrechnungen"} in Prüfung`,
            sub: `Auszahlung am ${inReview[0].datum}`,
            onClick: () => go("auszahlungen"),
          },
        ]
      : []),
  ];
  const flow: [string, number, number | null, string | null][] = [
    ["Eingereicht", K.leads, null, null],
    ["Aufmaßtermin", K.termin, TARGETS.terminQuote, "aufmass"],
    ["Checks", K.checks, TARGETS.checksQuote, "checks"],
    ["Verkaufstermin", K.verkaufstermin, null, "verkaufstermin"],
    ["Verkauf", K.verkauft, TARGETS.verkaufQuote, "verkauft"],
  ];
  const terminQuote = pct(K.termin, K.leads);
  const leadsDelta = K.leadsVormonat ? Math.round(((K.leads - K.leadsVormonat) / K.leadsVormonat) * 100) : 0;
  /* Monatsziel anteilig bis heute */
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const sollHeute = Math.round((TARGETS.verkaufMonat * now.getDate()) / daysInMonth);
  return (
    <>
      <PageHead
        title="Gesamtübersicht"
        actions={
          <>
            <button className="ee-btn ee-btn--primary" onClick={() => go("team")}>
              <Icon name="plus" small /> Setter anlegen
            </button>
            <button className="ee-btn" onClick={() => go("events")}>
              <Icon name="flag" small /> Event posten
            </button>
          </>
        }
      />
      <div className="ee-grid g-kpi">
        <Kpi
          label="Leads eingereicht"
          value={K.leads}
          meta={K.leadsVormonat ? `${leadsDelta >= 0 ? "+" : "−"}${Math.abs(leadsDelta)} % ggü. ${K.vormonat}` : `im ${K.monat}`}
          tone={perfTone(K.leads, K.leadsVormonat)}
        />
        <Kpi label="Terminquote" value={`${terminQuote} %`} meta={`Ziel ${TARGETS.terminQuote} %`} tone={perfTone(terminQuote, TARGETS.terminQuote)} />
        <Kpi label="In den Checks" value={K.checks} meta={`${K.checksWoche} diese Woche`} />
        <Kpi label="Verkauft" value={K.verkauft} meta={`Soll heute: ${sollHeute} von ${TARGETS.verkaufMonat}`} tone={perfTone(K.verkauft, sollHeute)} />
        <Kpi label="Offene Verträge" value={openC} meta="Elektronische Unterschrift" tone={openC ? "bad" : "good"} />
        <Kpi label="Auszahlungen offen" value={eur(payOpen)} meta={nextPayout ? `zum ${nextPayout.slice(0, 6)}` : "keine offen"} tone="money" />
      </div>
      <div className="ee-grid g-main" style={{ alignItems: "start" }}>
        <section className="ee-card" data-component="Funnel">
          <div className="ee-card__head">
            <h2>Pipeline {K.monat}</h2>
            <button className="ee-btn ee-btn--ghost ee-btn--sm" onClick={() => go("leads")}>
              Board <Icon name="right" small />
            </button>
          </div>
          <div className="ee-flow">
            {flow.map(([k, n, target, cls], i) => {
              const conv = i ? pct(n, flow[i - 1][1]) : null;
              const t = conv !== null && target ? perfTone(conv, target) : "";
              return (
                <Fragment key={k}>
                  {i ? (
                    <div className={t ? `ee-flow__arrow is-${t}` : "ee-flow__arrow"}>
                      <b className="num">{conv} %</b>
                      <small>Ziel {target} %</small>
                    </div>
                  ) : null}
                  <div className={cls ? `ee-flow__step is-${cls}` : "ee-flow__step"}>
                    <b className="num">{n}</b>
                    <span>{k}</span>
                  </div>
                </Fragment>
              );
            })}
          </div>
          <div className="ee-flow__total">
            Von {K.leads} eingereichten Leads wurden{" "}
            <b className="is-money">
              {K.verkauft} verkauft ({pct(K.verkauft, K.leads)} %)
            </b>
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
        <section className="ee-card" data-component="TodoList">
          <div className="ee-card__head">
            <h2>Handlungsbedarf</h2>
            <span className="ee-chip ee-chip--bad">{todo.length}</span>
          </div>
          <div className="ee-todo">
            {todo.map((t, i) => (
              <button key={i} className={`ee-todo__row is-${t.tone}`} onClick={t.onClick}>
                <div className="ee-list__main">
                  <div className="ee-list__title">{t.title}</div>
                  <div className="ee-list__sub">{t.sub}</div>
                </div>
                <ToneChip label={t.chip} tone={t.tone} />
              </button>
            ))}
          </div>
        </section>
      </div>
      <div className="ee-grid g-main" style={{ alignItems: "start" }}>
        <section className="ee-card ee-card--flush" data-component="QuoteTable">
          <div className="ee-card__head">
            <h2>Quoten je Setter</h2>
            <span className="muted">{K.monat}</span>
          </div>
          <div className="ee-table-wrap">
            <table className="ee-table ee-table--stack">
              <thead>
                <tr>
                  <th>Setter</th>
                  <th className="r">Leads</th>
                  <th>Termin</th>
                  <th>Checks</th>
                  <th>Verkauft</th>
                  <th>Letzter Lead</th>
                </tr>
              </thead>
              <tbody>
                {MB_STATS.map((m) => (
                  <tr key={m.key} {...clickableRow(teamRow(m.key))}>
                    <td className="who">{person(m.key).first}</td>
                    <td className="r num">{m.leads}</td>
                    <td data-hide-sm="">
                      <QuoteCell v={pct(m.termin, m.leads)} avg={avgQ} />
                    </td>
                    <td data-hide-sm="">
                      <QuoteCell v={pct(m.checks, m.leads)} avg={avgT} />
                    </td>
                    <td>
                      <QuoteCell v={pct(m.verkauft, m.leads)} avg={avgA} />
                    </td>
                    <td className="r-sm">
                      {m.days >= 5 ? (
                        <ToneChip label={`seit ${m.days} Tagen`} tone="bad" />
                      ) : m.days >= 3 ? (
                        <ToneChip label={`seit ${m.days} Tagen`} tone="warn" />
                      ) : (
                        <span className="sub">{m.days ? "gestern" : "heute"}</span>
                      )}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td className="who">Team</td>
                  <td className="r num">
                    <b>{team.leads}</b>
                  </td>
                  <td data-hide-sm="" className="num">
                    {avgQ} %
                  </td>
                  <td data-hide-sm="" className="num">
                    {avgT} %
                  </td>
                  <td className="num">{avgA} %</td>
                  <td data-hide-sm="" />
                </tr>
              </tbody>
            </table>
          </div>
        </section>
        <section className="ee-card" data-component="LossReasons">
          <div className="ee-card__head">
            <h2>Verlustgründe</h2>
            <span className="muted">{K.monat}</span>
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
      </div>
      <section className="ee-card ee-card--flush">
        <div className="ee-card__head">
          <h2>Neueste Leads</h2>
          <button className="ee-btn ee-btn--ghost ee-btn--sm" onClick={() => go("leads")}>
            Pipeline <Icon name="right" small />
          </button>
        </div>
        <LeadTable leads={activeLeads(data.LEADS).sort(newestFirst).slice(0, 6)} showSetter onOpen={openLead} person={person} />
      </section>
    </>
  );
}

export default function OverviewView() {
  const { role } = useDashboard();
  if (role === "setter") return <SetterOverview />;
  if (role === "presetter") return <PresetterOverview />;
  if (role === "closer") return <CloserOverview />;
  return <AdminOverview />;
}

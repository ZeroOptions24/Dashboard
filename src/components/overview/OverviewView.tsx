"use client";

import { Fragment, type ReactNode } from "react";
import { RelWhen } from "@/components/closer/AppointmentCard";
import EventCard from "@/components/events/EventCard";
import LeadTable, { clickableRow } from "@/components/pipeline/LeadTable";
import { CallbackAlerts, FilteredCallQueue } from "@/components/presetter/CallTools";
import { CloserMoneyHero, DailyGoal, MoneyCard, SetterRankCard } from "@/components/overview/Cards";
import Icon from "@/components/ui/Icon";
import { StatusChip, ToneChip } from "@/components/ui/Chips";
import { Kpi, PageHead, VsTeam } from "@/components/ui/Kpi";
import { apptEnd, bookableSlots, closerPaused, feedbackDue, kindLabel, pendingFeedback } from "@/lib/appointments";
import { TARGETS } from "@/lib/domain";
import { WD, dkey, eur, fmtDay, fmtDue, fmtHour, pad, parseKey } from "@/lib/format";
import { activeLeads, apptStart, callbackLate, hadTermin, isCalling, isOverdue, leadsForUser, newestFirst, urgencySort } from "@/lib/leads";
import { perfTone } from "@/lib/ranking";
import { useStore } from "@/lib/store";
import { useDashboard } from "@/lib/useDashboard";
import type { Appointment } from "@/lib/types";
import { openDrawer } from "@/lib/ui";


/* ======================= Setter ======================= */
function SetterOverview() {
  const { data, role, me, person, go, openLead, firstName } = useDashboard();
  const L = leadsForUser(data.LEADS, role, me);
  const monthKey = `.${pad(data.NOW.getMonth() + 1)}.${data.NOW.getFullYear()}`;
  const inMonth = L.filter((l) => l.datum.endsWith(monthKey));
  const q = L.filter((l) => hadTermin(l.status)).length;
  const nextEvent = data.EVENTS.slice().sort((a, b) => a.date.localeCompare(b.date))[0];
  const m = data.MB_STATS.find((x) => x.key === me) || { leads: inMonth.length, termin: q };
  /* ohne Leads im Monat gibt es noch keine Quote */
  const qq = m.leads ? Math.round((m.termin / m.leads) * 100) : null;
  const notifs = data.NOTIFS[me] || [];
  const unread = notifs.filter((n) => n.unread).length;
  /* Reihenfolge nach Priorität: Geld · Heute · Eingereicht · Quote · Setter-Rangliste · Letzte Leads · (Event, Verlauf) */
  return (
    <>
      <PageHead title={`Hallo ${firstName}`} />
      <div className="ee-grid g-hero">
        <MoneyCard />
        <DailyGoal />
      </div>
      <div className="ee-grid g-setter2">
        <div className="ee-setter-kpis">
          <Kpi
            label={`Eingereichte Leads · ${data.ADMIN_KPI.monat.slice(0, 3)}.`}
            value={m.leads}
            meta={<VsTeam v={m.leads} bench={data.BENCH.setterLeads} />}
            tone={perfTone(m.leads, data.BENCH.setterLeads)}
          />
          {qq == null ? (
            <Kpi label="Terminquote" value="–" meta={`noch keine Leads im ${data.ADMIN_KPI.monat}`} />
          ) : (
            <Kpi
              label="Terminquote"
              value={`${qq} %`}
              meta={<VsTeam v={qq} bench={data.BENCH.setterTermin} unit=" %" />}
              tone={perfTone(qq, data.BENCH.setterTermin)}
            />
          )}
        </div>
        <SetterRankCard />
      </div>
      <section className="ee-card ee-card--flush">
        <div className="ee-card__head">
          <h2>Letzte Leads</h2>
          <button className="ee-btn ee-btn--ghost ee-btn--sm" onClick={() => go("leads")}>
            Alle <Icon name="right" small />
          </button>
        </div>
        <LeadTable leads={activeLeads(L).sort(newestFirst).slice(0, 5)} showSetter={false} onOpen={openLead} person={person} />
      </section>
      <div className="ee-grid g-2" style={{ alignItems: "start" }}>
        {nextEvent && (
          <section className="ee-card">
            <div className="ee-card__head">
              <h2>Nächstes Event</h2>
            </div>
            <EventCard event={nextEvent} />
          </section>
        )}
        <section className="ee-card" data-component="StatusFeed">
          <div className="ee-card__head">
            <h2>Verlauf</h2>
            {unread ? <span className="ee-chip ee-chip--info">{unread} neu</span> : null}
          </div>
          <div className="ee-feed">
            {notifs.slice(0, 4).map((n, i) => (
              <div key={i} className={n.unread ? "ee-feed__row is-new" : "ee-feed__row"}>
                {n.status ? <StatusChip status={n.status} /> : <span className="ee-chip">Info</span>}
                <div className="ee-feed__main">
                  <div className="ee-feed__text">{n.t}</div>
                  <div className="ee-feed__time">{n.time}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

/* ======================= Presetter ======================= */
function PresetterOverview() {
  const { data, role, me, now, person, firstName } = useDashboard();
  const L = leadsForUser(data.LEADS, role, me);
  const queue = L.filter((l) => isCalling(l.status)).sort(urgencySort(now));
  const overdue = queue.filter((l) => isOverdue(l, now) || callbackLate(l, now)).length;
  const { CALL_DAY, BENCH } = data;
  const booking = bookableSlots(data.SLOTS, data.APPTS, now);
  return (
    <>
      <PageHead title={`Hallo ${firstName}`} />
      <CallbackAlerts leads={queue} />
      <div className="ee-grid g-main" style={{ alignItems: "start" }}>
        <div className="stack" style={{ gap: 18 }}>
          <div className="ee-grid g-kpi4">
            <Kpi
              label="Anrufe heute"
              value={
                <>
                  {CALL_DAY.done} <small>von {CALL_DAY.goal}</small>
                </>
              }
              meta={
                <span className="ee-kpi__bar">
                  <i style={{ width: `${Math.min(100, (CALL_DAY.done / CALL_DAY.goal) * 100)}%` }} />
                </span>
              }
              tone={CALL_DAY.done >= CALL_DAY.goal ? "good" : ""}
            />
            <Kpi
              label="Überfällig"
              value={overdue}
              meta={overdue ? "Neu > 24 Std. oder Rückruf verpasst" : "alles im Plan"}
              tone={overdue ? "bad" : "good"}
            />
            {BENCH.firstCallMe != null ? (
              <Kpi
                label="Ø bis Erstanruf"
                value={
                  <>
                    {num1(BENCH.firstCallMe)} <small>Std.</small>
                  </>
                }
                meta={
                  BENCH.firstCallMe > BENCH.firstCallH ? (
                    <>
                      <span className="is-bad">▲ {num1(BENCH.firstCallMe - BENCH.firstCallH)} Std.</span> über Ziel ({BENCH.firstCallH} Std.)
                    </>
                  ) : (
                    <>
                      <span className="is-good">im Ziel</span> ({BENCH.firstCallH} Std.)
                    </>
                  )
                }
                tone={perfTone(BENCH.firstCallMe, BENCH.firstCallH, false)}
              />
            ) : (
              <Kpi label="Ø bis Erstanruf" value="–" meta={`noch keine Anrufe diesen Monat · Ziel ${BENCH.firstCallH} Std.`} />
            )}
            {BENCH.presetterTerminMe != null ? (
              <Kpi
                label="Terminquote"
                value={`${BENCH.presetterTerminMe} %`}
                meta={<VsTeam v={BENCH.presetterTerminMe} bench={BENCH.presetterTermin} unit=" %" />}
                tone={perfTone(BENCH.presetterTerminMe, BENCH.presetterTermin)}
              />
            ) : (
              <Kpi label="Terminquote" value="–" meta="noch keine Anrufe diesen Monat" />
            )}
          </div>
          <section className="ee-card ee-card--flush" data-component="CallQueue">
            <div className="ee-card__head">
              <h2>Anrufliste</h2>
              <span className={queue.length ? "ee-chip ee-chip--info" : "ee-chip ee-chip--pos"}>{queue.length} offen</span>
            </div>
            <FilteredCallQueue queue={queue} />
          </section>
        </div>
        <div className="stack" style={{ gap: 18 }}>
          <MoneyCard />
          <section className="ee-card">
            <div className="ee-card__head">
              <h2>Freie Closer-Slots</h2>
              <span className="muted">{booking.closers.map((k) => person(k).first).join(", ")}</span>
            </div>
            <div className="ee-list">
              {booking.paused.length > 0 && (
                <div className="ee-alert ee-alert--bad">
                  <Icon name="lock" small /> {booking.paused.map((k) => person(k).first).join(", ")} {booking.paused.length > 1 ? "sind" : "ist"} pausiert – offene
                  Rückmeldungen
                </div>
              )}
              {!booking.slots.length && !booking.paused.length && <p className="muted">Keine freien Termine.</p>}
              {booking.slots
                .slice(0, 4)
                .map((s) => (
                  <div key={s.id} className="ee-list__row">
                    <div className="ee-list__main">
                      <div className="ee-list__title">
                        {fmtDay(s.date)} · {fmtHour(s.start)} Uhr
                      </div>
                      {booking.closers.length > 1 && <div className="ee-list__sub">{person(s.closer).first}</div>}
                    </div>
                    <span className="ee-chip ee-chip--pos">frei</span>
                  </div>
                ))}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

/* ======================= Closer ======================= */

interface Todo {
  tone: "bad" | "warn" | "info";
  title: string;
  sub: string;
  right: ReactNode;
  onClick: () => void;
}

/** 3.4 → „3,4“ */
const num1 = (n: number) => n.toLocaleString("de-DE", { maximumFractionDigits: 1 });

function CloserOverview() {
  const { data, me, now, go, firstName } = useDashboard();
  const lead = (id: string) => data.LEADS.find((l) => l.id === id)!;
  const up = data.APPTS.filter((a) => a.closer === me && apptEnd(a) > now).sort((a, b) => apptStart(a).getTime() - apptStart(b).getTime());
  const due = pendingFeedback(data.APPTS, me, now).sort((a, b) => feedbackDue(a).getTime() - feedbackDue(b).getTime());
  const inChecks = data.LEADS.filter(
    (l) => l.closer === me && ["checks", "verkaufstermin"].includes(l.status) && !data.APPTS.some((a) => a.lead === l.id && a.kind === "closing" && !a.feedback),
  );
  /* freie Slots in der kommenden Kalenderwoche (Mo–So) */
  const mon = new Date(now.getFullYear(), now.getMonth(), now.getDate() + ((8 - now.getDay()) % 7 || 7)),
    sun = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6);
  const nextWeek = data.SLOTS.filter((s) => s.closer === me && s.date >= dkey(mon) && s.date <= dkey(sun)).length;
  const dueChip = (a: Appointment) => {
    const d = feedbackDue(a),
      h = (d.getTime() - now.getTime()) / 36e5;
    return <ToneChip label={h < 0 ? "überfällig" : `bis ${fmtDue(d, now)}`} tone={h < 6 ? "bad" : "warn"} />;
  };
  /* Aufgaben: nur was jetzt zu tun ist, dringendstes zuerst */
  const todo: Todo[] = [
    ...due.map((a) => ({
      tone: (feedbackDue(a) < now || feedbackDue(a).getTime() - now.getTime() < 216e5 ? "bad" : "warn") as Todo["tone"],
      title: lead(a.lead).kunde,
      sub: `Ergebnis ${kindLabel(a)} · ${fmtDay(a.date)}`,
      right: dueChip(a),
      onClick: () => openDrawer({ kind: "feedback", id: a.id }),
    })),
    ...inChecks.map((l) => ({
      tone: "info" as const,
      title: l.kunde,
      sub: "Ergebnis aus den Checks",
      right: <ToneChip label="offen" tone="info" />,
      onClick: () => openDrawer({ kind: "feedback", id: `LEAD:${l.id}` }),
    })),
    ...(nextWeek < 4
      ? [
          {
            tone: "warn" as const,
            title: "Slots nächste Woche",
            sub: nextWeek ? `erst ${nextWeek} eingetragen` : "noch keine eingetragen",
            right: <ToneChip label={`${nextWeek} / 4`} tone="warn" />,
            onClick: () => go("kalender"),
          },
        ]
      : []),
  ];
  const week = up.filter((a) => a.date <= "2026-09-27");
  return (
    <>
      <PageHead title={`Hallo ${firstName}`} />
      {closerPaused(data.APPTS, me, now) && (
        <div className="ee-alert ee-alert--bad">
          <Icon name="lock" small /> Deine Slots sind für neue Leads pausiert, bis alle Rückmeldungen erledigt sind.
        </div>
      )}
      <CloserMoneyHero />
      <div className="ee-grid g-2" style={{ alignItems: "start" }}>
        <section className="ee-card" data-component="CloserTasks">
          <div className="ee-card__head">
            <h2>Zu erledigen</h2>
            {todo.length ? <span className={todo.some((t) => t.tone === "bad") ? "ee-count is-bad" : "ee-count"}>{todo.length}</span> : null}
          </div>
          {todo.length ? (
            <>
              <div className="ee-todo">
                {todo.map((t, i) => (
                  <button key={i} className={`ee-todo__row is-${t.tone}`} onClick={t.onClick}>
                    <div className="ee-list__main">
                      <div className="ee-list__title">{t.title}</div>
                      <div className="ee-list__sub">{t.sub}</div>
                    </div>
                    <span className="ee-todo__right">{t.right}</span>
                    <Icon name="right" small />
                  </button>
                ))}
              </div>
              {due.length ? (
                <p className="ee-rule">
                  <Icon name="lock" small /> Ohne Rückmeldung nach 24 Std. keine neuen Leads
                </p>
              ) : null}
            </>
          ) : (
            <div className="ee-alert ee-alert--ok">
              <Icon name="check" small /> Alles erledigt
            </div>
          )}
        </section>
        <section className="ee-card" data-component="CloserWeek">
          <div className="ee-card__head">
            <h2>Diese Woche</h2>
            <button className="ee-btn ee-btn--ghost ee-btn--sm" onClick={() => go("termine")}>
              Alle <Icon name="right" small />
            </button>
          </div>
          {week.length ? (
            <div className="ee-agenda">
              {week.map((a) => {
                const d = parseKey(a.date);
                return (
                  <button key={a.id} className="ee-agenda__row" onClick={() => go("termine")}>
                    <span className="ee-agenda__day">
                      <small>{WD[d.getDay()]}</small>
                      <b>{d.getDate()}</b>
                    </span>
                    <span className="ee-agenda__time num">{fmtHour(a.start)}</span>
                    <div className="ee-list__main">
                      <div className="ee-list__title">{lead(a.lead).kunde}</div>
                      <div className="ee-list__sub">
                        {kindLabel(a)} · {a.ort}
                      </div>
                    </div>
                    <RelWhen appt={a} now={now} />
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="ee-empty">Keine Termine mehr diese Woche</div>
          )}
        </section>
      </div>
    </>
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

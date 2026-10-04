"use client";

import type { ReactNode } from "react";
import AdminOverview from "@/components/overview/AdminOverview";
import { CallbackAlerts } from "@/components/presetter/CallTools";
import { leadsTodayOf, MonthCard, QuoteCard, RankCard, TodayHero, TodoCard, useTodos, WeekStrip, type QuoteRow } from "@/components/overview/Cards";
import Icon from "@/components/ui/Icon";
import { PageHead } from "@/components/ui/Kpi";
import { apptEnd, closerPaused } from "@/lib/appointments";
import { fmtDay, fmtHour } from "@/lib/format";
import { apptStart, callbackLate, isCalling, isOverdue, leadsForUser, urgencySort } from "@/lib/leads";
import { useDashboard } from "@/lib/useDashboard";

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
  const next = data.APPTS.filter((a) => a.closer === me && !a.reserved && apptEnd(a) > now).sort((a, b) => apptStart(a).getTime() - apptStart(b).getTime())[0];
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

export default function OverviewView() {
  const { role } = useDashboard();
  if (role === "setter") return <SetterOverview />;
  if (role === "presetter") return <PresetterOverview />;
  if (role === "closer") return <CloserOverview />;
  return <AdminOverview />;
}

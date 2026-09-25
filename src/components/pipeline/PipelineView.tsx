"use client";

import { useSyncExternalStore } from "react";
import Icon from "@/components/ui/Icon";
import { PipelineSteps, StatusChip } from "@/components/ui/Chips";
import LeadCard from "@/components/pipeline/LeadCard";
import { PIPELINE, STATUS } from "@/lib/domain";
import { activeLeads, isLost, leadsForUser, provFor, stageOf } from "@/lib/leads";
import { currentUser, updateUi, useStore, type LeadFilter } from "@/lib/store";
import type { Lead, Person, PersonKey, StatusKey } from "@/lib/types";

/* Unter 900 px zeigt das Board nur eine Spalte (wie im Prototyp). */
const MOBILE = "(max-width: 900px)";
function useMobile() {
  return useSyncExternalStore(
    (cb) => {
      const m = matchMedia(MOBILE);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => matchMedia(MOBILE).matches,
    () => false,
  );
}

const clickableRow = (open: () => void) => ({
  className: "is-click",
  tabIndex: 0,
  onClick: open,
  onKeyDown: (e: React.KeyboardEvent) => {
    if (e.key === "Enter") open();
  },
});

/* ---------- PipelineBar: die 5 Stufen als Pfeilleiste mit Anzahl (klickbar) ---------- */
function PipelineBar({ leads, filter }: { leads: Lead[]; filter: LeadFilter }) {
  const act = activeLeads(leads);
  const lost = leads.filter(isLost).length;
  const set = (f: LeadFilter) => () => updateUi({ leadFilter: f });
  return (
    <div className="ee-pbar" role="tablist" aria-label="Pipeline-Stufen" data-component="PipelineBar">
      <button className="ee-pbar__all" aria-pressed={filter === "alle"} onClick={set("alle")}>
        <b className="num">{act.length}</b>
        <span>Alle aktiven</span>
      </button>
      <div className="ee-pbar__stages">
        {PIPELINE.map((k) => (
          <button key={k} className={`ee-pbar__stage is-${k}`} aria-pressed={filter === k} onClick={set(k as LeadFilter)}>
            <b className="num">{act.filter((l) => l.status === k).length}</b>
            <span>{STATUS[k].label}</span>
          </button>
        ))}
      </div>
      <button className="ee-pbar__lost" aria-pressed={filter === "verloren"} onClick={set("verloren")}>
        <b className="num">{lost}</b>
        <span>Verloren</span>
      </button>
    </div>
  );
}

interface Ctx {
  onOpen: (id: string) => void;
  person: (k: string) => Person;
}

/* ---------- LeadTable (Listenansicht) ---------- */
function LeadTable({ leads, showSetter, ...ctx }: { leads: Lead[]; showSetter: boolean } & Ctx) {
  const role = useStore().ui.role;
  if (!leads.length) return <div className="ee-empty">Keine Leads für diesen Filter.</div>;
  const showProv = role !== "admin";
  return (
    <div className="ee-table-wrap">
      <table className="ee-table ee-table--stack" data-component="LeadTable">
        <thead>
          <tr>
            <th>Kunde</th>
            <th>Status</th>
            <th>Pipeline</th>
            {showSetter && <th>Setter</th>}
            {showProv && <th>Deine Provision</th>}
            <th>Eingereicht</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((l) => {
            const p = provFor(l, role);
            return (
              <tr key={l.id} {...clickableRow(() => ctx.onOpen(l.id))}>
                <td>
                  <div className="who">{l.kunde}</div>
                  <div className="sub">{l.ort}</div>
                </td>
                <td className="r-sm">
                  <StatusChip status={l.status} />
                  {l.reason && (
                    <div className="sub" style={{ marginTop: 3 }}>
                      {l.reason}
                    </div>
                  )}
                </td>
                <td data-hide-sm="">
                  <PipelineSteps status={l.status} />
                </td>
                {showSetter && <td data-hide-sm="">{ctx.person(l.setter).first}</td>}
                {showProv && (
                  <td>
                    <span className={p.amount ? "ee-prov" : "ee-prov is-muted"}>{p.txt}</span>
                  </td>
                )}
                <td className="sub num">{l.datum.slice(0, 6)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- LostOverview: verlorene Leads gesammelt statt in der Hauptliste ---------- */
function LostOverview({ leads, showSetter, ...ctx }: { leads: Lead[]; showSetter: boolean } & Ctx) {
  if (!leads.length) return <div className="ee-empty">Keine verlorenen Leads.</div>;
  const counts: Record<string, number> = {};
  leads.forEach((l) => {
    const k = l.reason || "Ohne Grund";
    counts[k] = (counts[k] || 0) + 1;
  });
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  return (
    <div data-component="LostOverview">
      <div className="ee-lost__sum">
        <div>
          <div className="ee-kpi__value">{leads.length}</div>
          <div className="faint" style={{ fontSize: ".8rem" }}>
            verlorene Leads
          </div>
        </div>
        <div className="row">
          {top.map(([k, n]) => (
            <span key={k} className="ee-tag">
              {k} · {n}
            </span>
          ))}
        </div>
      </div>
      <div className="ee-table-wrap">
        <table className="ee-table ee-table--stack">
          <thead>
            <tr>
              <th>Kunde</th>
              <th>Verloren in</th>
              <th>Grund</th>
              {showSetter && <th>Setter</th>}
              <th>Datum</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => (
              <tr key={l.id} {...clickableRow(() => ctx.onOpen(l.id))}>
                <td>
                  <div className="who">{l.kunde}</div>
                  <div className="sub">{l.ort}</div>
                </td>
                <td>
                  <StatusChip status={l.status} />
                  {STATUS[l.status].phase && (
                    <div className="sub" style={{ marginTop: 3 }}>
                      {STATUS[l.status].phase}
                    </div>
                  )}
                </td>
                <td data-span="">
                  <b style={{ fontWeight: 600 }}>{l.reason || "Ohne Grund"}</b>
                  {l.reasonNote && <div className="sub">{l.reasonNote}</div>}
                </td>
                {showSetter && <td data-hide-sm="">{ctx.person(l.setter).first}</td>}
                <td className="sub num">{l.hist[0][1].split(" ")[0]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------- PipelineView ---------- */
export default function PipelineView() {
  const store = useStore();
  const mobile = useMobile();
  const { ui, data } = store;
  const { role, leadFilter: filter, leadSearch, leadSetter, leadView: view } = ui;
  const admin = role === "admin";
  const person = (k: string): Person =>
    data.PEOPLE[k] || { key: k, name: k, first: k, role: "setter", initials: "?" };
  const ctx: Ctx = { onOpen: (id) => store.legacy?.openLead(id), person };

  const mine = leadsForUser(data.LEADS, role, currentUser());
  const setters = [...new Set(data.LEADS.map((l) => l.setter))] as PersonKey[];

  /* Setter- und Suchfilter; Stufenfilter nur in Liste/Verloren (das Board zeigt alle Stufen) */
  const bySearch = (leads: Lead[]) => {
    let r = leads;
    if (leadSetter !== "alle") r = r.filter((l) => l.setter === leadSetter);
    if (leadSearch) {
      const q = leadSearch.toLowerCase();
      r = r.filter((l) => (l.kunde + l.ort + l.id).toLowerCase().includes(q));
    }
    return r;
  };
  const byStage = (leads: Lead[]) => (filter === "alle" ? activeLeads(leads) : leads.filter((l) => stageOf(l) === filter));

  let body: React.ReactNode;
  if (filter === "verloren") {
    body = <LostOverview leads={bySearch(byStage(mine))} showSetter={role !== "setter"} {...ctx} />;
  } else if (view === "board") {
    const act = activeLeads(bySearch(mine));
    const cols: StatusKey[] = mobile
      ? [filter !== "alle" ? (filter as StatusKey) : PIPELINE.find((k) => act.some((l) => l.status === k)) || "eingereicht"]
      : PIPELINE;
    body = (
      <div className="ee-board2" data-component="PipelineBoard">
        {cols.map((k) => {
          const ls = act.filter((l) => l.status === k);
          return (
            <section key={k} className={`ee-bcol is-${k} ${filter === k ? "is-active" : ""}`}>
              <header>
                <span>{STATUS[k].label}</span>
                <b className="num">{ls.length}</b>
              </header>
              <div className="ee-bcol__cards">
                {ls.length ? (
                  ls.map((l) => (
                    <LeadCard key={l.id} lead={l} now={data.NOW} role={role} appts={data.APPTS} {...ctx} />
                  ))
                ) : (
                  <div className="ee-bcol__empty">–</div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    );
  } else {
    body = <LeadTable leads={bySearch(byStage(mine))} showSetter={role !== "setter"} {...ctx} />;
  }

  return (
    <>
      <div className="ee-pagehead">
        <h1>{admin ? "Pipeline · alle Leads" : role === "setter" ? "Meine Pipeline" : "Pipeline"}</h1>
        <div className="row">
          <div className="ee-seg" role="group" aria-label="Ansicht">
            <button aria-pressed={view === "board"} onClick={() => updateUi({ leadView: "board" })}>
              <Icon name="cal" small /> Board
            </button>
            <button aria-pressed={view === "list"} onClick={() => updateUi({ leadView: "list" })}>
              <Icon name="list" small /> Liste
            </button>
          </div>
        </div>
      </div>
      <PipelineBar leads={mine} filter={filter} />
      <div className="row ee-leadtools">
        {admin && (
          <>
            <label className="sr" htmlFor="leadSetter">
              Setter
            </label>
            <select
              className="ee-select"
              id="leadSetter"
              style={{ width: "auto", minHeight: 40 }}
              value={leadSetter}
              onChange={(e) => updateUi({ leadSetter: e.target.value })}
            >
              <option value="alle">Alle Setter</option>
              {setters.map((k) => (
                <option key={k} value={k}>
                  {person(k).first}
                </option>
              ))}
            </select>
          </>
        )}
        <label className="sr" htmlFor="leadSearch">
          Suche
        </label>
        <input
          className="ee-input"
          id="leadSearch"
          placeholder="Kunde oder Ort suchen"
          value={leadSearch}
          style={{ maxWidth: 280, minHeight: 40 }}
          onChange={(e) => updateUi({ leadSearch: e.target.value })}
        />
      </div>
      <div className={view === "list" || filter === "verloren" ? "ee-card ee-card--flush" : undefined}>{body}</div>
    </>
  );
}

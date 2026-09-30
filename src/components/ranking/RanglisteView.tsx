"use client";

import { useState } from "react";
import Icon from "@/components/ui/Icon";
import { PageHead } from "@/components/ui/Kpi";
import { publishBoard } from "@/lib/actions";
import { ranked } from "@/lib/ranking";
import { LIVE } from "@/lib/store";
import { useDashboard } from "@/lib/useDashboard";
import type { Board, PersonKey } from "@/lib/types";

type BoardKey = "cup" | "setter";

function Leaderboard({ B }: { B: Board }) {
  const { me, person } = useDashboard();
  const R = ranked(B.rows),
    top = R.length ? R[0].val : 0;
  const max = B.marks.length ? Math.max(11, top + 1) : Math.max(5, top + 2);
  const labels = B.marks.length ? [0, ...B.marks] : [0, top];
  const total = B.rows.reduce((s, r) => s + r[1], 0);
  return (
    <>
      {B.goal ? (
        <section className="ee-card ee-card--forest" data-component="TeamGoal">
          <div className="row row--between">
            <div>
              <span className="eyebrow">Teamziel</span>
              <h2 style={{ color: "#fff", marginTop: 4 }}>{B.title}</h2>
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="ee-kpi__value" style={{ color: "var(--accent-bright)" }}>
                {total}
                <small style={{ color: "rgba(255,255,255,.7)" }}>/ {B.goal}</small>
              </div>
              <div className="muted" style={{ fontSize: ".8rem" }}>
                {B.unit} · Ende {B.ends}
              </div>
            </div>
          </div>
          <div className="ee-goal__bar" role="progressbar" aria-valuenow={total} aria-valuemax={B.goal} aria-label="Teamziel">
            <i style={{ width: `${Math.min(100, (total / B.goal) * 100)}%` }} />
          </div>
          <p className="muted" style={{ fontSize: ".84rem" }}>
            Noch {Math.max(0, B.goal - total)} {B.unit} bis zum Teamziel · {B.published ? `veröffentlicht ${B.published} von ${B.by}` : "Entwurf – noch nicht veröffentlicht"}
          </p>
        </section>
      ) : (
        <section className="ee-card ee-card--forest">
          <span className="eyebrow">Nur Setter · {B.unit}</span>
          <h2 style={{ color: "#fff" }}>{B.title}</h2>
          <p className="muted" style={{ fontSize: ".84rem" }}>
            Team: {total} · {B.published ? `veröffentlicht ${B.published} von ${B.by}` : "noch nicht veröffentlicht"}
          </p>
        </section>
      )}
      {B.prizes.length ? (
        <div className="ee-prizes" data-component="PrizeStrip">
          {B.prizes.map(([a, b]) => (
            <div key={a} className="ee-prize">
              <span>{a}</span>
              <b>{b}</b>
            </div>
          ))}
        </div>
      ) : null}
      <section className="ee-card" data-component="Leaderboard">
        <div className="ee-card__head">
          <h2>Rangliste</h2>
          <span className="muted">{B.unit} je MB</span>
        </div>
        <div className="ee-board">
          <div className="ee-board__scale" aria-hidden="true">
            <span />
            <span />
            <div>
              {labels.map((v, i) => (
                <span key={i} style={{ left: `${(v / max) * 100}%` }}>
                  {v}
                </span>
              ))}
            </div>
            <span />
          </div>
          {R.map((r) => (
            <div key={r.key} className={r.key === me ? "ee-board__row is-me" : "ee-board__row"}>
              <div className="ee-board__rank">{r.rank}</div>
              <div className="ee-board__name">
                <span>{person(r.key).first}</span>
                {r.key === me && <span className="ee-tag">Du</span>}
                {B.marks.length && r.val >= 5 ? (
                  <span className="ee-medal" title="Prämienstufe erreicht">
                    {r.val >= 10 ? "500 €" : "200 €"}
                  </span>
                ) : null}
              </div>
              <div className="ee-board__track">
                <div className="ee-board__fill" style={{ width: `${(r.val / max) * 100}%` }} />
                {B.marks.map((m) => (
                  <i key={m} className="ee-board__mark" style={{ left: `${(m / max) * 100}%` }} />
                ))}
              </div>
              <div className="ee-board__val">{r.val}</div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function Archive() {
  const { data } = useDashboard();
  return (
    <section className="ee-card">
      <h2>Frühere Wettbewerbe</h2>
      <div className="ee-list">
        {data.BOARD_ARCHIVE.map((a) => (
          <div key={a.title} className="ee-list__row">
            <div className="ee-list__main">
              <div className="ee-list__title">{a.title}</div>
              <div className="ee-list__sub">
                Sieger: {a.winner} · Team: {a.total}
              </div>
            </div>
            <span className="faint" style={{ fontSize: ".8rem" }}>
              {a.date}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

/* Admin: Stand bearbeiten und veröffentlichen. key={boardKey} sorgt für frische Werte beim Tab-Wechsel. */
function BoardEditor({ B, boardKey }: { B: Board; boardKey: BoardKey }) {
  const { person, toast } = useDashboard();
  const R = ranked(B.rows);
  const [title, setTitle] = useState(B.title);
  const [goal, setGoal] = useState(String(B.goal ?? ""));
  const [ends, setEnds] = useState(B.ends);
  const [vals, setVals] = useState<Record<PersonKey, string>>(Object.fromEntries(R.map((r) => [r.key, String(r.val)])));
  const [wa, setWa] = useState(true);
  return (
    <section className="ee-card" data-component="BoardEditor">
      <h2>Stand bearbeiten</h2>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          /* Prototyp: je Rangliste die passende Beispielperson benachrichtigen */
          publishBoard(B, { title, goal: +goal || undefined, ends, rows: R.map((r) => [r.key, +vals[r.key] || 0]) }, boardKey === "setter" ? ["romy"] : ["leo"]);
          toast("Rangliste veröffentlicht", "trophy");
        }}
      >
        <div className="ee-field">
          <label htmlFor="bTitle">Titel</label>
          <input className="ee-input" id="bTitle" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="ee-grid g-2" style={{ gap: 10 }}>
          {B.goal ? (
            <div className="ee-field">
              <label htmlFor="bGoal">Teamziel</label>
              <input className="ee-input" type="number" id="bGoal" min={1} value={goal} onChange={(e) => setGoal(e.target.value)} />
            </div>
          ) : null}
          <div className="ee-field">
            <label htmlFor="bEnds">Ende</label>
            <input className="ee-input" id="bEnds" value={ends} onChange={(e) => setEnds(e.target.value)} />
          </div>
        </div>
        <div className="stack" style={{ gap: 6 }}>
          {R.map((r) => (
            <div key={r.key} className="row" style={{ gap: 10, flexWrap: "nowrap" }}>
              <label htmlFor={`b-${r.key}`} style={{ flex: 1, fontWeight: 600 }}>
                {person(r.key).name}
              </label>
              <input
                className="ee-input num"
                type="number"
                min={0}
                id={`b-${r.key}`}
                value={vals[r.key]}
                onChange={(e) => setVals({ ...vals, [r.key]: e.target.value })}
                style={{ width: 90 }}
              />
            </div>
          ))}
        </div>
        <label className="ee-check">
          <input type="checkbox" id="bWa" checked={wa} onChange={(e) => setWa(e.target.checked)} />
          <span>In der WhatsApp-Gruppe posten (über n8n)</span>
        </label>
        <button className="ee-btn ee-btn--accent" type="submit">
          <Icon name="trophy" small /> Rangliste veröffentlichen
        </button>
      </form>
    </section>
  );
}

export default function RanglisteView() {
  const { data, role } = useDashboard();
  const [tab, setTab] = useState<BoardKey>("cup");
  /* Setter sehen nur die Setter-Rangliste, Closer nur den Wärmepumpen-Cup, Admin beide */
  const boardKey: BoardKey = role === "setter" ? "setter" : role === "closer" ? "cup" : tab;
  const B = boardKey === "setter" ? data.SETTER_BOARD : data.BOARD;
  if (role !== "admin")
    return (
      <>
        <PageHead title={boardKey === "setter" ? "Setter-Rangliste" : "Wärmepumpen-Cup"} />
        <div className="ee-grid g-main" style={{ alignItems: "start" }}>
          <div className="stack" style={{ gap: 18 }}>
            <Leaderboard B={B} />
          </div>
          <div className="stack">{role === "closer" ? <Archive /> : null}</div>
        </div>
      </>
    );
  return (
    <>
      <PageHead title="Ranglisten posten" />
      <div className="ee-tabs" role="tablist" data-component="BoardTabs">
        {(
          [
            ["cup", "Wärmepumpen-Cup"],
            ["setter", "Setter-Rangliste"],
          ] as [BoardKey, string][]
        ).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={boardKey === k} onClick={() => setTab(k)}>
            {l}
          </button>
        ))}
      </div>
      <div className="ee-grid g-main" style={{ alignItems: "start" }}>
        <div className="stack" style={{ gap: 18 }}>
          <Leaderboard B={B} />
        </div>
        <div className="stack">
          {LIVE && boardKey === "setter" ? (
            <section className="ee-card">
              <h2>Automatisch aus Pipedrive</h2>
              <p className="muted" style={{ marginTop: 6 }}>
                Die Setter-Rangliste zählt laufend die gelegten Termine im aktuellen Monat – hier gibt es nichts einzutragen.
              </p>
            </section>
          ) : (
            <BoardEditor key={`${boardKey}-${B.published}`} B={B} boardKey={boardKey} />
          )}
          <Archive />
        </div>
      </div>
    </>
  );
}

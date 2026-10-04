"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import {
  answerModuleAction,
  grantRetryAction,
  loadAcademyAction,
  requestRetryAction,
  resetRoleAction,
  setLockAction,
  setVideoAction,
  submitTestAction,
  unlockRoleAction,
} from "@/app/actions/academy";
import Icon from "@/components/ui/Icon";
import { ToneChip } from "@/components/ui/Chips";
import { Kpi, PageHead } from "@/components/ui/Kpi";
import { canTakeTest, pathDone, youtubeEmbed, type AcademyData, type RoleState } from "@/lib/academy";
import { MODULES, PASS_RATIO, passMark, pathFor, TESTS, type AcademyModule, type Block, type MaRole, MA_ROLES_ALL } from "@/lib/academy-content";
import { ROLE_LABEL } from "@/lib/nav";
import { useDashboard } from "@/lib/useDashboard";

/* Akademie: Lernpfad je Rolle, Wissenscheck je Modul, Rollentest. Nach bestandenem Test (≥ 80 %) ist die Ansicht
   der Rolle freigeschaltet. Richtig/falsch entscheidet immer der Server – die Lösungen stehen nicht im Browser. */

/** **fett** im Text auszeichnen */
function Fmt({ s }: { s: string }) {
  return (
    <>
      {s.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 ? <b key={i}>{part}</b> : <Fragment key={i}>{part}</Fragment>))}
    </>
  );
}

function BlockView({ b }: { b: Block }) {
  if ("h" in b) return <h3><Fmt s={b.h} /></h3>;
  if ("p" in b) return <p><Fmt s={b.p} /></p>;
  if ("ul" in b)
    return (
      <ul className="ee-aka-ul">
        {b.ul.map((x, i) => (
          <li key={i}><Fmt s={x} /></li>
        ))}
      </ul>
    );
  if ("steps" in b)
    return (
      <ol className="ee-aka-steps">
        {b.steps.map((x, i) => (
          <li key={i}><span><Fmt s={x} /></span></li>
        ))}
      </ol>
    );
  if ("tip" in b)
    return (
      <div className="ee-aka-call is-tip">
        <Icon name="bolt" small />
        <p><Fmt s={b.tip} /></p>
      </div>
    );
  if ("todo" in b)
    return (
      <div className="ee-aka-call is-todo">
        <Icon name="edit" small />
        <p><b>Platzhalter:</b> <Fmt s={b.todo} /></p>
      </div>
    );
  return (
    <div className="ee-aka-cols">
      {b.cols.map((c) => (
        <div key={c.title} className={`ee-aka-col is-${c.tone}`}>
          <h3>{c.title}</h3>
          <ul className="ee-aka-ul">
            {c.items.map((x, i) => (
              <li key={i}><Fmt s={x} /></li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** Video: YouTube wird erst nach Klick geladen (Datenschutz – vorher wird nichts an YouTube übertragen) */
function Video({ m, url, admin }: { m: AcademyModule; url?: string; admin: boolean }) {
  const [on, setOn] = useState(false);
  const src = youtubeEmbed(url);
  if (!src)
    return (
      <div className="ee-aka-video is-empty" data-component="VideoSlot">
        <span className="ee-aka-video__play"><Icon name="play" /></span>
        <b>{m.video.title}</b>
        <span>{admin ? "Video folgt – Link unter „Module & Inhalte“ eintragen" : "Video folgt"}</span>
      </div>
    );
  if (!on)
    return (
      <div className="ee-aka-video is-consent" data-component="VideoSlot">
        <span className="ee-aka-video__play"><Icon name="play" /></span>
        <b>{m.video.title}</b>
        <button className="ee-btn" onClick={() => setOn(true)}>Video laden</button>
        <small>Beim Laden wird eine Verbindung zu YouTube (Google) hergestellt. Vorher werden keine Daten übertragen.</small>
      </div>
    );
  return (
    <div className="ee-aka-video" data-component="VideoSlot">
      <iframe src={src} title={m.video.title} allow="accelerometer; encrypted-media; picture-in-picture" allowFullScreen loading="lazy" referrerPolicy="strict-origin-when-cross-origin" />
    </div>
  );
}

export default function AkademieView() {
  const { role } = useDashboard();
  const [data, setData] = useState<AcademyData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await loadAcademyAction();
    if (res.ok) setData(res.data);
    else setError(res.error);
  }, []);
  useEffect(() => {
    let alive = true;
    void loadAcademyAction().then((res) => {
      if (!alive) return;
      if (res.ok) setData(res.data);
      else setError(res.error);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (error) return <div className="ee-alert ee-alert--bad">{error}</div>;
  if (!data) return <PageHead title="Akademie" />;
  return role === "admin" ? <AdminAcademy data={data} reload={load} /> : <MyAcademy key={role} role={role as MaRole} data={data} reload={load} setData={setData} />;
}

/* ---------------------------------------------------------------------------------------------- */
/* Lernende                                                                                        */
/* ---------------------------------------------------------------------------------------------- */

function MyAcademy({ role, data, reload, setData }: { role: MaRole; data: AcademyData; reload: () => Promise<void>; setData: (d: AcademyData) => void }) {
  const { toast } = useDashboard();
  const [mod, setMod] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const done = useMemo(() => new Set(data.done), [data.done]);
  const st = data.roles.find((r) => r.role === role) ?? null;
  /* Admins, die „als Rolle“ hineinschauen, haben keine eigene Rolle: Vorschau ohne Speichern */
  const preview = !st;
  const state: RoleState = st ?? { role, status: "offen", via: null, score: null, total: null, tries: 0, retry: false, date: null };
  const locked = data.lockOn && state.status !== "bestanden" && !preview;
  const path = pathFor(role);
  const open = (id: string) => preview || path.slice(0, path.findIndex((m) => m.id === id)).every((m) => done.has(m.id));

  if (testing && st) return <TestView role={role} state={state} onClose={() => setTesting(false)} reload={reload} />;
  const m = mod ? path.find((x) => x.id === mod) : null;
  if (m && open(m.id))
    return (
      <ModuleView
        key={m.id}
        m={m}
        role={role}
        done={done}
        preview={preview}
        videoUrl={data.videos[m.id]}
        onBack={() => setMod(null)}
        onOpen={(id) => setMod(id)}
        onDone={(id, testOpen) => {
          setData({ ...data, done: [...data.done, id] });
          toast("Modul erledigt");
          if (testOpen) toast(`${ROLE_LABEL[role]}-Test ist jetzt freigeschaltet`, "bolt");
        }}
      />
    );

  const groups = [...new Set(path.map((x) => x.group))];
  const next = path.find((x) => !done.has(x.id));
  const nDone = path.filter((x) => done.has(x.id)).length;
  return (
    <>
      <PageHead
        title="Akademie"
        actions={
          next && !preview ? (
            <button className="ee-btn ee-btn--primary" onClick={() => setMod(next.id)}>
              <Icon name="play" small /> Weiter: {next.title}
            </button>
          ) : null
        }
      />
      <p className="muted" style={{ marginTop: -12, maxWidth: "68ch" }}>
        Alles, was du für deine Rolle wissen musst – Technik und Verkauf. Jedes Modul endet mit einem kurzen Wissenscheck, am Ende steht der {ROLE_LABEL[role]}-Test.
      </p>
      {preview && (
        <div className="ee-demo-strip">
          <Icon name="info" small />
          <span>Vorschau als Admin: Du siehst die Inhalte der {ROLE_LABEL[role]}-Rolle. Wissenschecks und Tests sind hier nicht möglich, es wird nichts gespeichert.</span>
        </div>
      )}
      {!data.lockOn && !preview && (
        <div className="ee-demo-strip">
          <Icon name="info" small />
          <span>Die Freischaltung per Test ist gerade ausgeschaltet. Alle Ansichten sind offen, die Akademie ist freiwillig.</span>
        </div>
      )}
      {locked && (
        <div className="ee-aka-lock" data-component="LockBanner">
          <Icon name="lock" />
          <div>
            <b>Deine {ROLE_LABEL[role]}-Ansicht ist noch gesperrt.</b>
            <span>
              Schließe die Module unten ab und bestehe den {ROLE_LABEL[role]}-Test mit mindestens {Math.round(PASS_RATIO * 100)} %. Danach schaltet sich alles automatisch frei.
            </span>
          </div>
        </div>
      )}
      {!preview && <UnlockCard role={role} state={state} nDone={nDone} total={path.length} canTest={canTakeTest(state, done)} onTest={() => setTesting(true)} reload={reload} />}
      {groups.map((g) => (
        <section className="stack" data-component="ModuleList" key={g}>
          <h2>{g}</h2>
          <div className="ee-aka-mods">
            {path
              .filter((x) => x.group === g)
              .map((x) => (
                <ModuleCard key={x.id} m={x} n={path.indexOf(x) + 1} done={done.has(x.id)} open={open(x.id)} hasVideo={!!youtubeEmbed(data.videos[x.id])} onOpen={() => (open(x.id) ? setMod(x.id) : toast("Erst das vorherige Modul abschließen", "lock"))} />
              ))}
          </div>
        </section>
      ))}
    </>
  );
}

function ModuleCard({ m, n, done, open, hasVideo, onOpen }: { m: AcademyModule; n: number; done: boolean; open: boolean; hasVideo: boolean; onOpen: () => void }) {
  const todo = m.body.some((b) => "todo" in b);
  return (
    <button className={`ee-aka-mod ${done ? "is-done" : ""} ${open ? "" : "is-locked"}`} onClick={onOpen} data-component="ModuleCard" aria-disabled={open ? undefined : true}>
      <span className="ee-aka-mod__n">{done ? <Icon name="check" small /> : open ? n : <Icon name="lock" small />}</span>
      <span className="ee-aka-mod__main">
        <b>{m.title}</b>
        <span className="ee-aka-mod__meta">
          {m.min} Min. · {hasVideo ? "Video" : "Video folgt"} · Wissenscheck{todo && <> · <i>Inhalte teils Platzhalter</i></>}
        </span>
      </span>
      <span className="ee-aka-mod__st">{done ? <ToneChip label="Erledigt" tone="ok" /> : open ? <ToneChip label="Offen" tone="info" /> : <ToneChip label="Gesperrt" />}</span>
    </button>
  );
}

function UnlockCard({ role, state, nDone, total, canTest, onTest, reload }: { role: MaRole; state: RoleState; nDone: number; total: number; canTest: boolean; onTest: () => void; reload: () => Promise<void> }) {
  const { toast } = useDashboard();
  const pct = Math.round((nDone / total) * 100);
  const chip =
    state.status === "bestanden" ? (
      <ToneChip label={state.via === "test" ? `Bestanden · ${state.score}/${state.total}` : "Freigeschaltet"} tone="ok" />
    ) : state.status === "nicht_bestanden" ? (
      <ToneChip label={`Nicht bestanden · ${state.score}/${state.total}`} tone="bad" />
    ) : (
      <ToneChip label="Test offen" tone="warn" />
    );
  let action: React.ReactNode;
  if (state.status === "bestanden")
    action = (
      <span className="ee-fb-done">
        <Icon name="check" small /> {ROLE_LABEL[role]}-Ansicht freigeschaltet{state.date ? ` am ${state.date}` : ""}
        {state.via === "bestand" ? " (bestehender MB)" : state.via === "admin" ? " (vom Admin)" : ""}
      </span>
    );
  else if (canTest)
    action = (
      <button className="ee-btn ee-btn--accent" onClick={onTest}>
        <Icon name="check" small /> {state.status === "nicht_bestanden" ? "Test wiederholen" : `${ROLE_LABEL[role]}-Test starten`}
      </button>
    );
  else if (state.status === "nicht_bestanden")
    action = (
      <>
        <span className="muted">
          <Icon name="lock" small /> Wiederholung muss vom Admin freigegeben werden.
        </span>{" "}
        <button
          className="ee-btn ee-btn--sm"
          onClick={async () => {
            const res = await requestRetryAction(role);
            toast(res.ok ? "Anfrage an den Admin gesendet" : res.error, res.ok ? "send" : "info");
            if (res.ok) await reload();
          }}
        >
          Freigabe anfragen
        </button>
      </>
    );
  else
    action = (
      <span className="muted">
        <Icon name="lock" small /> Test wird frei, wenn alle {total} Module erledigt sind.
      </span>
    );
  return (
    <section className="ee-card ee-card--forest ee-hero ee-aka-unlock" data-component="AcademyUnlockCard">
      <div className="row row--between">
        <span className="eyebrow">Freischaltung {ROLE_LABEL[role]}</span>
        {chip}
      </div>
      <div className="ee-aka-unlock__num">
        <b className="num">
          {nDone}/{total}
        </b>
        <span>Module erledigt</span>
      </div>
      <div className="ee-goal__bar">
        <i style={{ width: `${pct}%` }} />
      </div>
      <div className="row">{action}</div>
    </section>
  );
}

function ModuleView({
  m,
  role,
  done,
  preview,
  videoUrl,
  onBack,
  onOpen,
  onDone,
}: {
  m: AcademyModule;
  role: MaRole;
  done: ReadonlySet<string>;
  preview: boolean;
  videoUrl?: string;
  onBack: () => void;
  onOpen: (id: string) => void;
  onDone: (id: string, testOpen: boolean) => void;
}) {
  const { toast } = useDashboard();
  const path = pathFor(role);
  const i = path.indexOf(m);
  const nxt = path[i + 1];
  const isDone = done.has(m.id);
  const [pick, setPick] = useState<number | null>(null);
  const [res, setRes] = useState<{ correct: boolean; why: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, []);

  async function submit() {
    if (pick == null) return;
    setBusy(true);
    const r = await answerModuleAction(m.id, pick);
    setBusy(false);
    if (!r.ok) return void toast(r.error, "info");
    setRes({ correct: r.data.correct, why: r.data.why });
    if (r.data.correct) onDone(m.id, r.data.testsOpen.includes(role));
  }

  const ok = isDone || res?.correct === true;
  return (
    <>
      <div className="row">
        <button className="ee-btn ee-btn--ghost ee-btn--sm" onClick={onBack}>
          <Icon name="left" small /> Alle Module
        </button>
        <span className="faint">
          Modul {i + 1} von {path.length} · {m.group}
        </span>
      </div>
      <article className="ee-card ee-aka-page" data-component="ModulePage">
        <div>
          <span className="eyebrow">
            {m.group} · {m.min} Min.
          </span>
          <h1 style={{ marginTop: 6 }}>{m.title}</h1>
        </div>
        <Video m={m} url={videoUrl} admin={preview} />
        <div className="ee-aka-body">
          {m.body.map((b, k) => (
            <BlockView key={k} b={b} />
          ))}
        </div>
        {m.articles.length ? (
          <div>
            <h3>Zum Weiterlesen</h3>
            {m.articles.map((a) => (
              <a key={a.url} className="ee-list__row" href={a.url} target="_blank" rel="noopener noreferrer">
                <Icon name="ext" small />
                <span>{a.t}</span>
              </a>
            ))}
          </div>
        ) : (
          <div className="ee-aka-call is-todo">
            <Icon name="doc" small />
            <p>
              <b>Zum Weiterlesen:</b> Presseartikel und Quellen werden ergänzt.
            </p>
          </div>
        )}
      </article>
      <section className={`ee-card ee-aka-check ${ok ? "is-ok" : res?.correct === false ? "is-bad" : ""}`} data-component="KnowledgeCheck">
        <div className="row row--between">
          <h2>Wissenscheck</h2>
          {isDone ? <ToneChip label="Erledigt" tone="ok" /> : null}
        </div>
        <fieldset className="ee-opts">
          <legend className="sr">{m.check.q}</legend>
          <p style={{ fontWeight: 650 }}>{m.check.q}</p>
          {m.check.o.map((o, j) => (
            <label className="ee-opt" key={j}>
              <input type="radio" name="aka-check" checked={pick === j} disabled={isDone || preview} onChange={() => { setPick(j); setRes(null); }} />
              <span>{o}</span>
            </label>
          ))}
        </fieldset>
        {preview && <div className="ee-alert">Vorschau: Der Wissenscheck ist nur für Mitarbeitende mit dieser Rolle.</div>}
        {res?.correct === false && (
          <div className="ee-alert ee-alert--bad">
            <Icon name="info" small /> Nicht ganz. {res.why} Versuch es noch einmal.
          </div>
        )}
        {res?.correct === true && (
          <div className="ee-alert ee-alert--ok">
            <Icon name="check" small /> Richtig. {res.why}
          </div>
        )}
        <div className="row">
          {ok ? (
            nxt ? (
              <button className="ee-btn ee-btn--primary" onClick={() => onOpen(nxt.id)}>
                Weiter: {nxt.title} <Icon name="right" small />
              </button>
            ) : (
              <button className="ee-btn ee-btn--accent" onClick={onBack}>
                Zur Übersicht
              </button>
            )
          ) : (
            <button className="ee-btn ee-btn--primary" disabled={pick == null || busy || preview} onClick={submit}>
              Antwort prüfen
            </button>
          )}
        </div>
      </section>
    </>
  );
}

function TestView({ role, state, onClose, reload }: { role: MaRole; state: RoleState; onClose: () => void; reload: () => Promise<void> }) {
  const { toast } = useDashboard();
  const qs = TESTS[role];
  const [ans, setAns] = useState<Record<number, number>>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ passed: boolean; score: number; total: number; need: number; wrong: { q: string; correct: string }[] } | null>(null);
  const answered = Object.keys(ans).length;

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [result]);

  async function submit() {
    setBusy(true);
    const r = await submitTestAction(role, qs.map((_, i) => ans[i]));
    setBusy(false);
    if (!r.ok) return void toast(r.error, "info");
    setResult(r.data);
  }

  if (result)
    return (
      <>
        <PageHead title={`${ROLE_LABEL[role]}-Test`} />
        <section className={`ee-card ${result.passed ? "ee-card--forest ee-hero" : ""} ee-wiz__success`} data-component="TestResult">
          <div className="ee-wiz__check" style={result.passed ? undefined : { background: "var(--bad-soft)", color: "var(--bad)" }}>
            <Icon name={result.passed ? "check" : "close"} />
          </div>
          <h2>{result.passed ? "Bestanden!" : "Leider nicht bestanden"}</h2>
          <p className={result.passed ? "" : "muted"}>
            <b className="num">
              {result.score} von {result.total}
            </b>{" "}
            richtig ({Math.round((result.score / result.total) * 100)} %)
            {result.passed ? ` – deine ${ROLE_LABEL[role]}-Ansicht ist jetzt freigeschaltet.` : ` – nötig sind ${result.need}. Der Admin wurde informiert und kann eine Wiederholung freigeben.`}
          </p>
          <div className="row" style={{ justifyContent: "center" }}>
            {result.passed ? (
              /* voller Seitenaufruf: der Server berechnet die freigeschalteten Rollen neu */
              /* eslint-disable-next-line @next/next/no-html-link-for-pages */
              <a className="ee-btn ee-btn--accent" href="/?view=uebersicht">
                <Icon name="home" small /> Zur Übersicht
              </a>
            ) : (
              <button className="ee-btn" onClick={async () => { await reload(); onClose(); }}>
                Zurück zur Akademie
              </button>
            )}
          </div>
        </section>
        {!result.passed && (
          <section className="ee-card">
            <h2>Diese Fragen nochmal ansehen</h2>
            <ul className="ee-aka-ul">
              {result.wrong.map((w) => (
                <li key={w.q}>
                  <b>{w.q}</b>
                  <br />
                  <span className="muted">Richtig: {w.correct}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </>
    );

  return (
    <>
      <div className="row">
        <button className="ee-btn ee-btn--ghost ee-btn--sm" onClick={onClose}>
          <Icon name="left" small /> Abbrechen
        </button>
      </div>
      <PageHead title={`${ROLE_LABEL[role]}-Test`} />
      <p className="muted" style={{ marginTop: -12 }}>
        {qs.length} Fragen · bestanden ab {passMark(qs.length)} richtigen Antworten. Bei Nichtbestehen gibt der Admin eine Wiederholung frei.
        {state.tries > 0 ? ` Bisherige Versuche: ${state.tries}.` : ""}
      </p>
      <div className="stack" data-component="RoleTest">
        {qs.map((q, i) => (
          <section className="ee-card" key={i}>
            <p style={{ fontWeight: 650 }}>
              <span className="ee-vq__no">{i + 1}</span>
              {q.q}
            </p>
            <div className="ee-opts">
              {q.o.map((o, j) => (
                <label className="ee-opt" key={j}>
                  <input type="radio" name={`aka-q${i}`} checked={ans[i] === j} onChange={() => setAns((a) => ({ ...a, [i]: j }))} />
                  <span>{o}</span>
                </label>
              ))}
            </div>
          </section>
        ))}
      </div>
      <div className="ee-wiz__bar">
        <span className="faint" style={{ marginRight: "auto", alignSelf: "center" }}>
          {answered}/{qs.length} beantwortet
        </span>
        <button className="ee-btn ee-btn--primary" disabled={answered < qs.length || busy} onClick={submit}>
          Test abgeben
        </button>
      </div>
    </>
  );
}

/* ---------------------------------------------------------------------------------------------- */
/* Admin                                                                                           */
/* ---------------------------------------------------------------------------------------------- */

function statusCell(s: RoleState | undefined, done: ReadonlySet<string>, role: MaRole) {
  if (!s) return <span className="faint">–</span>;
  const path = pathFor(role);
  const n = path.filter((m) => done.has(m.id)).length;
  if (s.status === "bestanden")
    return (
      <>
        <ToneChip label={s.via === "test" ? `Frei · ${s.score}/${s.total}` : s.via === "bestand" ? "Frei · bestehend" : "Frei · vom Admin"} tone="ok" />
        <div className="sub">{s.date}</div>
      </>
    );
  if (s.status === "nicht_bestanden")
    return (
      <>
        <ToneChip label={`Nicht bestanden · ${s.score}/${s.total}`} tone="bad" />
        <div className="sub">
          {s.tries} Versuch{s.tries > 1 ? "e" : ""} · {s.retry ? "Wiederholung frei" : "Wiederholung gesperrt"}
        </div>
      </>
    );
  const all = pathDone(role, done);
  return (
    <>
      <ToneChip label={all ? "Test offen" : `Lernt · ${n}/${path.length}`} tone={all ? "warn" : "info"} />
      <div className="sub">gesperrt bis Test</div>
    </>
  );
}

function AdminAcademy({ data, reload }: { data: AcademyData; reload: () => Promise<void> }) {
  const { toast } = useDashboard();
  const [tab, setTab] = useState<"team" | "inhalte">("team");
  const team = data.team ?? [];
  const states = team.flatMap((p) => p.roles.map((r) => p.states[r]).filter((s): s is RoleState => !!s));
  const act = async (fn: () => Promise<{ ok: boolean; error?: string }>, ok: string) => {
    const r = await fn();
    toast(r.ok ? ok : (r.error ?? "Fehler"), r.ok ? "check" : "info");
    if (r.ok) await reload();
  };
  const waiting = team.filter((p) => p.roles.some((r) => p.states[r]?.status === "nicht_bestanden" && !p.states[r]?.retry));

  return (
    <>
      <PageHead title="Akademie" />
      <p className="muted" style={{ marginTop: -12, maxWidth: "70ch" }}>
        Rollen legst du unter „Team & Setter“ fest. Eine Ansicht wird erst nach bestandenem Test freigeschaltet. Wer beim Einführen schon im Team war, ist freigeschaltet.
      </p>
      <div className="ee-tabs" role="tablist">
        {(
          [
            ["team", "Team & Freischaltung"],
            ["inhalte", "Module & Inhalte"],
          ] as const
        ).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>
            {l}
          </button>
        ))}
      </div>
      {tab === "team" ? (
        <>
          <div className="ee-grid g-kpi">
            <Kpi label="Freigeschaltete Ansichten" value={states.filter((s) => s.status === "bestanden").length} />
            <Kpi label="Noch gesperrt" value={states.filter((s) => s.status !== "bestanden").length} />
            <Kpi label="Warten auf Wiederholung" value={waiting.length} tone={waiting.length ? "bad" : undefined} />
          </div>
          <section className="ee-card ee-card--flush" data-component="AcademyAdminTeam">
            <div className="ee-card__head">
              <h2>Team ({team.length})</h2>
              <label className="ee-check">
                <input type="checkbox" checked={data.lockOn} onChange={(e) => act(() => setLockAction(e.target.checked), e.target.checked ? "Freischaltung per Test aktiv" : "Alle Ansichten ohne Test offen")} />
                <span>Freischaltung per Test aktiv</span>
              </label>
            </div>
            <div className="ee-table-wrap">
              <table className="ee-table ee-table--stack">
                <thead>
                  <tr>
                    <th>MB</th>
                    {MA_ROLES_ALL.map((r) => (
                      <th key={r}>{ROLE_LABEL[r]}</th>
                    ))}
                    <th className="r">Aktion</th>
                  </tr>
                </thead>
                <tbody>
                  {team.map((p) => {
                    const done = new Set(p.done);
                    return (
                      <tr key={p.id}>
                        <td data-span>
                          <div className="who">{p.name}</div>
                          <div className="sub">{p.done.length} Module erledigt</div>
                        </td>
                        {MA_ROLES_ALL.map((r) => (
                          <td key={r} data-hide-sm>
                            {p.roles.includes(r) ? statusCell(p.states[r], done, r) : <span className="faint">–</span>}
                          </td>
                        ))}
                        <td className="r" data-span>
                          {p.roles.map((r) => {
                            const s = p.states[r];
                            if (!s) return null;
                            return (
                              <Fragment key={r}>
                                {s.status === "nicht_bestanden" && !s.retry && (
                                  <button className="ee-btn ee-btn--sm ee-btn--primary" onClick={() => act(() => grantRetryAction(p.id, r), `${p.name.split(" ")[0]} kann den Test wiederholen`)}>
                                    {ROLE_LABEL[r]}-Test freigeben
                                  </button>
                                )}{" "}
                                {s.status !== "bestanden" && (
                                  <button className="ee-btn ee-btn--sm" title="Ansicht ohne Test freischalten" onClick={() => act(() => unlockRoleAction(p.id, r), `${ROLE_LABEL[r]}-Ansicht von ${p.name.split(" ")[0]} freigeschaltet`)}>
                                    {ROLE_LABEL[r]} freischalten
                                  </button>
                                )}{" "}
                                {s.status === "bestanden" && (
                                  <button className="ee-btn ee-btn--sm ee-btn--ghost" title="Test muss neu gemacht werden" onClick={() => act(() => resetRoleAction(p.id, r), `${p.name.split(" ")[0]} muss den ${ROLE_LABEL[r]}-Test neu machen`)}>
                                    {ROLE_LABEL[r]} zurücksetzen
                                  </button>
                                )}{" "}
                              </Fragment>
                            );
                          })}
                        </td>
                      </tr>
                    );
                  })}
                  {team.length === 0 && (
                    <tr>
                      <td colSpan={5} className="muted">
                        Noch keine Mitarbeitenden mit Setter-, Presetter- oder Closer-Rolle.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : (
        <ContentTab data={data} reload={reload} />
      )}
    </>
  );
}

function ContentTab({ data, reload }: { data: AcademyData; reload: () => Promise<void> }) {
  const { toast } = useDashboard();
  const [urls, setUrls] = useState<Record<string, string>>(() => ({ ...data.videos }));
  async function save(m: AcademyModule) {
    const u = (urls[m.id] ?? "").trim();
    if (u && !youtubeEmbed(u)) return void toast("Bitte einen YouTube-Link einfügen", "info");
    const r = await setVideoAction(m.id, u);
    toast(r.ok ? (u ? `Video für „${m.title}“ gespeichert` : "Video entfernt") : r.error, r.ok ? "check" : "info");
    if (r.ok) await reload();
  }
  return (
    <>
      <div className="ee-demo-strip">
        <Icon name="info" small />
        <span>YouTube-Link einfügen und speichern – das Video erscheint sofort im Modul. Gelb markierte Module enthalten noch Platzhalter.</span>
      </div>
      <section className="ee-card ee-card--flush" data-component="AcademyAdminContent">
        <div className="ee-card__head">
          <h2>Module</h2>
          <span className="muted">
            {MODULES.length} Module · Tests: {MA_ROLES_ALL.map((r) => `${ROLE_LABEL[r]} ${TESTS[r].length} Fragen`).join(" · ")} · Bestehensgrenze {Math.round(PASS_RATIO * 100)} %
          </span>
        </div>
        <div className="ee-table-wrap">
          <table className="ee-table ee-table--stack">
            <thead>
              <tr>
                <th>Modul</th>
                <th>Für</th>
                <th>Inhalt</th>
                <th>Video (YouTube-Link)</th>
              </tr>
            </thead>
            <tbody>
              {MODULES.map((m) => (
                <tr key={m.id}>
                  <td data-span>
                    <div className="who">{m.title}</div>
                    <div className="sub">
                      {m.group} · {m.min} Min.
                    </div>
                  </td>
                  <td>
                    {m.roles.length === 3 ? (
                      <span className="ee-tag">Alle</span>
                    ) : (
                      m.roles.map((r) => (
                        <span className="ee-tag" key={r}>
                          {ROLE_LABEL[r]}
                        </span>
                      ))
                    )}
                  </td>
                  <td>{m.body.some((b) => "todo" in b) ? <ToneChip label="Platzhalter" tone="warn" /> : <ToneChip label="Entwurf fertig" tone="ok" />}</td>
                  <td data-span>
                    <form
                      className="ee-aka-vform"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void save(m);
                      }}
                    >
                      <input className="ee-input" id={`aka-video-${m.id}`} placeholder={m.video.title} value={urls[m.id] ?? ""} onChange={(e) => setUrls((x) => ({ ...x, [m.id]: e.target.value }))} aria-label={`YouTube-Link für ${m.title}`} />
                      <button className="ee-btn ee-btn--sm" type="submit">
                        Speichern
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

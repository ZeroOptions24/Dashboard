"use client";

import { useCallback, useEffect, useState } from "react";
import {
  askQuestionAction,
  contractSendOptionsAction,
  listContractsAction,
  remindContractAction,
  resolveQuestionAction,
  sendContractAction,
} from "@/app/actions/contracts";
import Icon from "@/components/ui/Icon";
import { ToneChip } from "@/components/ui/Chips";
import { PageHead } from "@/components/ui/Kpi";
import { refreshContractSummary } from "@/lib/live";
import { useDashboard } from "@/lib/useDashboard";
import type { ContractRow } from "@/server/contract-service";

type Filter = "alle" | "offen" | "unterschrieben" | "fragen";

function ContractItem({ c, admin, onChange }: { c: ContractRow; admin: boolean; onChange: () => void }) {
  const { toast } = useDashboard();
  const [asking, setAsking] = useState(false);
  const [question, setQuestion] = useState("");
  const title = c.documents.join(" + ");
  return (
    <div className="ee-doc">
      <div className="ee-doc__icon">
        <Icon name="doc" />
      </div>
      <div className="ee-doc__main">
        <div style={{ fontWeight: 650 }}>{title}</div>
        <div className="faint" style={{ fontSize: ".8rem" }}>
          {admin ? `${c.name} · ` : ""}gesendet {c.sentAt}
          {c.signedAt ? ` · unterschrieben ${c.signedAt}` : ""} · <span className="mono">{c.id.slice(0, 8)}</span>
        </div>
        {c.question && (
          <div className="ee-note" style={{ marginTop: 8 }}>
            <b>Rückfrage:</b> {c.question}
          </div>
        )}
      </div>
      {c.status === "unterschrieben" ? <ToneChip label="Unterschrieben" tone="ok" /> : c.status === "storniert" ? <ToneChip label="Storniert" tone="" /> : <ToneChip label="Offen" tone="warn" />}
      <div className="row">
        <a className="ee-btn ee-btn--sm" href={`/api/contracts/${c.id}/pdf`} target="_blank" rel="noopener">
          PDF ansehen
        </a>
        {admin ? (
          <>
            {c.status === "offen" && (
              <button
                className="ee-btn ee-btn--sm"
                onClick={async () => {
                  const res = await remindContractAction(c.id);
                  toast(res.ok ? `Erinnerung an ${c.name.split(" ")[0]} gesendet` : res.error, res.ok ? "send" : "info");
                }}
              >
                <Icon name="send" small /> Erinnern
              </button>
            )}
            {c.question && (
              <button
                className="ee-btn ee-btn--sm ee-btn--primary"
                onClick={async () => {
                  const res = await resolveQuestionAction(c.id);
                  toast(res.ok ? "Rückfrage als geklärt markiert" : res.error, res.ok ? "check" : "info");
                  onChange();
                }}
              >
                Als geklärt markieren
              </button>
            )}
          </>
        ) : (
          <>
            {/* Entwicklung: simulierte Unterschrift; echt kommt der Yousign-Link per E-Mail */}
            {c.devSignUrl && (
              <a className="ee-btn ee-btn--primary ee-btn--sm" href={c.devSignUrl}>
                Jetzt unterschreiben (Test)
              </a>
            )}
            <button className="ee-btn ee-btn--ghost ee-btn--sm" onClick={() => setAsking(true)}>
              Frage stellen
            </button>
          </>
        )}
      </div>
      {!admin && c.status === "offen" && !c.devSignUrl && (
        <p className="ee-hint" style={{ flexBasis: "100%" }}>
          Den Link zur elektronischen Unterschrift hast du per E-Mail bekommen.
        </p>
      )}
      {asking && (
        <form
          className="ee-field ee-field--full"
          style={{ flexBasis: "100%" }}
          data-component="ContractQuestionForm"
          onSubmit={async (e) => {
            e.preventDefault();
            const res = await askQuestionAction(c.id, question);
            if (!res.ok) return toast(res.error, "info");
            setAsking(false);
            setQuestion("");
            toast("Frage an die Admins gesendet", "send");
            onChange();
          }}
        >
          <label htmlFor={`ask-${c.id}`}>Deine Frage zu diesem Vertrag</label>
          <textarea
            className="ee-textarea"
            id={`ask-${c.id}`}
            required
            autoFocus
            placeholder="z. B. Ab wann gilt die neue Staffel?"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
          <div className="row">
            <button className="ee-btn ee-btn--primary ee-btn--sm" type="submit">
              Frage senden
            </button>
            <button className="ee-btn ee-btn--ghost ee-btn--sm" type="button" onClick={() => setAsking(false)}>
              Abbrechen
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

/** Admin: weitere Unterlagen an eine Person senden */
function SendForm({ onSent }: { onSent: () => void }) {
  const { toast } = useDashboard();
  const [opts, setOpts] = useState<{ recipients: { id: string; name: string; ready: boolean }[]; templates: string[] } | null>(null);
  const [who, setWho] = useState("");
  const [docs, setDocs] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let off = false;
    contractSendOptionsAction().then((res) => {
      if (off || !res.ok) return;
      setOpts(res.data);
      setWho(res.data.recipients.find((r) => r.ready)?.id ?? "");
    });
    return () => {
      off = true;
    };
  }, []);
  if (!opts) return null;
  return (
    <section className="ee-card">
      <h2>Vertrag senden</h2>
      <form
        className="stack"
        style={{ marginTop: 12 }}
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const res = await sendContractAction(who, docs);
          setBusy(false);
          if (!res.ok) return toast(res.error, "info");
          toast(`Zur Unterschrift gesendet an ${opts.recipients.find((r) => r.id === who)?.name.split(" ")[0]}`, "send");
          setDocs([]);
          onSent();
        }}
      >
        <div className="ee-field">
          <label htmlFor="cWho">An</label>
          <select className="ee-select" id="cWho" value={who} onChange={(e) => setWho(e.target.value)}>
            {opts.recipients.map((r) => (
              <option key={r.id} value={r.id} disabled={!r.ready}>
                {r.name}
                {r.ready ? "" : " (Stammdaten fehlen)"}
              </option>
            ))}
          </select>
        </div>
        <fieldset className="ee-field">
          <legend className="lbl">Unterlagen</legend>
          <div className="ee-opts">
            {opts.templates.map((t) => (
              <label key={t} className="ee-opt">
                <input type="checkbox" checked={docs.includes(t)} onChange={(e) => setDocs(e.target.checked ? [...docs, t] : docs.filter((d) => d !== t))} />
                <span>{t}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <p className="ee-hint">Solange die Vorlagen vom Anwalt fehlen, wird ein gekennzeichnetes Platzhalter-PDF verschickt.</p>
        <button className="ee-btn ee-btn--primary" type="submit" disabled={busy || !who || !docs.length}>
          <Icon name="send" small /> Zur Unterschrift senden
        </button>
      </form>
    </section>
  );
}

export default function VertraegeView() {
  const { role } = useDashboard();
  const admin = role === "admin";
  const [rows, setRows] = useState<ContractRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("alle");
  const load = useCallback(async () => {
    const res = await listContractsAction(admin ? "all" : "mine");
    if (res.ok) setRows(res.data);
    else setError(res.error);
    refreshContractSummary();
  }, [admin]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Daten beim Öffnen der Ansicht laden
    void load();
  }, [load]);

  const match = (c: ContractRow, k: Filter) => k === "alle" || (k === "fragen" ? !!c.question : c.status === k);
  const body = error ? (
    <div className="ee-alert ee-alert--bad">{error}</div>
  ) : !rows ? (
    <div className="ee-empty">Lade …</div>
  ) : rows.filter((c) => match(c, filter)).length ? (
    rows.filter((c) => match(c, filter)).map((c) => <ContractItem key={c.id} c={c} admin={admin} onChange={load} />)
  ) : (
    <p className="muted">{admin ? "Keine Verträge in dieser Auswahl." : "Noch keine Verträge im Dashboard. Verträge, die du außerhalb unterschrieben hast, erscheinen hier nicht."}</p>
  );

  if (admin)
    return (
      <>
        <PageHead title="Verträge verwalten" />
        <div className="ee-grid g-main" style={{ alignItems: "start" }}>
          <section className="ee-card" data-component="ContractList">
            <div className="ee-filters">
              {(
                [
                  ["alle", "Alle"],
                  ["offen", "Offen"],
                  ["unterschrieben", "Unterschrieben"],
                  ["fragen", "Rückfragen"],
                ] as [Filter, string][]
              ).map(([k, l]) => (
                <button key={k} className="ee-filter" aria-pressed={filter === k} onClick={() => setFilter(k)}>
                  {l}
                  <span className="c">{(rows ?? []).filter((c) => match(c, k)).length}</span>
                </button>
              ))}
            </div>
            <div>{body}</div>
          </section>
          <SendForm onSent={load} />
        </div>
      </>
    );
  return (
    <>
      <PageHead title="Verträge" />
      <section className="ee-card" data-component="ContractList">
        {body}
      </section>
    </>
  );
}

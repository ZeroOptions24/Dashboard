"use client";

import { useState } from "react";
import Icon from "@/components/ui/Icon";
import { ToneChip } from "@/components/ui/Chips";
import { PageHead } from "@/components/ui/Kpi";
import { askContractQuestion, remindContract, resolveContractQuestion, sendContractDemo, signContract } from "@/lib/actions";
import { CONTRACT_TEMPLATES } from "@/lib/domain";
import { useDashboard } from "@/lib/useDashboard";
import type { Contract } from "@/lib/types";

type Filter = "alle" | "open" | "signed" | "q";

function ContractRow({ c, admin, asking, setAsking }: { c: Contract; admin: boolean; asking: boolean; setAsking: (id: string | null) => void }) {
  const { person, toast } = useDashboard();
  const [question, setQuestion] = useState("");
  return (
    <div className="ee-doc">
      <div className="ee-doc__icon">
        <Icon name="doc" />
      </div>
      <div className="ee-doc__main">
        <div style={{ fontWeight: 650 }}>{c.doc}</div>
        <div className="faint" style={{ fontSize: ".8rem" }}>
          {admin ? `${person(c.who).name} · ` : ""}gesendet {c.sent}
          {c.signed ? ` · unterschrieben ${c.signed}` : ""} · <span className="mono">{c.id}</span>
        </div>
        {c.question && (
          <div className="ee-note" style={{ marginTop: 8 }}>
            <b>Rückfrage:</b> {c.question}
          </div>
        )}
      </div>
      {c.status === "signed" ? <ToneChip label="Unterschrieben" tone="ok" /> : <ToneChip label="Offen" tone="warn" />}
      <div className="row">
        {admin ? (
          <>
            {c.status === "open" && (
              <button
                className="ee-btn ee-btn--sm"
                onClick={() => {
                  remindContract(c.id);
                  toast(`Erinnerung an ${person(c.who).first} gesendet`, "send");
                }}
              >
                <Icon name="send" small /> Erinnern
              </button>
            )}
            {c.question && (
              <button
                className="ee-btn ee-btn--sm ee-btn--primary"
                onClick={() => {
                  resolveContractQuestion(c.id);
                  toast("Rückfrage als geklärt markiert");
                }}
              >
                Als geklärt markieren
              </button>
            )}
          </>
        ) : (
          <>
            {c.status === "open" ? (
              <button
                className="ee-btn ee-btn--primary ee-btn--sm"
                onClick={() => {
                  signContract(c.id);
                  toast("DocuSign-Demo: Vertrag als unterschrieben markiert");
                }}
              >
                In DocuSign unterschreiben
              </button>
            ) : (
              <button className="ee-btn ee-btn--sm" onClick={() => toast("Würde das PDF aus DocuSign öffnen")}>
                PDF ansehen
              </button>
            )}
            <button className="ee-btn ee-btn--ghost ee-btn--sm" onClick={() => setAsking(c.id)}>
              Frage stellen
            </button>
          </>
        )}
      </div>
      {asking && (
        <form
          className="ee-field ee-field--full"
          style={{ flexBasis: "100%" }}
          data-component="ContractQuestionForm"
          onSubmit={(e) => {
            e.preventDefault();
            if (!question.trim()) return;
            askContractQuestion(c.id, question);
            setAsking(null);
            toast("Frage an Tim gesendet", "send");
          }}
        >
          <label htmlFor="askText">Deine Frage an Tim zu diesem Vertrag</label>
          <textarea
            className="ee-textarea"
            id="askText"
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
            <button className="ee-btn ee-btn--ghost ee-btn--sm" type="button" onClick={() => setAsking(null)}>
              Abbrechen
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export default function VertraegeView() {
  const { data, role, me, person, toast } = useDashboard();
  const [filter, setFilter] = useState<Filter>("alle");
  const [asking, setAsking] = useState<string | null>(null);
  const [send, setSend] = useState({ who: data.TEAM[0]?.key ?? "", doc: CONTRACT_TEMPLATES[0] });
  const C = data.CONTRACTS;
  const row = (c: Contract, admin: boolean) => (
    <ContractRow key={c.id} c={c} admin={admin} asking={asking === c.id} setAsking={setAsking} />
  );

  if (role === "admin") {
    const match = (c: Contract, k: Filter) => k === "alle" || (k === "open" && c.status === "open") || (k === "signed" && c.status === "signed") || (k === "q" && !!c.question);
    const list = C.filter((c) => match(c, filter));
    return (
      <>
        <PageHead title="Verträge verwalten" />
        <div className="ee-grid g-main" style={{ alignItems: "start" }}>
          <section className="ee-card" data-component="ContractList">
            <div className="ee-filters">
              {(
                [
                  ["alle", "Alle"],
                  ["open", "Offen"],
                  ["signed", "Unterschrieben"],
                  ["q", "Rückfragen"],
                ] as [Filter, string][]
              ).map(([k, l]) => (
                <button key={k} className="ee-filter" aria-pressed={filter === k} onClick={() => setFilter(k)}>
                  {l}
                  <span className="c">{C.filter((c) => match(c, k)).length}</span>
                </button>
              ))}
            </div>
            <div>{list.length ? list.map((c) => row(c, true)) : <p className="muted">Keine Verträge.</p>}</div>
          </section>
          <section className="ee-card">
            <h2>Vertrag senden</h2>
            <form
              className="stack"
              onSubmit={(e) => {
                e.preventDefault();
                sendContractDemo(send.who, send.doc);
                toast(`„${send.doc}“ an ${person(send.who).first} gesendet`, "send");
              }}
            >
              <div className="ee-field">
                <label htmlFor="cWho">An</label>
                <select className="ee-select" id="cWho" value={send.who} onChange={(e) => setSend({ ...send, who: e.target.value })}>
                  {data.TEAM.map((t) => (
                    <option key={t.key} value={t.key}>
                      {person(t.key).name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="ee-field">
                <label htmlFor="cDoc">Vorlage</label>
                <select className="ee-select" id="cDoc" value={send.doc} onChange={(e) => setSend({ ...send, doc: e.target.value })}>
                  {CONTRACT_TEMPLATES.map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </select>
              </div>
              <button className="ee-btn ee-btn--primary" type="submit">
                <Icon name="send" small /> Über DocuSign senden
              </button>
            </form>
          </section>
        </div>
      </>
    );
  }
  return (
    <>
      <PageHead title="Verträge" />
      <section className="ee-card" data-component="ContractList">
        {C.filter((c) => c.who === me).map((c) => row(c, false))}
      </section>
    </>
  );
}

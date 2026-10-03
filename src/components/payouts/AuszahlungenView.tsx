"use client";

import { useState } from "react";
import { ToneChip } from "@/components/ui/Chips";
import Icon from "@/components/ui/Icon";
import { Kpi, PageHead } from "@/components/ui/Kpi";
import { answerProvision, askProvision, markTbk, releasePayout, runSettlementNow, stornoLead } from "@/lib/actions";
import { PAYOUT_STATUS } from "@/lib/domain";
import { eur, maskIban } from "@/lib/format";
import { deDate, nextRun } from "@/lib/payouts";
import { LIVE } from "@/lib/store";
import type { Payout, ProvisionItem } from "@/lib/types";
import { useDashboard } from "@/lib/useDashboard";

/* Auszahlungen (Tims Vorlage + Ablauf A11/A12):
   Provisionen warten auf TBK → fest → Abrechnung am 1./15. → Freigabe → Auszahlung am 10./25. */

const ROLE_LABEL: Record<string, string> = { setter: "Setter", presetter: "Presetter", closer: "Closer", admin: "Admin" };
const STORNO_GRUENDE = ["Widerruf innerhalb von 14 Tagen", "MVT: Haus nicht baubar", "Finanzierung abgelehnt", "Sonstiges"];

/** Status einer Provision: Wartet auf TBK · Fest · TBK · Storno (mit Grund) */
function PostenState({ x }: { x: Pick<ProvisionItem, "status" | "grund"> }) {
  if (x.status === "storno")
    return (
      <>
        <ToneChip label="Storno" tone="bad" />
        {x.grund ? <div className="sub ee-storno">{x.grund}</div> : null}
      </>
    );
  if (x.status === "tbk") return <ToneChip label="Wartet auf TBK" tone="info" />;
  return <ToneChip label="Fest · TBK" tone="ok" />;
}

const gutschriftUrl = (id: string) => `/api/payouts/${encodeURIComponent(id)}/gutschrift`;

function GutschriftLink({ p }: { p: Payout }) {
  if (!LIVE) return null;
  return (
    <a className="ee-btn ee-btn--sm" href={gutschriftUrl(p.id)} target="_blank" rel="noopener">
      <Icon name="doc" small /> Gutschrift
    </a>
  );
}

/** Rückfrage zu einer Position (MB) */
function AskForm({ x }: { x: ProvisionItem }) {
  const { toast } = useDashboard();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  if (x.frage)
    return (
      <div className="ee-ask">
        <div>
          <b>Deine Rückfrage:</b> {x.frage}
        </div>
        {x.antwort ? (
          <div>
            <b>Antwort:</b> {x.antwort}
          </div>
        ) : (
          <div className="faint">wartet auf Antwort</div>
        )}
      </div>
    );
  if (!open)
    return (
      <button className="ee-btn ee-btn--ghost ee-btn--sm" onClick={() => setOpen(true)} data-component="PayoutQuestionOpen">
        <Icon name="msg" small /> Rückfrage
      </button>
    );
  return (
    <form
      className="row"
      style={{ gap: 8 }}
      data-component="PayoutQuestionForm"
      onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim()) return;
        askProvision(x.id, text.trim());
        toast("Rückfrage an die Abrechnung gesendet", "send");
        setOpen(false);
      }}
    >
      <input className="ee-input" autoFocus placeholder="z. B. Die Montage war schon – warum noch nicht fest?" value={text} onChange={(e) => setText(e.target.value)} />
      <button className="ee-btn ee-btn--primary ee-btn--sm" type="submit">
        Senden
      </button>
    </form>
  );
}

/* ======================= MB (Setter, Presetter, Closer) ======================= */

function MyPayouts() {
  const { data, me, now } = useDashboard();
  const P = data.PAYOUTS[me] || [];
  const mine = data.PROVISIONS.filter((x) => x.user === me);
  const offen = mine.filter((x) => !x.payoutId && x.status !== "storno");
  const fest = offen.filter((x) => x.status === "fest");
  const paid = P.filter((p) => p.status === "ausgezahlt");
  const last = paid[0];
  const next = P.filter((p) => p.status !== "ausgezahlt").slice(-1)[0];
  const { stichtag, zahltag } = nextRun(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
  const iban = data.PROFILES[me]?.iban;
  const ibanText = P[0]?.ibanLast4 ? `•••• ${P[0].ibanLast4}` : iban ? maskIban(iban) : "–";
  return (
    <>
      <PageHead title="Auszahlungen" />
      <div className="ee-grid g-kpi g-kpi5" data-component="PayoutKpis">
        <Kpi label="Offen" value={eur(offen.reduce((s, x) => s + x.betrag, 0))} meta={`${offen.length} ${offen.length === 1 ? "Provision" : "Provisionen"}`} tone="money" />
        <Kpi label="Davon fest" value={eur(fest.reduce((s, x) => s + x.betrag, 0))} meta={`kommt in die Abrechnung zum ${deDate(stichtag).slice(0, 6)}`} tone="money" />
        <Kpi label="Letzte Auszahlung" value={last ? eur(last.betrag) : "–"} meta={last ? `am ${last.datum.slice(0, 6)}` : "noch keine"} tone="money" />
        <Kpi label="Insgesamt ausgezahlt" value={eur(paid.reduce((s, p) => s + p.betrag, 0))} meta={`${paid.length} ${paid.length === 1 ? "Abrechnung" : "Abrechnungen"}`} tone="money" />
        <Kpi
          label="Nächste Auszahlung"
          value={next ? next.datum.slice(0, 6) : deDate(zahltag).slice(0, 6)}
          meta={
            <>
              auf <span className="mono">{ibanText}</span>
            </>
          }
        />
      </div>
      <section className="ee-card ee-card--flush" data-component="PayoutTable">
        <div className="ee-card__head">
          <div>
            <h2>Deine Provisionen</h2>
            <div className="faint" style={{ fontSize: ".8rem", marginTop: 2 }}>
              Fest wird eine Provision, sobald der Kunde TBK ist. Abrechnung am 1. und 15., Auszahlung am 10. und 25.
            </div>
          </div>
        </div>
        {mine.length ? (
          <div className="ee-table-wrap">
            <table className="ee-table ee-table--stack">
              <thead>
                <tr>
                  <th>Datum</th>
                  <th>Kunde / Anlass</th>
                  <th>Status</th>
                  <th className="r">Betrag</th>
                </tr>
              </thead>
              <tbody>
                {mine.map((x) => (
                  <tr key={x.id}>
                    <td className="sub num" data-hide-sm="">
                      {x.datum.slice(0, 6)}
                    </td>
                    <td>
                      <div className="who">{x.kunde}</div>
                      <div className="sub">
                        {x.anlass}
                        {x.payoutId ? " · abgerechnet" : ""}
                      </div>
                      <AskForm x={x} />
                    </td>
                    <td>
                      <PostenState x={x} />
                    </td>
                    <td className="r num">
                      <b className={x.status === "storno" ? "is-neg" : "is-money"}>{eur(x.betrag)}</b>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="ee-empty">Noch keine Provisionen – sie entstehen mit dem ersten Termin bzw. Verkauf.</div>
        )}
      </section>
      <section className="ee-card ee-card--flush">
        <div className="ee-card__head">
          <h2>Abrechnungen</h2>
        </div>
        {P.length ? (
          <div className="ee-table-wrap">
            <table className="ee-table ee-table--stack">
              <thead>
                <tr>
                  <th>Zeitraum</th>
                  <th>Auszahlung</th>
                  <th>Status</th>
                  <th className="r">Betrag</th>
                  <th className="r" />
                </tr>
              </thead>
              <tbody>
                {P.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div className="who">{p.periode}</div>
                      <div className="sub">
                        {p.posten.length} {p.posten.length === 1 ? "Position" : "Positionen"}
                        {p.ust ? ` · inkl. ${eur(p.ust)} USt` : ""}
                      </div>
                    </td>
                    <td className="sub num">{p.datum}</td>
                    <td>
                      <ToneChip label={PAYOUT_STATUS[p.status].label} tone={PAYOUT_STATUS[p.status].tone} />
                      {p.hinweis ? <div className="sub is-bad">{p.hinweis}</div> : null}
                    </td>
                    <td className="r num">
                      <b className="is-money">{eur(p.betrag)}</b>
                    </td>
                    <td className="r" data-span="">
                      <GutschriftLink p={p} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="ee-empty">Noch keine Abrechnung – die erste kommt zum {deDate(stichtag)}.</div>
        )}
      </section>
    </>
  );
}

/* ======================= Admin ======================= */

/** TBK bestätigen oder stornieren – je Kunde (alle Beteiligten auf einmal) */
function TbkRow({ leadId, items }: { leadId: string; items: ProvisionItem[] }) {
  const { person, toast } = useDashboard();
  const [mode, setMode] = useState<"" | "storno">("");
  const [grund, setGrund] = useState(STORNO_GRUENDE[0]);
  const sum = items.reduce((s, x) => s + x.betrag, 0);
  return (
    <tr>
      <td>
        <div className="who">{items[0].kunde}</div>
        <div className="sub">
          {items.map((x) => `${person(x.user).first} (${ROLE_LABEL[x.role] ?? x.role}) ${eur(x.betrag)}`).join(" · ")}
        </div>
      </td>
      <td className="sub num">{items[0].datum}</td>
      <td className="r num">
        <b className="is-money">{eur(sum)}</b>
      </td>
      <td className="r" data-span="">
        {mode === "storno" ? (
          <form
            className="row"
            style={{ gap: 6, justifyContent: "flex-end" }}
            onSubmit={(e) => {
              e.preventDefault();
              stornoLead(leadId, grund);
              toast(`${items[0].kunde}: storniert – Beteiligte informiert`, "info");
              setMode("");
            }}
          >
            <select className="ee-select" value={grund} onChange={(e) => setGrund(e.target.value)} aria-label="Grund">
              {STORNO_GRUENDE.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
            <button className="ee-btn ee-btn--danger ee-btn--sm" type="submit">
              Stornieren
            </button>
            <button className="ee-btn ee-btn--ghost ee-btn--sm" type="button" onClick={() => setMode("")}>
              Abbrechen
            </button>
          </form>
        ) : (
          <div className="row" style={{ gap: 6, justifyContent: "flex-end" }}>
            <button
              className="ee-btn ee-btn--primary ee-btn--sm"
              onClick={() => {
                markTbk(leadId);
                toast(`${items[0].kunde}: TBK – ${items.length} ${items.length === 1 ? "Provision" : "Provisionen"} fest`);
              }}
            >
              <Icon name="check" small /> TBK
            </button>
            <button className="ee-btn ee-btn--sm" onClick={() => setMode("storno")}>
              Storno
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

function AnswerRow({ x }: { x: ProvisionItem }) {
  const { person, toast } = useDashboard();
  const [text, setText] = useState("");
  return (
    <div className="ee-list__row" style={{ alignItems: "flex-start" }}>
      <div className="ee-list__main stack" style={{ gap: 6 }}>
        <div className="ee-list__title">
          {person(x.user).first} · {x.kunde} ({eur(x.betrag)})
        </div>
        <div className="ee-list__sub">„{x.frage}“</div>
        <form
          className="row"
          style={{ gap: 8 }}
          onSubmit={(e) => {
            e.preventDefault();
            if (!text.trim()) return;
            answerProvision(x.id, text.trim());
            toast(`Antwort an ${person(x.user).first} gesendet`, "send");
          }}
        >
          <input className="ee-input" placeholder="Antwort" value={text} onChange={(e) => setText(e.target.value)} />
          <button className="ee-btn ee-btn--primary ee-btn--sm" type="submit">
            Antworten
          </button>
        </form>
      </div>
    </div>
  );
}

function AdminPayouts() {
  const { data, person, toast } = useDashboard();
  const rows = Object.entries(data.PAYOUTS).flatMap(([who, ps]) => ps.map((p) => ({ ...p, who })));
  const open = rows.filter((r) => r.status !== "ausgezahlt");
  const waiting = data.PROVISIONS.filter((x) => x.status === "tbk");
  const byLead = [...new Set(waiting.map((x) => x.lead))].map((id) => ({ id, items: waiting.filter((x) => x.lead === id) }));
  const questions = data.PROVISIONS.filter((x) => x.frage && !x.antwort);
  return (
    <>
      <PageHead
        title="Auszahlungen"
        actions={
          LIVE ? (
            <button
              className="ee-btn"
              onClick={() => {
                if (!window.confirm("Abrechnung zum heutigen Tag jetzt erstellen? (Sonst automatisch am 1. und 15.)")) return;
                runSettlementNow((n) => toast(n ? `${n} ${n === 1 ? "Abrechnung" : "Abrechnungen"} erstellt` : "Keine festen Provisionen offen", n ? "check" : "info"));
              }}
            >
              <Icon name="euro" small /> Abrechnung jetzt erstellen
            </button>
          ) : null
        }
      />
      <div className="ee-grid g-kpi">
        <Kpi label="Wartet auf TBK" value={eur(waiting.reduce((s, x) => s + x.betrag, 0))} meta={`${byLead.length} ${byLead.length === 1 ? "Kunde" : "Kunden"}`} tone="money" />
        <Kpi label="Rückfragen offen" value={questions.length} tone={questions.length ? "bad" : ""} />
        <Kpi label="In Prüfung" value={open.filter((r) => r.status === "pruefung").length} meta={eur(open.filter((r) => r.status === "pruefung").reduce((s, r) => s + r.betrag, 0))} />
        <Kpi label="Freigegeben" value={eur(open.filter((r) => r.status === "freigegeben").reduce((s, r) => s + r.betrag, 0))} meta="wird am Auszahlungstag ausgezahlt" tone="money" />
      </div>
      {questions.length ? (
        <section className="ee-card" data-component="PayoutQuestions">
          <div className="ee-card__head">
            <h2>Rückfragen</h2>
            <span className="ee-count is-bad">{questions.length}</span>
          </div>
          <div className="ee-list">
            {questions.map((x) => (
              <AnswerRow key={x.id} x={x} />
            ))}
          </div>
        </section>
      ) : null}
      <section className="ee-card ee-card--flush" data-component="TbkList">
        <div className="ee-card__head">
          <div>
            <h2>Wartet auf TBK</h2>
            <div className="faint" style={{ fontSize: ".8rem", marginTop: 2 }}>
              Ist der Kunde nach der Montagevorbereitung TBK, werden alle Provisionen fest. Widerruf oder nicht baubar → Storno mit Grund.
            </div>
          </div>
        </div>
        {byLead.length ? (
          <div className="ee-table-wrap">
            <table className="ee-table ee-table--stack">
              <thead>
                <tr>
                  <th>Kunde / Beteiligte</th>
                  <th>Seit</th>
                  <th className="r">Summe</th>
                  <th className="r">Aktion</th>
                </tr>
              </thead>
              <tbody>
                {byLead.map((g) => (
                  <TbkRow key={g.id} leadId={g.id} items={g.items} />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="ee-empty">Nichts offen</div>
        )}
      </section>
      <section className="ee-card ee-card--flush" data-component="PayoutTable">
        <div className="ee-card__head">
          <h2>Abrechnungen</h2>
        </div>
        {rows.length ? (
          <div className="ee-table-wrap">
            <table className="ee-table ee-table--stack">
              <thead>
                <tr>
                  <th>MB</th>
                  <th>Zeitraum</th>
                  <th>Status</th>
                  <th className="r">Betrag</th>
                  <th className="r">Aktion</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div className="who">{person(r.who).name}</div>
                      <div className="sub">
                        {ROLE_LABEL[person(r.who).role]} · <span className="mono">{r.ibanLast4 ? `•••• ${r.ibanLast4}` : maskIban(data.PROFILES[r.who]?.iban ?? "")}</span>
                      </div>
                    </td>
                    <td>
                      <div className="sub">{r.periode}</div>
                      <div className="sub">Auszahlung {r.datum}</div>
                    </td>
                    <td>
                      <ToneChip label={PAYOUT_STATUS[r.status].label} tone={PAYOUT_STATUS[r.status].tone} />
                      {r.hinweis ? <div className="sub is-bad">{r.hinweis}</div> : null}
                    </td>
                    <td className="r num">
                      <b className="is-money">{eur(r.betrag)}</b>
                      {r.ust ? <div className="sub">inkl. {eur(r.ust)} USt</div> : null}
                    </td>
                    <td className="r" data-span="">
                      <div className="row" style={{ gap: 6, justifyContent: "flex-end" }}>
                        <GutschriftLink p={r} />
                        {r.status === "pruefung" ? (
                          <button
                            className="ee-btn ee-btn--primary ee-btn--sm"
                            title={r.hinweis ? `${r.hinweis} – Freigabe klappt, sobald die IBAN eingetragen ist` : undefined}
                            onClick={() => {
                              const p = releasePayout(r.who, r.id);
                              if (p) toast(`${p.periode} für ${person(r.who).first} freigegeben`);
                            }}
                          >
                            Freigeben
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="ee-empty">Noch keine Abrechnungen – die erste entsteht am 1. bzw. 15. aus den festen Provisionen.</div>
        )}
      </section>
    </>
  );
}

export default function AuszahlungenView() {
  const { role } = useDashboard();
  return role === "admin" ? <AdminPayouts /> : <MyPayouts />;
}

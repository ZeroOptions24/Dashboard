"use client";

import { Fragment, useState } from "react";
import { ToneChip } from "@/components/ui/Chips";
import Icon from "@/components/ui/Icon";
import { Kpi, PageHead } from "@/components/ui/Kpi";
import { answerProvision, askProvision, markTbk, releaseAllPayouts, releasePayout, runSettlementNow, stornoLead } from "@/lib/actions";
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

const dkey = (d: string) => d.split(".").reverse().join("");
const postenSum = (p: Payout) => {
  const n = (st: string) => p.posten.filter((x) => x.status === st).length;
  return [n("fest") && `${n("fest")} fest`, n("storno") && `${n("storno")} Storno`].filter(Boolean).join(" · ") || "–";
};

/** Eine Abrechnungstabelle (MB, Posten, Betrag, Status, Aktion) mit aufklappbaren Posten */
function RunTable({ title, rows }: { title: string; rows: (Payout & { who: string })[] }) {
  const { data, person, toast } = useDashboard();
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <section className="ee-card ee-card--flush" data-component="PayoutTable">
      <div className="ee-card__head">
        <h2>{title}</h2>
      </div>
      <div className="ee-table-wrap">
        <table className="ee-table ee-table--stack">
          <thead>
            <tr>
              <th>MB</th>
              <th>Posten</th>
              <th className="r">Auszahlbar</th>
              <th>Status</th>
              <th className="r">Aktion</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <Fragment key={r.id}>
                <tr>
                  <td>
                    <div className="who">{person(r.who).name}</div>
                    <div className="sub">
                      {ROLE_LABEL[person(r.who).role]} · <span className="mono">{r.ibanLast4 ? `•••• ${r.ibanLast4}` : maskIban(data.PROFILES[r.who]?.iban ?? "")}</span>
                    </div>
                  </td>
                  <td className="sub">{postenSum(r)}</td>
                  <td className="r num">
                    <b className="is-money">{eur(r.betrag)}</b>
                    {r.ust ? <div className="sub">inkl. {eur(r.ust)} USt</div> : null}
                  </td>
                  <td>
                    {r.hinweis && r.status === "pruefung" ? <ToneChip label="Gehalten" tone="warn" /> : <ToneChip label={PAYOUT_STATUS[r.status].label} tone={PAYOUT_STATUS[r.status].tone} />}
                    {r.hinweis ? <div className="sub is-bad">{r.hinweis}</div> : null}
                  </td>
                  <td className="r" data-span="">
                    <div className="row" style={{ gap: 6, justifyContent: "flex-end" }}>
                      <button className="ee-btn ee-btn--sm" aria-expanded={openId === r.id} onClick={() => setOpenId(openId === r.id ? null : r.id)}>
                        Posten
                      </button>
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
                {openId === r.id && (
                  <tr>
                    <td colSpan={5} style={{ background: "var(--surface-2)" }}>
                      <div className="stack" style={{ gap: 6 }}>
                        {r.posten.map((x, i) => (
                          <div className="row row--between" key={x.provisionId ?? i}>
                            <span>
                              <b>{x.kunde}</b> <span className="sub">· {x.anlass}{x.grund ? ` · ${x.grund}` : ""} · {x.datum}</span>
                            </span>
                            <span className="row" style={{ gap: 8 }}>
                              <ToneChip label={x.status === "storno" ? "Storno" : "Fest · TBK"} tone={x.status === "storno" ? "bad" : "ok"} />
                              <b className={x.betrag < 0 ? "num is-bad" : "num"}>{eur(x.betrag)}</b>
                            </span>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AdminPayouts() {
  const { data, now, person, toast } = useDashboard();
  const rows = Object.entries(data.PAYOUTS).flatMap(([who, ps]) => ps.map((p) => ({ ...p, who })));
  const open = rows.filter((r) => r.status !== "ausgezahlt");
  const waiting = data.PROVISIONS.filter((x) => x.status === "tbk");
  const byLead = [...new Set(waiting.map((x) => x.lead))].map((id) => ({ id, items: waiting.filter((x) => x.lead === id) }));
  const questions = data.PROVISIONS.filter((x) => x.frage && !x.antwort);

  /* aktueller Lauf = früheste offene Abrechnung (Auszahlungstag); weitere offene Läufe stehen darunter */
  const runDatum = open.map((r) => r.datum).sort((a, b) => dkey(a).localeCompare(dkey(b)))[0];
  const run = open.filter((r) => r.datum === runDatum);
  const others = open.filter((r) => r.datum !== runDatum);
  const held = run.filter((r) => r.status === "pruefung" && r.hinweis);
  const sum = run.filter((r) => !(r.status === "pruefung" && r.hinweis)).reduce((s, r) => s + r.betrag, 0);
  const released = run.filter((r) => r.status === "freigegeben").length;
  const reviewable = run.filter((r) => r.status === "pruefung" && !r.hinweis).length;
  const waitSum = waiting.reduce((s, x) => s + x.betrag, 0);
  const stornos = run.flatMap((r) => r.posten.filter((x) => x.status === "storno").map((x) => ({ ...x, who: r.who })));
  const [d, m, y] = (runDatum ?? "").split(".").map(Number);
  const daysTo = runDatum ? Math.max(0, Math.ceil((new Date(y, m - 1, d).getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 864e5)) : 0;
  const stichtag = runDatum ? `${d <= 10 ? "01" : "15"}.${String(m).padStart(2, "0")}.` : "";
  const next = nextRun(now);

  /* frühere Läufe: bereits ausgezahlt, je Auszahlungstag */
  const hist = new Map<string, (typeof rows)[number][]>();
  for (const r of rows.filter((x) => x.status === "ausgezahlt")) hist.set(r.datum, [...(hist.get(r.datum) ?? []), r]);
  const histRuns = [...hist.entries()].sort((a, b) => dkey(b[0]).localeCompare(dkey(a[0])));

  return (
    <>
      <PageHead
        title="Auszahlungen"
        actions={
          <>
            <span className="ee-chip ee-chip--info" title="Bis 1. fest → am 10. · bis 15. fest → am 25.">
              Auszahlung am 10. und 25.
            </span>
            {LIVE ? (
              <button
                className="ee-btn"
                onClick={() => {
                  if (!window.confirm("Abrechnung zum heutigen Tag jetzt erstellen? (Sonst automatisch am 1. und 15.)")) return;
                  runSettlementNow((n) => toast(n ? `${n} ${n === 1 ? "Abrechnung" : "Abrechnungen"} erstellt` : "Keine festen Provisionen offen", n ? "check" : "info"));
                }}
              >
                <Icon name="euro" small /> Abrechnung jetzt erstellen
              </button>
            ) : null}
          </>
        }
      />
      <section className="ee-card ee-card--forest ee-hero ee-payrun" data-component="PayoutRun">
        <div className="ee-card__head">
          <span className="eyebrow">{runDatum ? `Aktueller Lauf · Stichtag ${stichtag} (Auszahlung in ${daysTo} ${daysTo === 1 ? "Tag" : "Tagen"})` : "Kein offener Lauf"}</span>
          <span className="eyebrow">{runDatum ? `Auszahlung am ${runDatum}` : `Nächster Stichtag ${deDate(next.stichtag).slice(0, 6)}`}</span>
        </div>
        <div className="ee-payrun__main">
          <div className="ee-daygoal__num">
            <b className="num">{eur(sum)}</b>
            <span>
              auszahlbar · {run.length - held.length} {run.length - held.length === 1 ? "MB" : "MBs"}
            </span>
          </div>
          <div className="ee-payrun__stats">
            <div>
              <b className="num">
                {released} / {run.length}
              </b>
              <span>freigegeben</span>
            </div>
            <div>
              <b className="num">{eur(waitSum)}</b>
              <span>warten auf TBK → späterer Lauf</span>
            </div>
            <div>
              <b className="num">{held.length}</b>
              <span>gehalten (IBAN fehlt)</span>
            </div>
          </div>
        </div>
        <div className="ee-today__foot">
          <p className="ee-daygoal__streak">
            <span>Nur feste Provisionen (Kunde TBK) werden ausgezahlt; Stornos werden verrechnet. Am Auszahlungstag gilt die Abrechnung automatisch als ausgezahlt.</span>
          </p>
          <div className="row" style={{ gap: 8 }}>
            {reviewable ? (
              <button
                className="ee-btn ee-btn--accent ee-btn--sm"
                onClick={() => releaseAllPayouts((r) => toast(`${r.released} freigegeben${r.skipped ? `, ${r.skipped} ohne IBAN übersprungen` : ""}`, r.released ? "check" : "info"))}
              >
                <Icon name="check" small /> Alle {reviewable} prüfbaren freigeben
              </button>
            ) : null}
            {LIVE ? (
              <a className="ee-btn ee-btn--sm" href="/api/admin/export?liste=ueberweisungen" title="Freigegebene Abrechnungen mit IBAN – wird im Protokoll festgehalten">
                <Icon name="doc" small /> Überweisungsliste (CSV)
              </a>
            ) : null}
          </div>
        </div>
      </section>
      {run.length ? <RunTable title="Abrechnungen in diesem Lauf" rows={run} /> : null}
      {others.length ? <RunTable title="Weitere offene Abrechnungen" rows={others} /> : null}
      {!open.length ? <div className="ee-empty">Noch keine Abrechnungen – die erste entsteht am 1. bzw. 15. aus den festen Provisionen.</div> : null}
      {questions.length || stornos.length ? (
        <div className="ee-grid g-2" style={{ alignItems: "start" }}>
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
          {stornos.length ? (
            <section className="ee-card" data-component="PayoutStornos">
              <div className="ee-card__head">
                <h2>Stornos in diesem Lauf</h2>
              </div>
              <div className="stack" style={{ gap: 8 }}>
                {stornos.map((x, i) => (
                  <div className="row row--between" key={x.provisionId ?? i}>
                    <span>
                      <b>{x.kunde}</b>{" "}
                      <span className="sub">
                        · {person(x.who).first} · {x.grund ?? ""}
                      </span>
                    </span>
                    <b className="num is-bad">{eur(x.betrag)}</b>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      ) : null}
      <section className="ee-card ee-card--flush" data-component="TbkList">
        <div className="ee-card__head">
          <div>
            <h2>Wartet auf TBK</h2>
            <div className="faint" style={{ fontSize: ".8rem", marginTop: 2 }}>
              Ist der Kunde nach der Montagevorbereitung TBK, werden alle Provisionen fest. Widerruf oder nicht baubar → Storno mit Grund.
            </div>
          </div>
          {byLead.length ? <span className="muted">{eur(waitSum)} · {byLead.length} {byLead.length === 1 ? "Kunde" : "Kunden"}</span> : null}
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
      <details className="ee-card ee-payhist" data-component="PayoutHistory">
        <summary>
          <h2>Frühere Läufe</h2>
          <span className="faint">{histRuns.length} {histRuns.length === 1 ? "Lauf" : "Läufe"}</span>
        </summary>
        {histRuns.length ? (
          histRuns.map(([datum, rs]) => (
            <div className="ee-payhist__run" key={datum}>
              <div className="row row--between">
                <b>Auszahlung {datum}</b>
                <b className="num is-money">{eur(rs.reduce((s, r) => s + r.betrag, 0))}</b>
              </div>
              <div className="sub">{rs.map((r) => `${person(r.who).first} ${eur(r.betrag)}`).join(" · ")}</div>
            </div>
          ))
        ) : (
          <div className="ee-empty">Noch keine ausgezahlten Läufe.</div>
        )}
      </details>
    </>
  );
}

export default function AuszahlungenView() {
  const { role } = useDashboard();
  return role === "admin" ? <AdminPayouts /> : <MyPayouts />;
}

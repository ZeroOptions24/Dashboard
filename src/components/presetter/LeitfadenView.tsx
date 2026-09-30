"use client";

import Field from "@/components/forms/Field";
import CustomerBrief from "@/components/leads/CustomerBrief";
import Icon from "@/components/ui/Icon";
import { TryChip } from "@/components/ui/Chips";
import { PageHead } from "@/components/ui/Kpi";
import { bookSlot, setLeadPreNote, setLeadVq } from "@/lib/actions";
import { bookableSlots } from "@/lib/appointments";
import { GUIDES } from "@/lib/domain";
import { fmtDay, fmtHour } from "@/lib/format";
import { inCallPool, telFull, telHref, urgencySort } from "@/lib/leads";
import { store, updateUi } from "@/lib/store";
import { useDashboard } from "@/lib/useDashboard";
import { VQ_SECTIONS, fieldVisible, heatText, vqProgress, type FormValues } from "@/lib/vq";
import type { Slot } from "@/lib/types";
import { changeStatus, openDrawer } from "@/lib/ui";

/* Prototyp: fester Closer „Leo“ – später die Closer, denen der Presetter zuarbeitet */

/** zwei Terminvorschläge an unterschiedlichen Tagen */
function twoSlots(slots: Slot[]): [Slot | undefined, Slot | undefined] {
  /* zweiter Vorschlag an einem anderen Tag – möglichst beim selben Closer (das Skript nennt einen Namen) */
  const a = slots[0],
    same = slots.filter((s) => a && s !== a && s.closer === a.closer),
    b = same.find((s) => s.date !== a.date) || same[0];
  return [a, b];
}

/** Skripttext mit hervorgehobener Anrede */
function Script({ text, anrede }: { text: string; anrede: string }) {
  const i = text.indexOf(anrede);
  if (i < 0) return <p className="ee-script">{text}</p>;
  return (
    <p className="ee-script">
      {text.slice(0, i)}
      <em>{anrede}</em>
      {text.slice(i + anrede.length)}
    </p>
  );
}

export default function LeitfadenView() {
  const { data, ui, me, now, person, toast } = useDashboard();
  const queue = data.LEADS.filter((l) => inCallPool(l, me) && l.status === "eingereicht").sort(urgencySort(now));
  const l = queue.find((x) => x.id === ui.guideLead) || queue[0];
  if (!l)
    return (
      <>
        <PageHead title="Telefonleitfaden" />
        <div className="ee-empty" data-component="EmptyState">
          <Icon name="check" />
          <h2>Alle Anrufe erledigt</h2>
          <p>Neue Leads erscheinen hier automatisch.</p>
        </div>
      </>
    );
  const g = GUIDES.wp,
    { slots, closers, paused } = bookableSlots(data.SLOTS, data.APPTS, now),
    [s1, s2] = twoSlots(slots);
  const fill = (t: string) =>
    t
      .replace("{anrede}", l.anrede)
      .replace("{me}", person(me).first)
      .replace("{setter}", person(l.setter).first)
      .replace("{closer}", person(s1?.closer ?? closers[0] ?? "").first || "unser Energieberater")
      .replace("{slot1}", s1 ? `${fmtDay(s1.date)} um ${fmtHour(s1.start)} Uhr` : "…")
      .replace("{slot2}", s2 ? `${fmtDay(s2.date)} um ${fmtHour(s2.start)} Uhr` : "…");
  const vq: FormValues = l.vq || {},
    p = vqProgress(vq);
  const byDay: Record<string, Slot[]> = {};
  slots.forEach((s) => (byDay[s.date] ??= []).push(s));
  const sel = data.SLOTS.find((s) => s.id === ui.guideSlot);
  const idx = queue.indexOf(l),
    next = queue[idx + 1];
  const secCount = (fields: (typeof VQ_SECTIONS)[number]["fields"]) => {
    const fs = fields.filter((f) => fieldVisible(f, vq));
    return `${fs.filter((f) => vq[f.n] !== undefined && vq[f.n] !== "").length}/${fs.length}`;
  };
  const pick = (id: string) => {
    updateUi({ guideLead: id, guideSlot: null });
    window.scrollTo({ top: 0 });
  };
  const book = () => {
    if (!sel) return;
    bookSlot(l, sel);
    toast(`Termin gebucht: ${fmtDay(sel.date)} ${fmtHour(sel.start)} · ${person(sel.closer).first} und ${person(l.setter).first} informiert`);
    /* weiter zum dringendsten offenen Lead */
    const nxt = store.data.LEADS.filter((x) => inCallPool(x, me) && x.status === "eingereicht" && x.id !== l.id).sort(urgencySort(now))[0];
    updateUi({ guideLead: nxt?.id ?? null, guideSlot: null });
    if (nxt) toast(`Nächster Anruf: ${nxt.kunde}`, "phone");
  };

  return (
    <>
      <PageHead
        title="Telefonleitfaden"
        actions={
          <span className="ee-chip ee-chip--info">
            {idx + 1} von {queue.length} in der Anrufliste
          </span>
        }
      />
      <section className="ee-callbar" data-component="CallBar">
        <div className="ee-callbar__who">
          <b>{l.kunde}</b>
          <span>
            {l.ort} · {l.attempts ? `${l.attempts}. Versuch` : "Erstanruf"}
          </span>
        </div>
        <a className="ee-btn ee-btn--primary" href={telHref(l)}>
          <Icon name="phone" small /> {telFull(l)}
        </a>
        <div className="ee-callbar__out">
          <button className="ee-btn ee-btn--sm" onClick={() => changeStatus(l.id, "nicht_erreicht")}>
            Nicht erreicht
          </button>
          <button className="ee-btn ee-btn--sm" onClick={() => openDrawer({ kind: "callback", id: l.id })}>
            <Icon name="clock" small /> Rückruf vereinbaren
          </button>
          <button className="ee-btn ee-btn--sm ee-btn--danger" onClick={() => changeStatus(l.id, "abgesagt")}>
            Abgesagt
          </button>
          {next && (
            <button className="ee-btn ee-btn--ghost ee-btn--sm" onClick={() => pick(next.id)}>
              Nächster <Icon name="right" small />
            </button>
          )}
        </div>
      </section>
      <div className="ee-guide" data-component="CallGuide">
        <aside className="stack ee-guide__side" style={{ gap: 14 }}>
          <section className="ee-card" data-component="CustomerInfo">
            <div className="row">
              <TryChip lead={l} now={now} />
            </div>
            <dl className="ee-facts" style={{ gridTemplateColumns: "1fr 1fr" }}>
              <div>
                <dt>Erfasst von</dt>
                <dd>
                  {person(l.setter).first} · {l.datum.slice(0, 6)}
                </dd>
              </div>
              <div>
                <dt>Versuche</dt>
                <dd>{l.attempts || "noch keiner"}</dd>
              </div>
              {l.adresse && (
                <div style={{ gridColumn: "1/-1" }}>
                  <dt>Adresse</dt>
                  <dd>{l.adresse}</dd>
                </div>
              )}
            </dl>
            {l.setNote && (
              <div className="ee-note">
                <b>Von der Tür:</b> {l.setNote}
              </div>
            )}
            <CustomerBrief lead={l} />
          </section>
          <details className="ee-card ee-queue" data-component="QueueList">
            <summary>
              <h3>Anrufliste</h3>
              <span className="ee-chip">{queue.length}</span>
            </summary>
            <div className="ee-queue__list">
              {queue.map((x) => (
                <button key={x.id} className={x.id === l.id ? "ee-queue__row is-current" : "ee-queue__row"} onClick={() => pick(x.id)}>
                  <span>
                    <b>{x.kunde}</b>
                    <small>{x.ort}</small>
                  </span>
                  <TryChip lead={x} now={now} short />
                </button>
              ))}
            </div>
          </details>
        </aside>
        <section className="ee-card ee-guide__main">
          <div className="stack" style={{ gap: 26, padding: "4px 0 0 14px" }}>
            <div className="ee-phase" data-step="1">
              <h3>Begrüßung</h3>
              <Script text={fill(g.intro)} anrede={l.anrede} />
            </div>
            <div className="ee-phase" data-step="2">
              <div className="row row--between">
                <h3>Vorqualifizierung</h3>
                <div className="ee-vq__stats ee-vq__stats--sm">
                  <div>
                    <b className="num" id="pqProgress">
                      {p.done}/{p.total}
                    </b>
                    <span>beantwortet</span>
                  </div>
                  <div>
                    <b className="num" id="pqHeat">
                      {heatText(vq as Record<string, string>)}
                    </b>
                    <span>Heizlast (Schätzung)</span>
                  </div>
                </div>
              </div>
              {p.done ? (
                <div className="ee-alert ee-alert--ok">
                  <Icon name="check" small /> {p.done} Antworten kommen schon von der Tür – nur Offenes fragen
                </div>
              ) : null}
              <form className="stack" style={{ gap: 8 }} noValidate data-component="VqForm" onSubmit={(e) => e.preventDefault()}>
                {VQ_SECTIONS.map((s, i) => (
                  <details key={`${l.id}-${s.key}`} className="ee-vqsec" open={i === 0 && !p.done ? true : undefined}>
                    <summary>
                      <span>{s.title}</span>
                      <span className="ee-vqsec__count num">{secCount(s.fields)}</span>
                    </summary>
                    <div className="ee-form">
                      {s.fields.map((f) => (
                        <Field key={f.n} f={f} values={vq} scope="pq" onChange={(n, v) => setLeadVq(l.id, n, v)} />
                      ))}
                    </div>
                  </details>
                ))}
              </form>
              <div className="ee-field">
                <label htmlFor="guideNote">Notiz für den Closer</label>
                <textarea
                  key={l.id}
                  className="ee-textarea"
                  id="guideNote"
                  placeholder="z. B. Ehefrau entscheidet mit, Heizung tropft, will vor dem Winter umsteigen"
                  defaultValue={l.preNote || ""}
                  onChange={(e) => setLeadPreNote(l.id, e.target.value)}
                />
              </div>
            </div>
            <div className="ee-phase" data-step="3">
              <h3>Einwände</h3>
              {g.objections.map(([o, a]) => (
                <details key={o} className="ee-objection">
                  <summary>{o}</summary>
                  <p>{a}</p>
                </details>
              ))}
            </div>
            <div className="ee-phase" data-step="4">
              <h3>Termin legen</h3>
              <Script text={fill(g.close)} anrede={l.anrede} />
              {paused.length > 0 && (
                <div className="ee-alert ee-alert--bad">
                  <Icon name="lock" small /> {paused.map((k) => person(k).first).join(", ")} {paused.length > 1 ? "sind" : "ist"} pausiert – offene Rückmeldungen
                </div>
              )}
              <div data-component="SlotPicker">
                {Object.keys(byDay).length ? (
                  Object.entries(byDay)
                    .slice(0, 5)
                    .map(([k, ss]) => (
                      <div key={k} className="ee-slotpick__day">
                        <b>{fmtDay(k)}</b>
                        <div className="ee-slotpick">
                          {ss.map((s) => (
                            <button key={s.id} className="ee-slotpick__btn" aria-pressed={ui.guideSlot === s.id} onClick={() => updateUi({ guideSlot: s.id })}>
                              {fmtHour(s.start)}
                              {closers.length > 1 ? ` · ${person(s.closer).first}` : ""}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))
                ) : (
                  <p className="muted">Keine freien Termine.</p>
                )}
              </div>
              <button className="ee-btn ee-btn--primary" disabled={!sel} onClick={book}>
                <Icon name="cal" small /> {sel ? `Termin ${fmtDay(sel.date)} ${fmtHour(sel.start)} eintragen` : "Termin auswählen"}
              </button>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

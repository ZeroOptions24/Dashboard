"use client";

import { useState } from "react";
import { assignSetterAction } from "@/app/actions/team";
import { reloadLeads } from "@/lib/live";
import AppointmentCard from "@/components/closer/AppointmentCard";
import CustomerBrief from "@/components/leads/CustomerBrief";
import Icon from "@/components/ui/Icon";
import { PipelineSteps, StatusChip, ToneChip } from "@/components/ui/Chips";
import { applyFeedback, guideAdvance, saveCallback, setLeadStatus, type FeedbackResult } from "@/lib/actions";
import { kindLabel, needsFeedback } from "@/lib/appointments";
import { FEEDBACK_OPTIONS, LOSS_REASONS, STATUS } from "@/lib/domain";
import { dkey, fmtDay, fmtHour, maskIban, pad } from "@/lib/format";
import { formatIban } from "@/lib/iban";
import { isLost, provFor, telFull, telHref } from "@/lib/leads";
import { ROLE_LABEL } from "@/lib/nav";
import { store, useStore, type Drawer, LIVE } from "@/lib/store";
import { callLead, changeStatus, closeOverlays, openDrawer, toast } from "@/lib/ui";
import { useDashboard } from "@/lib/useDashboard";

const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];

function DrawerHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="ee-drawer__head">
      <div>
        <h2>{title}</h2>
        {sub ? (
          <div className="muted" style={{ marginTop: 4, fontSize: ".88rem" }}>
            {sub}
          </div>
        ) : null}
      </div>
      <button className="ee-iconbtn" aria-label="Schließen" onClick={closeOverlays}>
        <Icon name="close" />
      </button>
    </div>
  );
}

/** Im Telefonleitfaden nach einer Aktion automatisch zum nächsten Anruf */
function advanceIfGuide(id: string) {
  if (store.ui.view !== "leitfaden") return;
  const next = guideAdvance(id);
  if (next) toast(`Nächster Anruf: ${next}`, "phone");
}

/** Admin: Setter für einen Deal ohne Setter in Pipedrive zuweisen (nur im Dashboard) */
function SetterAssign({ leadId, current }: { leadId: string; current: string }) {
  const { data } = useDashboard();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(current);
  const [busy, setBusy] = useState(false);
  /* Vorschläge: Setter-Namen, die im Dashboard bekannt sind */
  const names = [...new Set(Object.values(data.PEOPLE).filter((p) => p.role === "setter" && p.key !== "unbekannt").map((p) => p.first))].sort();
  if (!open)
    return (
      <button className="ee-btn ee-btn--ghost ee-btn--sm" style={{ marginLeft: 6 }} onClick={() => setOpen(true)}>
        {current ? "ändern" : "Setter zuweisen"}
      </button>
    );
  const save = async (value: string) => {
    setBusy(true);
    const res = await assignSetterAction(leadId, value);
    setBusy(false);
    if (!res.ok) return toast(res.error, "info");
    toast(value ? `Setter zugewiesen: ${value}` : "Zuweisung entfernt", "check");
    setOpen(false);
    void reloadLeads().catch(() => {});
  };
  return (
    <form
      className="row"
      style={{ gap: 6, marginTop: 6 }}
      onSubmit={(e) => {
        e.preventDefault();
        void save(name.trim());
      }}
    >
      <label className="sr" htmlFor={`assign-${leadId}`}>
        Setter (Name wie im Pipedrive-Feld)
      </label>
      <input className="ee-input" id={`assign-${leadId}`} list={`assign-names-${leadId}`} value={name} onChange={(e) => setName(e.target.value)} style={{ maxWidth: 160, minHeight: 34 }} autoFocus />
      <datalist id={`assign-names-${leadId}`}>
        {names.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
      <button className="ee-btn ee-btn--primary ee-btn--sm" type="submit" disabled={busy || !name.trim()}>
        Speichern
      </button>
      {current && (
        <button className="ee-btn ee-btn--ghost ee-btn--sm" type="button" disabled={busy} onClick={() => void save("")}>
          Entfernen
        </button>
      )}
    </form>
  );
}

/* ---------- Lead-Details ---------- */
function LeadDrawer({ id }: { id: string }) {
  const { data, role, now, person } = useDashboard();
  const l = data.LEADS.find((x) => x.id === id);
  if (!l) return null;
  const appt = data.APPTS.find((a) => a.lead === id);
  const p = provFor(l, role);
  let actions: React.ReactNode = null;
  if (role === "presetter" && STATUS[l.status].stage === 1 && !isLost(l))
    actions = (
      <div className="stack" style={{ gap: 8 }}>
        <div className="row">
          <button className="ee-btn ee-btn--sm" onClick={() => changeStatus(id, "nicht_erreicht")}>
            Nicht erreicht
          </button>
          <button className="ee-btn ee-btn--sm" onClick={() => changeStatus(id, "abgesagt")}>
            Abgesagt
          </button>
        </div>
        <a className="ee-btn ee-btn--primary" href={telHref(l)} onClick={() => callLead(id)}>
          <Icon name="phone" small /> Anrufen und Leitfaden öffnen
        </a>
      </div>
    );
  if (role === "closer") {
    const due = data.APPTS.find((a) => a.lead === id && needsFeedback(a, now));
    if (due)
      actions = (
        <button className="ee-btn ee-btn--primary" onClick={() => openDrawer({ kind: "feedback", id: due.id })}>
          <Icon name="check" small /> Rückmeldung geben
        </button>
      );
  }
  if (role === "admin")
    actions = (
      <div className="row">
        {/* TODO: Link auf den Deal, sobald die Pipedrive-Firmen-Domain feststeht (https://<firma>.pipedrive.com/deal/<id>) */}
        <button className="ee-btn" onClick={() => toast(`Würde Deal #${l.pd || "–"} in Pipedrive öffnen`, "info")}>
          <Icon name="ext" small /> In Pipedrive öffnen
        </button>
      </div>
    );
  return (
    <>
      <DrawerHead title={l.kunde} sub={l.adresse || l.ort} />
      <div className="ee-drawer__body" data-component="LeadDrawer">
        <div className="row">
          <StatusChip status={l.status} /> <PipelineSteps status={l.status} />
        </div>
        {l.reason && (
          <div className="ee-note" style={{ background: "var(--bad-soft)" }}>
            <b>Grund:</b> {l.reason}
            {l.reasonNote ? ` – ${l.reasonNote}` : ""}
          </div>
        )}
        <dl className="ee-facts">
          <div>
            <dt>Lead-ID</dt>
            <dd className="mono">{l.id}</dd>
          </div>
          <div>
            <dt>Pipedrive</dt>
            <dd className="mono">{l.pd ? `#${l.pd}` : "noch nicht angelegt"}</dd>
          </div>
          <div>
            <dt>Eingereicht</dt>
            <dd>{l.datum}</dd>
          </div>
          <div>
            <dt>Telefon</dt>
            <dd className="mono">{role === "setter" ? l.tel : telFull(l)}</dd>
          </div>
          {l.adresse && (
            <div style={{ gridColumn: "1/-1" }}>
              <dt>Adresse</dt>
              <dd>{l.adresse}</dd>
            </div>
          )}
          {l.email && (
            <div>
              <dt>E-Mail</dt>
              <dd style={{ wordBreak: "break-all" }}>{l.email}</dd>
            </div>
          )}
          {l.rueckrufWunsch && (
            <div>
              <dt>Rückrufwunsch</dt>
              <dd>{l.rueckrufWunsch}</dd>
            </div>
          )}
          <div>
            <dt>Setter</dt>
            <dd>
              {l.setter === "unbekannt" ? "– in Pipedrive leer –" : person(l.setter).name}
              {l.setterFromDashboard ? <span className="faint"> (im Dashboard zugewiesen)</span> : null}
              {LIVE && role === "admin" && /^PD-\d+$/.test(l.id) ? (
                <SetterAssign leadId={l.id} current={l.setterFromDashboard ? person(l.setter).first : ""} />
              ) : null}
            </dd>
          </div>
          <div>
            <dt>Presetter</dt>
            <dd>{l.presetter ? person(l.presetter).name : "–"}</dd>
          </div>
          <div>
            <dt>Closer</dt>
            <dd>{l.closer ? person(l.closer).name : "–"}</dd>
          </div>
          {appt && (
            <div>
              <dt>Termin</dt>
              <dd>
                {fmtDay(appt.date)} {fmtHour(appt.start)}
              </dd>
            </div>
          )}
          {l.attempts ? (
            <div>
              <dt>Anrufversuche</dt>
              <dd>
                {l.attempts}
                {l.nextTry ? ` · nächster ${l.nextTry}` : ""}
              </dd>
            </div>
          ) : null}
          {role !== "admin" && (
            <div>
              <dt>Deine Provision</dt>
              <dd>
                <span className={p.amount ? "ee-prov" : "ee-prov is-muted"}>{p.txt}</span>
              </dd>
            </div>
          )}
        </dl>
        {role !== "setter" && <CustomerBrief lead={l} />}
        {l.setNote && (
          <div className="ee-note">
            <b>Aus dem Setting:</b> {l.setNote}
          </div>
        )}
        {l.preNote && (
          <div className="ee-note">
            <b>Aus dem Presetting:</b> {l.preNote}
          </div>
        )}
        {actions}
        <div className="stack" style={{ gap: 10 }}>
          <span className="eyebrow">{LIVE ? "Verlauf (Pipedrive + Dashboard)" : "Verlauf (aus Pipedrive)"}</span>
          <ul className="ee-timeline">
            {l.hist.map(([s, t], i) => (
              <li key={i}>
                <b>{s}</b> <span className="faint">· {t}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}

/* ---------- Grund abfragen (Pflicht bei Abgesagt / Verloren) ---------- */
function ReasonDrawer({ id, status }: { id: string; status: "abgesagt" | "verloren" }) {
  const { data } = useDashboard();
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const l = data.LEADS.find((x) => x.id === id);
  if (!l) return null;
  const label = STATUS[status].label;
  return (
    <>
      <DrawerHead title={`Warum ${label.toLowerCase()}?`} sub={l.kunde} />
      <div className="ee-drawer__body">
        <form
          className="stack"
          data-component="ReasonForm"
          onSubmit={(e) => {
            e.preventDefault();
            if (!reason) return;
            toast(setLeadStatus(id, status, reason, note.trim()));
            advanceIfGuide(id);
            closeOverlays();
          }}
        >
          <fieldset className="ee-reasons">
            <legend className="lbl">Grund auswählen (Pflicht)</legend>
            {LOSS_REASONS[status].map((r, i) => (
              <label key={r} className="ee-reason">
                <input type="radio" name="reason" value={r} required={i === 0} checked={reason === r} onChange={() => setReason(r)} />
                <span>{r}</span>
              </label>
            ))}
          </fieldset>
          <div className="ee-field">
            <label htmlFor="reasonNote">Notiz (optional)</label>
            <textarea
              className="ee-textarea"
              id="reasonNote"
              placeholder="z. B. Vermieter entscheidet, Kunde meldet sich im Frühjahr"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <div className="row">
            <button className="ee-btn ee-btn--danger" type="submit">
              Als „{label}“ speichern
            </button>
            <button className="ee-btn ee-btn--ghost" type="button" onClick={closeOverlays}>
              Abbrechen
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

/* ---------- Rückruf vereinbaren ---------- */
function CallbackDrawer({ id }: { id: string }) {
  const { data, now } = useDashboard();
  const days = [...Array(10)].map((_, i) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + i)).filter((x) => x.getDay() !== 0);
  const [date, setDate] = useState(dkey(days[0]));
  const [time, setTime] = useState("18:00");
  const [note, setNote] = useState("");
  const l = data.LEADS.find((x) => x.id === id);
  if (!l) return null;
  return (
    <>
      <DrawerHead title="Rückruf vereinbaren" sub={l.kunde} />
      <div className="ee-drawer__body">
        <form
          className="stack"
          data-component="CallbackForm"
          onSubmit={(e) => {
            e.preventDefault();
            toast(`Rückruf gespeichert: ${saveCallback(id, date, time, note.trim())}`, "clock");
            closeOverlays();
            advanceIfGuide(id);
          }}
        >
          <div className="ee-form">
            <div className="ee-field">
              <label htmlFor="cbDate">Tag</label>
              <select className="ee-select" id="cbDate" value={date} onChange={(e) => setDate(e.target.value)}>
                {days.map((x) => (
                  <option key={dkey(x)} value={dkey(x)}>
                    {dkey(x) === dkey(now) ? "heute" : fmtDay(dkey(x))}
                  </option>
                ))}
              </select>
            </div>
            <div className="ee-field">
              <label htmlFor="cbTime">Uhrzeit</label>
              <select className="ee-select" id="cbTime" value={time} onChange={(e) => setTime(e.target.value)}>
                {HOURS.map((h) => (
                  <option key={h}>{`${pad(h)}:00`}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="ee-field">
            <label htmlFor="cbNote">Notiz (optional)</label>
            <input className="ee-input" id="cbNote" placeholder="z. B. Ehemann ist dann zu Hause" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <button className="ee-btn ee-btn--primary" type="submit">
            <Icon name="check" small /> Rückruf speichern
          </button>
        </form>
      </div>
    </>
  );
}

/* ---------- Pflicht-Rückmeldung des Closers ---------- */
function FeedbackDrawer({ id }: { id: string }) {
  const { data, now } = useDashboard();
  const [res, setRes] = useState<FeedbackResult | "">("");
  const [date, setDate] = useState("");
  const [hour, setHour] = useState(17);
  const [reason, setReason] = useState("");
  const [reasonErr, setReasonErr] = useState(false);
  const [note, setNote] = useState("");
  const a = data.APPTS.find((x) => x.id === id) ?? { id, lead: id.replace("LEAD:", ""), kind: "closing" as const, date: dkey(now), start: now.getHours() };
  const l = data.LEADS.find((x) => x.id === a.lead);
  if (!l) return null;
  const dates = [...Array(21)].map((_, i) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1 + i)).filter((x) => x.getDay() !== 0);
  return (
    <>
      <DrawerHead title={`Rückmeldung ${kindLabel(a)}`} sub={`${l.kunde} · ${fmtDay(a.date)} ${fmtHour(a.start)}`} />
      <div className="ee-drawer__body">
        <form
          className="stack"
          data-component="FeedbackForm"
          onSubmit={(e) => {
            e.preventDefault();
            if (!res) return;
            if (res === "verloren" && !reason) {
              setReasonErr(true);
              return toast("Bitte einen Grund wählen", "info");
            }
            toast(applyFeedback(id, res, { note: note.trim(), date: date || undefined, hour, reason }));
            closeOverlays();
          }}
        >
          <fieldset className="ee-reasons">
            <legend className="lbl">Was ist passiert?</legend>
            {FEEDBACK_OPTIONS[a.kind].map(([k, t], i) => (
              <label key={k} className={k === "verloren" ? "ee-reason ee-reason--fb is-neg" : "ee-reason ee-reason--fb"}>
                <input type="radio" name="fb" value={k} required={i === 0} checked={res === k} onChange={() => setRes(k as FeedbackResult)} />
                <span>{t}</span>
              </label>
            ))}
          </fieldset>
          <div className="ee-form" hidden={res !== "checks"}>
            <div className="ee-field">
              <label htmlFor="fbDate">2. Termin am (falls schon fest)</label>
              <select className="ee-select" id="fbDate" value={date} onChange={(e) => setDate(e.target.value)}>
                <option value="">noch offen</option>
                {dates.map((x) => (
                  <option key={dkey(x)} value={dkey(x)}>
                    {fmtDay(dkey(x))}
                  </option>
                ))}
              </select>
            </div>
            <div className="ee-field">
              <label htmlFor="fbHour">Uhrzeit</label>
              <select className="ee-select" id="fbHour" value={hour} onChange={(e) => setHour(+e.target.value)}>
                {HOURS.map((h) => (
                  <option key={h} value={h}>
                    {fmtHour(h)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="ee-field" hidden={res !== "verloren"}>
            <label htmlFor="fbReason">Grund</label>
            <select
              className={reasonErr ? "ee-select is-invalid" : "ee-select"}
              id="fbReason"
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                setReasonErr(false);
              }}
            >
              <option value="">Bitte wählen</option>
              {LOSS_REASONS.verloren.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </div>
          <div className="ee-field">
            <label htmlFor="fbNote">Notiz (optional)</label>
            <textarea className="ee-textarea" id="fbNote" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <button className="ee-btn ee-btn--primary" type="submit">
            <Icon name="check" small /> Rückmeldung speichern
          </button>
        </form>
      </div>
    </>
  );
}

/* ---------- Termin-Details (aus dem Kalender) ---------- */
function ApptDrawer({ id }: { id: string }) {
  const { data } = useDashboard();
  const a = data.APPTS.find((x) => x.id === id);
  if (!a) return null;
  return (
    <>
      <DrawerHead title="Termin" sub={`${fmtDay(a.date)} · ${fmtHour(a.start)}–${fmtHour(a.start + a.dur)}`} />
      <div className="ee-drawer__body">
        <AppointmentCard appt={a} />
      </div>
    </>
  );
}

/* ---------- Team-Mitglied (Admin, Beispieldaten) ---------- */
function TeamDrawer({ memberKey }: { memberKey: string }) {
  const { data, person } = useDashboard();
  const [iban, setIban] = useState<string | null>(null);
  const p = data.PROFILES[memberKey];
  if (!p) return null;
  return (
    <>
      <DrawerHead title={person(memberKey).name} sub={`${ROLE_LABEL[person(memberKey).role]} · seit ${p.start}`} />
      <div className="ee-drawer__body">
        <dl className="ee-facts">
          <div>
            <dt>Telefon</dt>
            <dd className="mono">{p.tel}</dd>
          </div>
          <div>
            <dt>E-Mail</dt>
            <dd>{p.mail}</dd>
          </div>
          <div>
            <dt>Adresse</dt>
            <dd>
              {p.str}, {p.plz} {p.ort}
            </dd>
          </div>
          <div>
            <dt>Geburtsdatum</dt>
            <dd>{p.geb}</dd>
          </div>
          <div>
            <dt>IBAN</dt>
            <dd className="mono" id="drawerIban">
              {iban ?? maskIban(p.iban)}
            </dd>
          </div>
          <div>
            <dt>Steuernummer</dt>
            <dd>{p.steuer}</dd>
          </div>
          <div>
            <dt>Gewerbe</dt>
            <dd>{p.gewerbe === "fehlt" ? <ToneChip label="fehlt" tone="bad" /> : p.gewerbe}</dd>
          </div>
          <div>
            <dt>Kleinunternehmer</dt>
            <dd>{p.klein ? "Ja" : "Nein"}</dd>
          </div>
        </dl>
        <div className="row">
          {/* Beispieldaten; für echte MAs läuft die Anzeige später über den Server mit Protokoll (audit_log) */}
          <button
            className="ee-btn ee-btn--sm"
            disabled={!!iban}
            onClick={() => {
              setIban(formatIban(p.iban));
              toast("IBAN angezeigt – Zugriff protokolliert", "shield");
            }}
          >
            <Icon name="eye" small /> IBAN anzeigen
          </button>
          <span className="ee-secure">
            <Icon name="shield" /> Zugriff wird protokolliert
          </span>
        </div>
        <div className="stack" style={{ gap: 8 }}>
          <span className="eyebrow">Verträge</span>
          {data.CONTRACTS.filter((c) => c.who === memberKey).length ? (
            data.CONTRACTS.filter((c) => c.who === memberKey).map((c) => (
              <div key={c.id} className="row row--between">
                <span style={{ fontSize: ".9rem" }}>{c.doc}</span>
                {c.status === "signed" ? <ToneChip label="Unterschrieben" tone="ok" /> : <ToneChip label="Offen" tone="warn" />}
              </div>
            ))
          ) : (
            <span className="muted">Keine Verträge.</span>
          )}
        </div>
        <div className="stack" style={{ gap: 8 }}>
          <span className="eyebrow">Leads (Auszug)</span>
          {data.LEADS.filter((l) => l.setter === memberKey).length ? (
            data.LEADS.filter((l) => l.setter === memberKey)
              .slice(0, 5)
              .map((l) => (
                <div key={l.id} className="row row--between">
                  <span style={{ fontSize: ".9rem" }}>
                    {l.kunde} · {l.ort}
                  </span>
                  <StatusChip status={l.status} />
                </div>
              ))
          ) : (
            <span className="muted">Keine Leads.</span>
          )}
        </div>
      </div>
    </>
  );
}

function DrawerContent({ d }: { d: Drawer }) {
  switch (d.kind) {
    case "lead":
      return <LeadDrawer id={d.id} />;
    case "reason":
      return <ReasonDrawer key={`${d.id}-${d.status}`} id={d.id} status={d.status} />;
    case "callback":
      return <CallbackDrawer key={d.id} id={d.id} />;
    case "feedback":
      return <FeedbackDrawer key={d.id} id={d.id} />;
    case "appt":
      return <ApptDrawer id={d.id} />;
    case "team":
      return <TeamDrawer key={d.key} memberKey={d.key} />;
  }
}

/** Seitenleiste rechts (Handy: von unten) */
export default function DrawerHost() {
  const { overlay } = useStore();
  return (
    <aside className={overlay.drawerOpen ? "ee-drawer is-open" : "ee-drawer"} id="drawer" data-component="Drawer" aria-hidden={!overlay.drawerOpen}>
      {overlay.drawer ? <DrawerContent d={overlay.drawer} /> : null}
    </aside>
  );
}

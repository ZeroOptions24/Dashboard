"use client";

import CustomerBrief from "@/components/leads/CustomerBrief";
import Icon from "@/components/ui/Icon";
import { ToneChip } from "@/components/ui/Chips";
import { apptEnd, feedbackDue, kindLabel, needsFeedback } from "@/lib/appointments";
import { FEEDBACK_OPTIONS } from "@/lib/domain";
import { WD, dkey, fmtDue, fmtHour, parseKey } from "@/lib/format";
import { apptStart, provFor, telFull, telHref } from "@/lib/leads";
import { useDashboard } from "@/lib/useDashboard";
import type { Appointment } from "@/lib/types";

/** „in 40 Min.“ / „heute“ / „morgen“ / „in 2 Tagen“ – nur für die nächsten 72 Std. */
export function RelWhen({ appt, now }: { appt: Appointment; now: Date }) {
  const st = apptStart(appt),
    h = (st.getTime() - now.getTime()) / 36e5;
  if (h < 0 || h > 72) return null;
  const tag = dkey(st) === dkey(now) ? "heute" : dkey(st) === dkey(new Date(now.getTime() + 864e5)) ? "morgen" : "";
  return <ToneChip label={h < 3 ? `in ${Math.max(1, Math.round(h * 60))} Min.` : tag ? tag : `in ${Math.round(h / 24)} Tagen`} tone="info" />;
}

/** Termin kompakt, Steckbrief aufklappbar. */
export default function AppointmentCard({ appt: a, open }: { appt: Appointment; open?: boolean }) {
  const { data, now, person, role, act } = useDashboard();
  const l = data.LEADS.find((x) => x.id === a.lead);
  if (!l) return null;
  const d = parseKey(a.date),
    need = needsFeedback(a, now);
  const fb = a.feedback ? FEEDBACK_OPTIONS[a.kind].find((o) => o[0] === a.feedback!.result) || [0, a.feedback.result] : null;
  const overdue = need && feedbackDue(a) < now,
    adr = a.adr || l.adresse || a.ort;
  const future = apptEnd(a) > now;
  const p = provFor(l, role);
  return (
    <article className={`ee-appt ${need ? "is-due" : ""} ${fb ? "is-done" : ""}`} data-component="AppointmentCard">
      <div className="ee-datebox">
        <span>{WD[d.getDay()]}</span>
        <b>{d.getDate()}</b>
        <small>{fmtHour(a.start)}</small>
      </div>
      <div className="stack" style={{ gap: 10, minWidth: 0 }}>
        <div className="ee-appt__head">
          <div style={{ minWidth: 0 }}>
            <h3>{l.kunde}</h3>
            <div className="faint ee-appt__adr">
              <Icon name="pin" small /> {adr}
            </div>
          </div>
          <div className="ee-appt__chips">
            <span className={a.kind === "closing" ? "ee-chip ee-chip--closing" : "ee-chip"}>{kindLabel(a)}</span>
            {future ? <RelWhen appt={a} now={now} /> : null}
          </div>
        </div>
        {need ? (
          <div className="ee-appt__due">
            <span className={overdue ? "ee-fb-due is-over" : "ee-fb-due"}>
              <Icon name="clock" small /> Rückmeldung {overdue ? "überfällig seit" : "bis"} {fmtDue(feedbackDue(a), now)}
            </span>
            <button className="ee-btn ee-btn--primary ee-btn--sm" onClick={() => act("feedback", { id: a.id })}>
              <Icon name="check" small /> Rückmeldung geben
            </button>
          </div>
        ) : fb ? (
          <div className="ee-fb-done">
            <Icon name="check" small /> {fb[1]} · {a.feedback!.at}
          </div>
        ) : null}
        {future && (
          <div className="ee-appt__actions">
            <a className="ee-btn ee-btn--sm" href={telHref(l)}>
              <Icon name="phone" small /> Anrufen
            </a>
            <a className="ee-btn ee-btn--sm" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(adr)}`} target="_blank" rel="noopener">
              <Icon name="pin" small /> Route
            </a>
          </div>
        )}
        {fb ? null : (
          <details className="ee-appt__more" open={open}>
            <summary>Steckbrief &amp; Notizen</summary>
            <div className="stack" style={{ gap: 10, paddingTop: 10 }}>
              <CustomerBrief lead={l} />
              <dl className="ee-facts">
                <div>
                  <dt>Telefon</dt>
                  <dd className="mono">{telFull(l)}</dd>
                </div>
                <div>
                  <dt>Setter / Presetter</dt>
                  <dd>
                    {person(l.setter).first} / {person(l.presetter ?? "").first}
                  </dd>
                </div>
                <div>
                  <dt>Deine Provision</dt>
                  <dd>
                    <span className={p.amount ? "ee-prov" : "ee-prov is-muted"}>{p.txt}</span>
                  </dd>
                </div>
              </dl>
              {l.setNote && (
                <div className="ee-note">
                  <b>Setting:</b> {l.setNote}
                </div>
              )}
              {l.preNote && (
                <div className="ee-note">
                  <b>Presetting:</b> {l.preNote}
                </div>
              )}
            </div>
          </details>
        )}
      </div>
    </article>
  );
}

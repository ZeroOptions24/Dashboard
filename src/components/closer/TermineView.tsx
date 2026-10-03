"use client";

import AppointmentCard from "@/components/closer/AppointmentCard";
import Icon from "@/components/ui/Icon";
import { StatusChip } from "@/components/ui/Chips";
import { EppOpen } from "@/components/leads/EppBox";
import { PageHead } from "@/components/ui/Kpi";
import { apptEnd, closerPaused, needsFeedback } from "@/lib/appointments";
import { apptStart } from "@/lib/leads";
import { useDashboard } from "@/lib/useDashboard";
import { openDrawer } from "@/lib/ui";

export default function TermineView() {
  const { data, me, now, openLead } = useDashboard();
  /* Vormerkungen (noch nicht bestätigt) erscheinen nur im Kalender als „reserviert“ */
  const mine = data.APPTS.filter((a) => a.closer === me && !a.reserved).sort((a, b) => apptStart(a).getTime() - apptStart(b).getTime());
  const due = mine.filter((a) => needsFeedback(a, now)),
    up = mine.filter((a) => apptEnd(a) > now),
    done = mine.filter((a) => a.feedback).reverse();
  /* Nach dem Aufmaß nur noch im EPP arbeiten – hier der Überblick mit EPP-ID; Ergebnis von Hand, bis der EPP-Abgleich steht */
  const inEpp = data.LEADS.filter((l) => l.closer === me && ["checks", "verkaufstermin"].includes(l.status));
  const openClosing = (id: string) => data.APPTS.some((a) => a.lead === id && a.kind === "closing" && !a.feedback);
  return (
    <>
      <PageHead title="Termine · Eigenleads" />
      {closerPaused(data.APPTS, me, now) && (
        <div className="ee-alert ee-alert--bad">
          <Icon name="lock" small /> Deine Slots sind für neue Leads pausiert, bis alle Rückmeldungen erledigt sind.
        </div>
      )}
      {due.length ? (
        <div className="stack">
          <h2 className="is-bad">Rückmeldung offen ({due.length})</h2>
          <div className="ee-grid g-2">
            {due.map((a) => (
              <AppointmentCard key={a.id} appt={a} />
            ))}
          </div>
        </div>
      ) : null}
      {inEpp.length ? (
        <section className="ee-card ee-card--flush" data-component="EppList">
          <div className="ee-card__head">
            <div>
              <h2>Weiter im Enpal-Partnerportal ({inEpp.length})</h2>
              <div className="faint" style={{ fontSize: ".8rem", marginTop: 2 }}>
                Nach dem Aufmaß arbeitest du nur noch im EPP. Bis der Stand automatisch kommt: Verkaufstermin oder Ergebnis hier kurz eintragen.
              </div>
            </div>
          </div>
          <div className="ee-table-wrap">
            <table className="ee-table ee-table--stack">
              <tbody>
                {inEpp.map((l) => (
                  <tr key={l.id}>
                    <td>
                      <button className="ee-link who" onClick={() => openLead(l.id)}>
                        {l.kunde}
                      </button>
                      <div className="sub">
                        {[l.ort, l.eppId ? `EPP ${l.eppId}` : "EPP-ID fehlt", `seit ${l.hist[0][1].split(" ")[0]}`].filter(Boolean).join(" · ")}
                      </div>
                    </td>
                    <td>
                      <StatusChip status={l.status} />
                    </td>
                    <td className="r" data-span="">
                      <div className="row" style={{ gap: 6, justifyContent: "flex-end" }}>
                        {l.eppId ? <EppOpen id={l.eppId} /> : null}
                        {!openClosing(l.id) && (
                          <button className="ee-btn ee-btn--sm" onClick={() => openDrawer({ kind: "feedback", id: `LEAD:${l.id}` })}>
                            <Icon name="check" small /> Ergebnis eintragen
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
      <div className="stack">
        <h2>Anstehend ({up.length})</h2>
        <div className="ee-grid g-2">
          {up.map((a, i) => (
            <AppointmentCard key={a.id} appt={a} open={i === 0} />
          ))}
        </div>
      </div>
      {done.length ? (
        <div className="stack">
          <h2>Erledigt</h2>
          <div className="ee-grid g-2">
            {done.map((a) => (
              <AppointmentCard key={a.id} appt={a} />
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}

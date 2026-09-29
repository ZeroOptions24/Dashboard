"use client";

import AppointmentCard from "@/components/closer/AppointmentCard";
import Icon from "@/components/ui/Icon";
import { PageHead } from "@/components/ui/Kpi";
import { apptEnd, closerPaused, needsFeedback } from "@/lib/appointments";
import { apptStart } from "@/lib/leads";
import { useDashboard } from "@/lib/useDashboard";

export default function TermineView() {
  const { data, me, now, act } = useDashboard();
  const mine = data.APPTS.filter((a) => a.closer === me).sort((a, b) => apptStart(a).getTime() - apptStart(b).getTime());
  const due = mine.filter((a) => needsFeedback(a, now)),
    up = mine.filter((a) => apptEnd(a) > now),
    done = mine.filter((a) => a.feedback).reverse();
  const inChecks = data.LEADS.filter(
    (l) => l.closer === me && l.status === "checks" && !data.APPTS.some((a) => a.lead === l.id && a.kind === "closing" && !a.feedback),
  );
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
      {inChecks.length ? (
        <section className="ee-card ee-card--flush" data-component="ChecksList">
          <div className="ee-card__head">
            <h2>In den Checks ({inChecks.length})</h2>
          </div>
          <div className="ee-table-wrap">
            <table className="ee-table ee-table--stack">
              <tbody>
                {inChecks.map((l) => (
                  <tr key={l.id}>
                    <td>
                      <div className="who">{l.kunde}</div>
                      <div className="sub">
                        {l.ort} · seit {l.hist[0][1].split(" ")[0]}
                      </div>
                    </td>
                    <td className="r" data-span="">
                      <button className="ee-btn ee-btn--sm" onClick={() => act("feedback", { id: `LEAD:${l.id}` })}>
                        <Icon name="check" small /> Ergebnis eintragen
                      </button>
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

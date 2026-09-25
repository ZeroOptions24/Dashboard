import Icon from "@/components/ui/Icon";
import { AgeBadge, TryChip } from "@/components/ui/Chips";
import { fmtDay, fmtHour, eur } from "@/lib/format";
import { apptStart, isOverdue, provFor } from "@/lib/leads";
import type { Appointment, Lead, Person, Role } from "@/lib/types";

interface Ctx {
  now: Date;
  role: Role;
  appts: Appointment[];
  person: (k: string) => Person;
}

/** Nächster Schritt je Lead in Klartext. */
function NextStep({ lead: l, now, appts, person }: { lead: Lead } & Omit<Ctx, "role">) {
  const day = (i: number) => l.hist[i][1].split(" ")[0];
  if (l.status === "eingereicht" && !l.attempts && !l.nextTry) return <AgeBadge lead={l} now={now} />;
  if (l.status === "eingereicht") return <TryChip lead={l} now={now} />;
  if (l.status === "termin") {
    const appt = appts.filter((a) => a.lead === l.id).sort((a, b) => apptStart(b).getTime() - apptStart(a).getTime())[0];
    if (!appt) return null;
    return (
      <span className="ee-lcard__when">
        <Icon name="cal" small /> {fmtDay(appt.date)} {fmtHour(appt.start)}
        {appt.closer ? ` · ${person(appt.closer).first}` : ""}
      </span>
    );
  }
  if (l.status === "checks") {
    const c = appts.find((a) => a.lead === l.id && a.kind === "closing" && !a.feedback);
    return c ? (
      <span className="ee-lcard__when">
        <Icon name="cal" small /> 2. Termin {fmtDay(c.date)} {fmtHour(c.start)}
      </span>
    ) : (
      <span className="ee-lcard__when">
        <Icon name="clock" small /> in den Checks seit {day(0)}
      </span>
    );
  }
  if (l.status === "verkauft")
    return (
      <span className="ee-lcard__when is-good">
        <Icon name="check" small /> verkauft {day(0)} · Auszahlung 15.10.
      </span>
    );
  if (l.status === "ausgezahlt")
    return (
      <span className="ee-lcard__when is-good">
        <Icon name="euro" small /> ausgezahlt {day(0)}
      </span>
    );
  return null;
}

export default function LeadCard({ lead: l, onOpen, ...ctx }: { lead: Lead; onOpen: (id: string) => void } & Ctx) {
  const p = provFor(l, ctx.role);
  return (
    <button className="ee-lcard" data-component="LeadCard" onClick={() => onOpen(l.id)}>
      <div className="ee-lcard__top">
        <b>{l.kunde}</b>
        {isOverdue(l, ctx.now) && <i className="ee-dot is-bad" title="Überfällig" />}
      </div>
      <div className="ee-lcard__sub">
        {l.ort}
        {ctx.role !== "setter" ? ` · ${ctx.person(l.setter).first}` : ""}
      </div>
      <div className="ee-lcard__next">
        <NextStep lead={l} now={ctx.now} appts={ctx.appts} person={ctx.person} />
      </div>
      {ctx.role !== "admin" && (
        <div className="ee-lcard__prov">
          <span className={p.amount ? "ee-prov" : "ee-prov is-muted"}>{p.amount ? `+${eur(p.amount)} möglich` : p.txt}</span>
        </div>
      )}
    </button>
  );
}

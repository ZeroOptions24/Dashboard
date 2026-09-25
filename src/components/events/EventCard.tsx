"use client";

import Icon from "@/components/ui/Icon";
import { ToneChip } from "@/components/ui/Chips";
import { MON, WD, parseKey } from "@/lib/format";
import { useDashboard } from "@/lib/useDashboard";
import type { TeamEvent } from "@/lib/types";

export default function EventCard({ event: e }: { event: TeamEvent }) {
  const { me, role, person, act } = useDashboard();
  const d = parseKey(e.date);
  const going = e.going.includes(me);
  return (
    <article className={e.isNew ? "ee-event is-new" : "ee-event"} data-component="EventCard">
      <div className="ee-datebox">
        <span>{MON[d.getMonth()]}</span>
        <b>{d.getDate()}</b>
        <small>{WD[d.getDay()]}</small>
      </div>
      <div className="stack" style={{ gap: 8, minWidth: 0 }}>
        <div className="row">
          <span className="ee-tag">{e.type}</span>
          <span className="ee-tag">für {e.target}</span>
          {e.isNew && <ToneChip label="Neu" tone="info" />}
        </div>
        <h3>{e.title}</h3>
        <div className="faint" style={{ fontSize: ".84rem" }}>
          <Icon name="clock" small /> {e.time} {" "} <Icon name="pin" small /> {e.ort}
        </div>
        {e.desc && (
          <p className="muted" style={{ fontSize: ".9rem" }}>
            {e.desc}
          </p>
        )}
        <div className="row row--between">
          <span className="faint" style={{ fontSize: ".8rem" }}>
            {e.going.length} Zusagen
          </span>
          {role === "admin" ? (
            <span className="faint" style={{ fontSize: ".8rem" }}>
              gepostet von {person(e.by).first}
            </span>
          ) : (
            <button className={going ? "ee-btn ee-btn--sm ee-btn--primary" : "ee-btn ee-btn--sm"} onClick={() => act("event-going", { id: e.id })}>
              {going ? (
                <>
                  <Icon name="check" small /> Zugesagt
                </>
              ) : (
                "Zusagen"
              )}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

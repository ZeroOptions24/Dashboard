"use client";

import { useState } from "react";
import Icon from "@/components/ui/Icon";
import { setEppId } from "@/lib/actions";
import { AFTER_TERMIN } from "@/lib/domain";
import { isLost } from "@/lib/leads";
import type { Lead, Role } from "@/lib/types";
import { useDashboard } from "@/lib/useDashboard";

/* Enpal-Partnerportal (Ablauf A20): Nach der Terminbestätigung legt der Presetter den Kunden im EPP an,
   überträgt ihn an den Closer und trägt die EPP-ID hier ein. Ab den Checks arbeitet der Closer nur noch im EPP.
   „Im EPP öffnen“ erscheint, sobald NEXT_PUBLIC_EPP_URL gesetzt ist (z. B. https://…/kunden/{id}). */

const EPP_URL = process.env.NEXT_PUBLIC_EPP_URL ?? "";
export const eppHref = (id: string) => (EPP_URL ? EPP_URL.replace("{id}", encodeURIComponent(id)) : "");

/** Wer die EPP-ID pflegt */
const canEdit = (role: Role) => role === "presetter" || role === "closer" || role === "admin";

export function EppOpen({ id }: { id: string }) {
  const href = eppHref(id);
  if (!href) return null;
  return (
    <a className="ee-btn ee-btn--sm" href={href} target="_blank" rel="noopener">
      <Icon name="ext" small /> Im EPP öffnen
    </a>
  );
}

export default function EppBox({ lead: l }: { lead: Lead }) {
  const { role, toast } = useDashboard();
  const [edit, setEdit] = useState(false);
  const [val, setVal] = useState(l.eppId ?? "");
  const relevant = AFTER_TERMIN.includes(l.status) && !isLost(l);
  if (!l.eppId && !(relevant && canEdit(role))) return null;
  if (l.eppId && !edit)
    return (
      <div className="ee-eppbox" data-component="EppLink">
        <div>
          <span className="eyebrow">Enpal-Partnerportal</span>
          <b className="mono">{l.eppId}</b>
          <span className="faint">{["checks", "verkaufstermin"].includes(l.status) ? "Stand bitte im EPP prüfen – der Closer arbeitet dort weiter" : "Kunde ist im EPP angelegt"}</span>
        </div>
        <div className="row" style={{ gap: 6 }}>
          <EppOpen id={l.eppId} />
          {canEdit(role) && (
            <button className="ee-btn ee-btn--ghost ee-btn--sm" onClick={() => setEdit(true)}>
              Ändern
            </button>
          )}
        </div>
      </div>
    );
  return (
    <form
      className="ee-eppbox is-todo"
      data-component="EppForm"
      onSubmit={(e) => {
        e.preventDefault();
        const v = val.trim();
        if (!v && !l.eppId) return;
        setEppId(l.id, v);
        toast(v ? `EPP-ID ${v} gespeichert – der Closer wird informiert` : "EPP-ID entfernt");
        setEdit(false);
      }}
    >
      <div className="stack" style={{ gap: 6, flex: 1, minWidth: 0 }}>
        <span className="eyebrow">Enpal-Partnerportal</span>
        {!l.eppId && <span>Kunden im EPP anlegen, einmal an den Closer übertragen und die EPP-ID hier eintragen.</span>}
        <div className="row" style={{ gap: 8 }}>
          <input className="ee-input mono" aria-label="EPP-ID" placeholder="EPP-ID, z. B. 48170" value={val} onChange={(e) => setVal(e.target.value)} style={{ maxWidth: 220 }} />
          <button className="ee-btn ee-btn--primary ee-btn--sm" type="submit">
            Speichern
          </button>
          {edit && (
            <button className="ee-btn ee-btn--ghost ee-btn--sm" type="button" onClick={() => setEdit(false)}>
              Abbrechen
            </button>
          )}
        </div>
      </div>
    </form>
  );
}

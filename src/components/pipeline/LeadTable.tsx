"use client";

import { PipelineSteps, StatusChip } from "@/components/ui/Chips";
import { provFor } from "@/lib/leads";
import { useStore } from "@/lib/store";
import type { Lead, Person } from "@/lib/types";

export interface LeadListCtx {
  onOpen: (id: string) => void;
  person: (k: string) => Person;
}

export const clickableRow = (open: () => void) => ({
  className: "is-click",
  tabIndex: 0,
  onClick: open,
  onKeyDown: (e: React.KeyboardEvent) => {
    if (e.key === "Enter") open();
  },
});

/* ---------- LeadTable (Listenansicht) ---------- */
export default function LeadTable({ leads, showSetter, ...ctx }: { leads: Lead[]; showSetter: boolean } & LeadListCtx) {
  const role = useStore().ui.role;
  if (!leads.length) return <div className="ee-empty">Keine Leads für diesen Filter.</div>;
  const showProv = role !== "admin";
  return (
    <div className="ee-table-wrap">
      <table className="ee-table ee-table--stack" data-component="LeadTable">
        <thead>
          <tr>
            <th>Kunde</th>
            <th>Status</th>
            <th>Pipeline</th>
            {showSetter && <th>Setter</th>}
            {showProv && <th>Deine Provision</th>}
            <th>Eingereicht</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((l) => {
            const p = provFor(l, role);
            return (
              <tr key={l.id} {...clickableRow(() => ctx.onOpen(l.id))}>
                <td>
                  <div className="who">{l.kunde}</div>
                  <div className="sub">{l.ort}</div>
                </td>
                <td className="r-sm">
                  <StatusChip status={l.status} />
                  {l.reason && (
                    <div className="sub" style={{ marginTop: 3 }}>
                      {l.reason}
                    </div>
                  )}
                </td>
                <td data-hide-sm="">
                  <PipelineSteps status={l.status} />
                </td>
                {showSetter && <td data-hide-sm="">{ctx.person(l.setter).first}</td>}
                {showProv && (
                  <td>
                    <span className={p.amount ? "ee-prov" : "ee-prov is-muted"}>{p.txt}</span>
                  </td>
                )}
                <td className="sub num">{l.datum.slice(0, 6)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}


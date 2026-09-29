import { heatEstimate } from "@/lib/vq";
import type { Lead } from "@/lib/types";

/** Kundeninfos aus Setting + Vorqualifizierung für Presetter und Closer. */
export default function CustomerBrief({ lead: l }: { lead: Lead }) {
  const q = l.vq || {};
  const h = heatEstimate(q);
  const f = (
    [
      ["Wohnfläche", q.wohnflaeche && `${q.wohnflaeche} m²`],
      ["Baujahr", q.baujahr_haus],
      [
        "Heizung",
        q.heizungsart &&
          `${q.heizungsart}${q.heizung_baujahr ? " · Bj. " + q.heizung_baujahr : ""}${q.heizungsart_2 && q.heizungsart_2 !== "Keine" ? " + " + q.heizungsart_2 : ""}`,
      ],
      ["Verteilung", q.heizverteilung],
      ["Heizlast", h && `≈ ${h.toLocaleString("de-DE")} kW`],
      ["Eigentümer", q.eigentuemer],
    ] as [string, string | null | undefined][]
  ).filter((x): x is [string, string] => !!x[1]);
  const all = l.entscheider?.startsWith("Ja");
  if (!f.length && !l.entscheider) return null;
  return (
    <div className="ee-brief" data-component="CustomerBrief">
      {l.entscheider && (
        <div className="row">
          <span className={all ? "ee-chip ee-chip--pos" : "ee-chip ee-chip--warn"}>{all ? "Alle Entscheider dabei" : "Nicht alle Entscheider dabei"}</span>
        </div>
      )}
      {f.length ? (
        <dl className="ee-brief__grid">
          {f.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}

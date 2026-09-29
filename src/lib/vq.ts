/* Vorqualifizierung (Wärmepumpe): grobe Heizlast-Schätzung – ersetzt keine Heizlastberechnung. */

export function heatEstimate(vq: Record<string, string | undefined>): number | null {
  const a = +(vq.wohnflaeche ?? 0),
    bj = +(vq.baujahr_haus ?? 0);
  if (!a || !bj) return null;
  let wpm2 = bj < 1978 ? 120 : bj < 1995 ? 90 : bj < 2002 ? 70 : bj < 2016 ? 50 : 35;
  if (vq.fassade_gedaemmt === "Ja") wpm2 *= 0.85;
  if (vq.dach_gedaemmt === "Ja") wpm2 *= 0.9;
  if (String(vq.fenster || "").startsWith("3")) wpm2 *= 0.9;
  if (vq.fenster === "Einfachverglasung") wpm2 *= 1.15;
  return Math.round((a * wpm2) / 100) / 10;
}

export const heatText = (vq: Record<string, string | undefined>) => {
  const h = heatEstimate(vq);
  return h ? `≈ ${h.toLocaleString("de-DE")} kW` : "–";
};

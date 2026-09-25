/* Formatierung von Datum, Uhrzeit und Beträgen (deutsch). */

export const WD = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

export const pad = (n: number) => String(n).padStart(2, "0");

/** Date → „JJJJ-MM-TT“ */
export const dkey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** „JJJJ-MM-TT“ → Date (lokale Zeit) */
export const parseKey = (k: string) => {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d);
};

/** „JJJJ-MM-TT“ → „Do, 24.09.“ */
export const fmtDay = (k: string) => {
  const d = parseKey(k);
  return `${WD[d.getDay()]}, ${pad(d.getDate())}.${pad(d.getMonth() + 1)}.`;
};

/** 14.5 → „14:30“ */
export const fmtHour = (h: number) => `${pad(Math.floor(h))}:${h % 1 ? "30" : "00"}`;

export const eur = (n: number) =>
  n.toLocaleString("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: n % 1 ? 2 : 0 });

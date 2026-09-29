/* Formatierung von Datum, Uhrzeit und Beträgen (deutsch). */

/** „TT.MM. hh:mm“ für Verlaufseinträge */
export const nowStamp = (n: Date) => `${pad(n.getDate())}.${pad(n.getMonth() + 1)}. ${pad(n.getHours())}:${pad(n.getMinutes())}`;

export const WD = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
export const MON = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

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

/** Frist-Zeitpunkt: „heute 14:00“ bzw. „Do 24.09. 14:00“ */
export const fmtDue = (d: Date, now: Date) =>
  `${dkey(d) === dkey(now) ? "heute" : `${WD[d.getDay()]} ${pad(d.getDate())}.${pad(d.getMonth() + 1)}.`} ${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** „DE•• •••• •••• 3000“ */
export const maskIban = (iban: string) => {
  const c = iban.replace(/\s/g, "");
  return `${c.slice(0, 2)}•• •••• •••• ${c.slice(-4)}`;
};

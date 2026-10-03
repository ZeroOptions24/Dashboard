/* Abrechnungsrhythmus (Tims Ablauf A12): Stichtag 1. → Auszahlung am 10., Stichtag 15. → Auszahlung am 25. */

/** Nächster Stichtag (1. oder 15.) und zugehöriger Auszahlungstag ab „today“ (Mitternacht, deutsche Zeit) */
export function nextRun(today: Date) {
  const d = today.getDate();
  const stichtag =
    d <= 1 ? new Date(today.getFullYear(), today.getMonth(), 1) : d <= 15 ? new Date(today.getFullYear(), today.getMonth(), 15) : new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const zahltag = new Date(stichtag.getFullYear(), stichtag.getMonth(), stichtag.getDate() === 1 ? 10 : 25);
  return { stichtag, zahltag };
}

const pad = (n: number) => String(n).padStart(2, "0");
export const deDate = (d: Date) => `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;

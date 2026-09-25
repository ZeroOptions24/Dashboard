/* IBAN-Prüfung (Prüfsumme nach ISO 13616, Modulo 97) – im Browser und auf dem Server nutzbar. */

export const normalizeIban = (iban: string) => iban.replace(/\s+/g, "").toUpperCase();

export function isValidIban(input: string): boolean {
  const iban = normalizeIban(input);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  if (iban.startsWith("DE") && iban.length !== 22) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  const digits = rearranged.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  let rest = 0;
  for (const d of digits) rest = (rest * 10 + Number(d)) % 97;
  return rest === 1;
}

/** „DE89 3704 0044 0532 0130 00“ */
export const formatIban = (iban: string) => normalizeIban(iban).replace(/(.{4})/g, "$1 ").trim();

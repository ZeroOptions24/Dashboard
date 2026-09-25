/* Ranglisten: gleiche Werte teilen sich den Platz. */

import type { Board, PersonKey } from "./types";

export interface RankRow {
  key: PersonKey;
  val: number;
  rank: number;
}

export function ranked(rows: [PersonKey, number][]): RankRow[] {
  const s = rows.slice().sort((a, b) => b[1] - a[1]);
  let last: number | null = null,
    rank = 0;
  return s.map(([key, val], i) => {
    if (val !== last) {
      rank = i + 1;
      last = val;
    }
    return { key, val, rank };
  });
}

export const rankOf = (k: PersonKey, board: Board): RankRow | { key: PersonKey; rank: "–"; val: 0 } =>
  ranked(board.rows).find((r) => r.key === k) || { key: k, rank: "–", val: 0 };

/** Einfärbung von Kennzahlen: ≥ 15 % besser als der Vergleich = good, ≥ 15 % schlechter = bad. */
export function perfTone(value: number, bench: number | undefined, higherIsBetter = true): "" | "good" | "bad" {
  if (!bench) return "";
  const r = higherIsBetter ? value / bench : bench / value;
  return r >= 1.15 ? "good" : r <= 0.85 ? "bad" : "";
}

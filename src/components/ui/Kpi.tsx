import type { ReactNode } from "react";

/** Kennzahl-Kachel. tone: money (Geld, grün) · good · bad · leer */
export function Kpi({ label, value, meta, tone }: { label: string; value: ReactNode; meta?: ReactNode; tone?: string }) {
  return (
    <div className={tone ? `ee-kpi ee-kpi--${tone}` : "ee-kpi"} data-component="KpiTile">
      <div className="ee-kpi__label">{label}</div>
      <div className="ee-kpi__value">{value}</div>
      {meta ? <div className="ee-kpi__meta">{meta}</div> : null}
    </div>
  );
}

/** Vergleich mit dem Teamschnitt als Klartext: ▲ 6 über Teamschnitt (23) */
export function VsTeam({ v, bench, unit = "", higherIsBetter = true }: { v: number; bench: number; unit?: string; higherIsBetter?: boolean }) {
  const diff = Math.round((v - bench) * 10) / 10;
  const better = higherIsBetter ? diff >= 0 : diff <= 0;
  if (!diff) return <>genau im Teamschnitt ({bench}{unit})</>;
  return (
    <>
      <span className={better ? "is-good" : "is-bad"}>
        {diff > 0 ? "▲" : "▼"} {Math.abs(diff).toLocaleString("de-DE")}
        {unit} {diff > 0 ? "über" : "unter"}
      </span>{" "}
      Teamschnitt ({bench}
      {unit})
    </>
  );
}

export function PageHead({ title, actions }: { title: string; actions?: ReactNode }) {
  return (
    <div className="ee-pagehead">
      <h1>{title}</h1>
      {actions ? <div className="row">{actions}</div> : null}
    </div>
  );
}

"use client";

import { ToneChip } from "@/components/ui/Chips";
import { Kpi, PageHead } from "@/components/ui/Kpi";
import { releasePayout } from "@/lib/actions";
import { PAYOUT_STATUS } from "@/lib/domain";
import { eur, maskIban } from "@/lib/format";
import { useDashboard } from "@/lib/useDashboard";

const ROLE_LABEL: Record<string, string> = { setter: "Setter", presetter: "Presetter", closer: "Closer", admin: "Admin" };

/** Status einer Position: fest · offen · storno · vorlaeufig:TT.MM. */
function PostenState({ st }: { st: string }) {
  if (!st || st === "fest") return <ToneChip label="Fest" tone="ok" />;
  if (st === "offen") return <ToneChip label="Stand offen" tone="" />;
  if (st === "storno") return <ToneChip label="Storno" tone="bad" />;
  if (st.startsWith("vorlaeufig")) return <ToneChip label={`Vorläufig bis ${st.split(":")[1]}`} tone="info" />;
  return null;
}

function AdminPayouts() {
  const { data, person, toast } = useDashboard();
  const rows = Object.entries(data.PAYOUTS).flatMap(([who, ps]) => ps.map((p) => ({ ...p, who })));
  const open = rows.filter((r) => r.status !== "ausgezahlt");
  return (
    <>
      <PageHead title="Auszahlungen" />
      <div className="ee-grid g-kpi">
        <Kpi label="In Prüfung" value={open.filter((r) => r.status === "pruefung").length} />
        <Kpi label="Freigegeben" value={eur(open.filter((r) => r.status === "freigegeben").reduce((s, r) => s + r.betrag, 0))} tone="money" />
        <Kpi label="Summe offen" value={eur(open.reduce((s, r) => s + r.betrag, 0))} meta="Auszug" tone="money" />
      </div>
      <section className="ee-card ee-card--flush" data-component="PayoutTable">
        <div className="ee-card__head">
          <h2>Abrechnungen</h2>
        </div>
        <div className="ee-table-wrap">
          <table className="ee-table ee-table--stack">
            <thead>
              <tr>
                <th>MB</th>
                <th>Zeitraum</th>
                <th>Status</th>
                <th className="r">Betrag</th>
                <th className="r">Aktion</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div className="who">{person(r.who).name}</div>
                    <div className="sub">
                      {ROLE_LABEL[person(r.who).role]} · <span className="mono">{r.ibanLast4 ? `•••• ${r.ibanLast4}` : maskIban(data.PROFILES[r.who]?.iban ?? "")}</span>
                    </div>
                  </td>
                  <td className="sub">{r.periode}</td>
                  <td>
                    <ToneChip label={PAYOUT_STATUS[r.status].label} tone={PAYOUT_STATUS[r.status].tone} />
                  </td>
                  <td className="r num">
                    <b className="is-money">{eur(r.betrag)}</b>
                  </td>
                  <td className="r" data-span="">
                    {r.status === "pruefung" ? (
                      <button
                        className="ee-btn ee-btn--primary ee-btn--sm"
                        onClick={() => {
                          const p = releasePayout(r.who, r.id);
                          if (p) toast(`${p.periode} für ${person(r.who).first} freigegeben`);
                        }}
                      >
                        Freigeben
                      </button>
                    ) : (
                      <span className="faint">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

export default function AuszahlungenView() {
  const { data, role, me } = useDashboard();
  if (role === "admin") return <AdminPayouts />;
  const P = data.PAYOUTS[me] || [],
    cur = P[0];
  if (!cur)
    return (
      <>
        <PageHead title="Auszahlungen" />
        <div className="ee-empty">Noch keine Abrechnungen.</div>
      </>
    );
  const paidList = P.filter((p) => p.status === "ausgezahlt");
  const paid = paidList.reduce((s, p) => s + p.betrag, 0);
  const vorl = cur.posten.filter((x) => String(x[4]).startsWith("vorlaeufig")).reduce((s, x) => s + x[3], 0);
  const iban = data.PROFILES[me]?.iban;
  const ibanText = cur.ibanLast4 ? `•••• ${cur.ibanLast4}` : iban ? maskIban(iban) : "–";
  const st = PAYOUT_STATUS[cur.status];
  return (
    <>
      <PageHead title="Auszahlungen" />
      <div className="ee-grid g-kpi">
        <Kpi label="Aktueller Monat" value={eur(cur.betrag)} meta={st.label} tone="money" />
        {vorl ? <Kpi label="Davon vorläufig" value={eur(vorl)} meta="bis Storno-Frist" tone="money" /> : null}
        <Kpi label="Ausgezahlt 2026" value={eur(paid)} meta={`${paidList.length} Abrechnungen`} tone="money" />
        <Kpi
          label="Nächste Auszahlung"
          value={cur.datum}
          meta={
            <>
              auf <span className="mono">{ibanText}</span>
            </>
          }
        />
      </div>
      <section className="ee-card ee-card--flush" data-component="PayoutTable">
        <div className="ee-card__head">
          <h2>{cur.periode} · Positionen</h2>
          <ToneChip label={st.label} tone={st.tone} />
        </div>
        <div className="ee-table-wrap">
          <table className="ee-table ee-table--stack">
            <thead>
              <tr>
                <th>Datum</th>
                <th>Kunde / Anlass</th>
                <th>Status</th>
                <th className="r">Betrag</th>
              </tr>
            </thead>
            <tbody>
              {cur.posten.map(([d, k, a, b, s], i) => (
                <tr key={i}>
                  <td className="sub num" data-hide-sm="">
                    {d}
                  </td>
                  <td>
                    <div className="who">{k}</div>
                    <div className="sub">{a}</div>
                  </td>
                  <td>
                    <PostenState st={s} />
                  </td>
                  <td className="r num">
                    <b className={b < 0 ? "is-neg" : "is-money"}>{eur(b)}</b>
                  </td>
                </tr>
              ))}
              <tr>
                <td data-hide-sm="" />
                <td className="who">Summe (vorläufig)</td>
                <td data-hide-sm="" />
                <td className="r num">
                  <b className="is-money">{eur(cur.betrag)}</b>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
      <section className="ee-card ee-card--flush">
        <div className="ee-card__head">
          <h2>Verlauf</h2>
        </div>
        <div className="ee-table-wrap">
          <table className="ee-table ee-table--stack">
            <thead>
              <tr>
                <th>Abrechnung</th>
                <th>Zeitraum</th>
                <th>Auszahlung</th>
                <th>Status</th>
                <th className="r">Betrag</th>
              </tr>
            </thead>
            <tbody>
              {P.map((p) => (
                <tr key={p.id}>
                  <td className="mono faint" data-hide-sm="">
                    {p.id}
                  </td>
                  <td className="who">{p.periode}</td>
                  <td className="sub num">{p.datum}</td>
                  <td>
                    <ToneChip label={PAYOUT_STATUS[p.status].label} tone={PAYOUT_STATUS[p.status].tone} />
                  </td>
                  <td className="r num">
                    <b className="is-money">{eur(p.betrag)}</b>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

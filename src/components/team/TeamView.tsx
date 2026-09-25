"use client";

import { useCallback, useEffect, useState } from "react";
import { inviteMemberAction, listOnboardingAction, onboardingStepAction, runRemindersAction, setPipedriveNameAction } from "@/app/actions/onboarding";
import { clickableRow } from "@/components/pipeline/LeadTable";
import Icon from "@/components/ui/Icon";
import { ToneChip } from "@/components/ui/Chips";
import { PageHead } from "@/components/ui/Kpi";
import { useDashboard } from "@/lib/useDashboard";
import type { OnboardingRow, OnboardingStatus } from "@/server/onboarding";

const ROLE_LABEL: Record<string, string> = { setter: "Setter", presetter: "Presetter", closer: "Closer", admin: "Admin" };

const STATUS: Record<OnboardingStatus, { label: string; tone: string; next: string }> = {
  eingeladen: { label: "Eingeladen", tone: "info", next: "wartet auf Daten" },
  daten_erfasst: { label: "Daten erfasst", tone: "warn", next: "Vertrag senden" },
  vertrag_versendet: { label: "Vertrag versendet", tone: "info", next: "wartet auf Unterschrift" },
  unterschrieben: { label: "Unterschrieben", tone: "info", next: "legt Passwort fest" },
  aktiv: { label: "Aktiv", tone: "ok", next: "" },
  zurueckgezogen: { label: "Zurückgezogen", tone: "", next: "" },
};

type Step = "resend" | "contract" | "access" | "direct" | "withdraw";

/* ---------- Neuen MA einladen ---------- */
function InviteForm({ onDone }: { onDone: () => void }) {
  const { toast } = useDashboard();
  const [f, setF] = useState({ name: "", email: "", telefon: "", role: "setter" as "setter" | "presetter" | "closer" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <section className="ee-card" data-component="InviteForm">
      <h2>Neuen MA einladen</h2>
      <form
        className="stack"
        style={{ marginTop: 14 }}
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          const res = await inviteMemberAction(f);
          setBusy(false);
          if (!res.ok) return setError(res.error);
          toast(`${f.name.split(" ")[0]} eingeladen – Formular-Link ist per E-Mail raus`, "send");
          setF({ name: "", email: "", telefon: "", role: f.role });
          onDone();
        }}
      >
        <div className="ee-field">
          <label htmlFor="invName">Vor- und Nachname</label>
          <input className="ee-input" id="invName" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="z. B. Jana Lehmann" />
        </div>
        <div className="ee-field">
          <label htmlFor="invMail">E-Mail</label>
          <input className="ee-input" id="invMail" type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="name@beispiel.de" />
        </div>
        <div className="ee-field">
          <label htmlFor="invTel">Telefon (WhatsApp, optional)</label>
          <input className="ee-input" id="invTel" type="tel" value={f.telefon} onChange={(e) => setF({ ...f, telefon: e.target.value })} placeholder="0170 1234567" />
        </div>
        <div className="ee-field">
          <label htmlFor="invRole">Rolle</label>
          <select className="ee-select" id="invRole" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as typeof f.role })}>
            <option value="setter">Setter</option>
            <option value="presetter">Presetter</option>
            <option value="closer">Closer</option>
          </select>
        </div>
        <p className="ee-hint">Ablauf: Formular für die Stammdaten → Vertrag zur Unterschrift → Zugang mit eigenem Passwort.</p>
        {error && <div className="ee-alert ee-alert--bad">{error}</div>}
        <button className="ee-btn ee-btn--primary" type="submit" disabled={busy}>
          <Icon name="send" small /> Einladung senden
        </button>
      </form>
    </section>
  );
}

/* ---------- Pipedrive-Setter-Name (Zuordnung der Leads) ---------- */
function PipedriveName({ row, onSaved }: { row: OnboardingRow; onSaved: () => void }) {
  const { toast } = useDashboard();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(row.pipedriveSetterName ?? "");
  if (!editing)
    return (
      <span className="ee-list__sub">
        Pipedrive-Setter: <b>{row.pipedriveSetterName || "– nicht hinterlegt –"}</b>{" "}
        <button className="ee-btn ee-btn--ghost ee-btn--sm" onClick={() => setEditing(true)} aria-label="Pipedrive-Namen ändern">
          <Icon name="edit" small />
        </button>
      </span>
    );
  return (
    <form
      className="row"
      style={{ gap: 6 }}
      onSubmit={async (e) => {
        e.preventDefault();
        const res = await setPipedriveNameAction(row.userId, value);
        if (!res.ok) return toast(res.error, "info");
        toast("Pipedrive-Zuordnung gespeichert");
        setEditing(false);
        onSaved();
      }}
    >
      <label className="sr" htmlFor={`pd-${row.userId}`}>
        Name im Pipedrive-Feld „Setter“
      </label>
      <input className="ee-input" id={`pd-${row.userId}`} value={value} onChange={(e) => setValue(e.target.value)} style={{ maxWidth: 180, minHeight: 34 }} autoFocus />
      <button className="ee-btn ee-btn--primary ee-btn--sm" type="submit">
        Speichern
      </button>
      <button className="ee-btn ee-btn--ghost ee-btn--sm" type="button" onClick={() => setEditing(false)}>
        Abbrechen
      </button>
    </form>
  );
}

/* ---------- Onboarding-Übersicht (echte Daten aus der Datenbank) ---------- */
function OnboardingList({
  rows,
  onStep,
  busy,
  onReload,
}: {
  rows: OnboardingRow[] | null;
  onStep: (id: string, s: Step) => void;
  busy: string | null;
  onReload: () => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  if (!rows) return <div className="ee-empty">Lade …</div>;
  const visible = rows.filter((r) => r.role !== "admin");
  if (!visible.length) return <div className="ee-empty">Noch niemand eingeladen.</div>;
  const btn = (r: OnboardingRow, step: Step, label: string, primary = false) => (
    <button className={primary ? "ee-btn ee-btn--primary ee-btn--sm" : "ee-btn ee-btn--sm"} disabled={busy === r.userId} onClick={() => onStep(r.userId, step)}>
      {label}
    </button>
  );
  return (
    <div className="ee-list">
      {visible.map((r) => {
        const s = STATUS[r.status];
        const expanded = open === r.userId;
        return (
          <div key={r.userId} className="ee-list__row" style={{ flexWrap: "wrap", alignItems: "flex-start" }}>
            <div className="ee-list__main" style={{ minWidth: 200 }}>
              <div className="ee-list__title">
                {r.name} <span className="faint">· {ROLE_LABEL[r.role] || r.role}</span>
              </div>
              <div className="ee-list__sub">
                {r.email}
                {s.next ? ` · ${s.next}` : ""}
                {r.formLinkExpired ? " · Link abgelaufen" : ""}
                {r.remindersSent ? ` · ${r.remindersSent}× erinnert` : ""}
              </div>
              {r.role === "setter" && r.status !== "zurueckgezogen" && <PipedriveName row={r} onSaved={onReload} />}
            </div>
            <ToneChip label={s.label} tone={r.formLinkExpired ? "bad" : s.tone} />
            <div className="row" style={{ width: "100%", justifyContent: "flex-end", gap: 6 }}>
              {r.status === "eingeladen" && btn(r, "resend", "Link erneut senden")}
              {r.status === "daten_erfasst" && (
                <button className="ee-btn ee-btn--sm" onClick={() => setOpen(expanded ? null : r.userId)}>
                  {expanded ? "Daten ausblenden" : "Daten prüfen"}
                </button>
              )}
              {r.status === "daten_erfasst" && btn(r, "contract", "Vertrag senden", true)}
              {r.status === "unterschrieben" && btn(r, "access", "Zugangs-Link erneut senden")}
              {["eingeladen", "daten_erfasst", "vertrag_versendet"].includes(r.status) && btn(r, "direct", "Direkt freischalten")}
              {!["aktiv", "zurueckgezogen"].includes(r.status) && btn(r, "withdraw", "Zurückziehen")}
            </div>
            {expanded && r.status === "daten_erfasst" && r.data && (
              <dl className="ee-facts" style={{ width: "100%" }}>
                <div>
                  <dt>Adresse</dt>
                  <dd>{r.data.adresse}</dd>
                </div>
                <div>
                  <dt>Geburtsdatum</dt>
                  <dd>{r.data.geburtsdatum}</dd>
                </div>
                <div>
                  <dt>IBAN</dt>
                  <dd className="mono">{r.data.iban}</dd>
                </div>
                <div>
                  <dt>Kontoinhaber</dt>
                  <dd>{r.data.kontoinhaber}</dd>
                </div>
                <div>
                  <dt>Steuernummer</dt>
                  <dd>{r.data.steuernummer || "–"}</dd>
                </div>
                <div>
                  <dt>Gewerbe · Kleinunternehmer</dt>
                  <dd>
                    {r.data.gewerbe ? "ja" : "nein"} · {r.data.kleinunternehmer ? "ja" : "nein"}
                  </dd>
                </div>
              </dl>
            )}
          </div>
        );
      })}
    </div>
  );
}

const CONFIRM: Partial<Record<Step, string>> = {
  direct: "Formular und Vertrag überspringen und direkt den Zugang senden? Nur für MAs mit bereits unterschriebenem Vertrag.",
  withdraw: "Einladung zurückziehen? Alle Links werden ungültig und der Zugang gesperrt.",
};
const DONE: Record<Step, string> = {
  resend: "Neuer Formular-Link gesendet",
  contract: "Vertrag zur Unterschrift gesendet",
  access: "Zugangs-Link erneut gesendet",
  direct: "Zugang freigeschaltet – Link zum Passwort ist raus",
  withdraw: "Einladung zurückgezogen",
};

/* ---------- Team (Beispieldaten aus dem Prototyp) ---------- */
function DemoTeamTable() {
  const { data, person, act } = useDashboard();
  const { TEAM, PROFILES, CONTRACTS, LEADS, BOARD } = data;
  const leadsOf = (k: string) => LEADS.filter((l) => l.setter === k).length;
  const cupOf = (k: string) => (BOARD.rows.find((r) => r[0] === k) || [0, 0])[1];
  return (
    <section className="ee-card ee-card--flush" data-component="TeamTable">
      <div className="ee-card__head">
        <h2>Team ({TEAM.length})</h2>
        <span className="ee-chip">Beispieldaten</span>
      </div>
      <div className="ee-table-wrap">
        <table className="ee-table ee-table--stack">
          <thead>
            <tr>
              <th>Name</th>
              <th>Rolle</th>
              <th className="r">Leads</th>
              <th className="r">Cup</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {TEAM.map((t) => {
              const p = PROFILES[t.key],
                openC = CONTRACTS.some((c) => c.who === t.key && c.status === "open");
              return (
                <tr key={t.key} {...clickableRow(() => act("team-row", { key: t.key }))}>
                  <td>
                    <div className="row" style={{ gap: 10, flexWrap: "nowrap" }}>
                      <div className="ee-avatar">{person(t.key).initials}</div>
                      <div>
                        <div className="who">{person(t.key).name}</div>
                        <div className="sub">seit {p.start}</div>
                      </div>
                    </div>
                  </td>
                  <td data-hide-sm="">{ROLE_LABEL[person(t.key).role]}</td>
                  <td className="r num" data-hide-sm="">
                    {leadsOf(t.key)}
                  </td>
                  <td className="r num" data-hide-sm="">
                    {cupOf(t.key)}
                  </td>
                  <td className="r-sm">
                    {t.status === "onboarding" ? (
                      <ToneChip label="Onboarding" tone="info" />
                    ) : openC ? (
                      <ToneChip label="Vertrag offen" tone="warn" />
                    ) : (
                      <ToneChip label="Aktiv" tone="ok" />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function TeamView() {
  const { toast } = useDashboard();
  const [rows, setRows] = useState<OnboardingRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await listOnboardingAction();
    if (res.ok) setRows(res.data);
    else setError(res.error);
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Daten beim Öffnen der Ansicht laden
    void load();
  }, [load]);

  async function step(userId: string, s: Step) {
    if (CONFIRM[s] && !window.confirm(CONFIRM[s])) return;
    setBusy(userId);
    const res = await onboardingStepAction(userId, s);
    setBusy(null);
    if (!res.ok) return toast(res.error, "info");
    toast(DONE[s], s === "withdraw" ? "close" : "send");
    void load();
  }

  async function reminders() {
    const res = await runRemindersAction();
    if (!res.ok) return toast(res.error, "info");
    const { formReminders, accessResent, stuck } = res.data;
    const n = formReminders.length + accessResent.length;
    toast(n || stuck.length ? `${n} Erinnerung(en) gesendet${stuck.length ? ` · ${stuck.length} Fall/Fälle an Admins gemeldet` : ""}` : "Nichts zu erinnern", "bell");
    void load();
  }

  return (
    <>
      <PageHead title="Team & Setter" />
      <div className="ee-grid g-main" style={{ alignItems: "start" }}>
        <section className="ee-card" data-component="OnboardingList">
          <div className="ee-card__head">
            <h2>Neue MAs · Onboarding</h2>
            <div className="row" style={{ gap: 6 }}>
              {rows && <span className="ee-chip">{rows.filter((r) => r.role !== "admin" && !["aktiv", "zurueckgezogen"].includes(r.status)).length} offen</span>}
              <button className="ee-btn ee-btn--ghost ee-btn--sm" onClick={reminders} title="Läuft sonst täglich automatisch">
                <Icon name="bell" small /> Erinnerungen prüfen
              </button>
            </div>
          </div>
          {error ? <div className="ee-alert ee-alert--bad">{error}</div> : <OnboardingList rows={rows} onStep={step} busy={busy} onReload={load} />}
        </section>
        <InviteForm onDone={load} />
      </div>
      <DemoTeamTable />
    </>
  );
}

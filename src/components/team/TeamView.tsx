"use client";

import { useCallback, useEffect, useState } from "react";
import { inviteMemberAction, listOnboardingAction, onboardingStepAction, runRemindersAction, setPipedriveNameAction } from "@/app/actions/onboarding";
import {
  deleteMemberAction,
  importMembersAction,
  memberDetailsAction,
  previewImportAction,
  revealIbanAction,
  setBannedAction,
  updateMemberAction,
} from "@/app/actions/team";
import Icon from "@/components/ui/Icon";
import { ToneChip } from "@/components/ui/Chips";
import { PageHead } from "@/components/ui/Kpi";
import { ALL_ROLES, ROLE_NAMES } from "@/lib/roles";
import { useDashboard } from "@/lib/useDashboard";
import type { Role } from "@/lib/types";
import type { OnboardingRow, OnboardingStatus } from "@/server/onboarding";
import type { ImportLine, MemberDetails } from "@/server/team";

const STATUS: Record<OnboardingStatus, { label: string; tone: string; next: string }> = {
  eingeladen: { label: "Eingeladen", tone: "info", next: "wartet auf Daten" },
  daten_erfasst: { label: "Daten erfasst", tone: "warn", next: "Vertrag senden" },
  vertrag_versendet: { label: "Vertrag versendet", tone: "info", next: "wartet auf Unterschrift" },
  unterschrieben: { label: "Unterschrieben", tone: "info", next: "legt Passwort fest" },
  aktiv: { label: "Aktiv", tone: "ok", next: "" },
  zurueckgezogen: { label: "Zurückgezogen", tone: "", next: "" },
};

type Step = "resend" | "contract" | "access" | "direct" | "withdraw";

/* ---------- Rollen-Auswahl (mehrere möglich) ---------- */
function RolePicker({ value, onChange, idPrefix }: { value: Role[]; onChange: (r: Role[]) => void; idPrefix: string }) {
  return (
    <fieldset className="ee-field">
      <legend className="lbl">Rollen</legend>
      <div className="ee-opts ee-opts--cols">
        {ALL_ROLES.map((r) => (
          <label key={r} className="ee-opt">
            <input
              type="checkbox"
              id={`${idPrefix}-${r}`}
              checked={value.includes(r)}
              onChange={(e) => onChange(e.target.checked ? [...value, r] : value.filter((x) => x !== r))}
            />
            <span>{ROLE_NAMES[r]}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

const RoleChips = ({ roles }: { roles: Role[] }) => (
  <span className="row" style={{ gap: 4, display: "inline-flex" }}>
    {roles.map((r) => (
      <span key={r} className={r === "admin" ? "ee-chip ee-chip--closing" : "ee-chip"}>
        {ROLE_NAMES[r]}
      </span>
    ))}
  </span>
);

/* ---------- Neuen MA einladen ---------- */
function InviteForm({ onDone }: { onDone: () => void }) {
  const { toast } = useDashboard();
  const [f, setF] = useState({ name: "", email: "", telefon: "", roles: ["setter"] as Role[], skipContract: false });
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
          setF({ name: "", email: "", telefon: "", roles: f.roles, skipContract: false });
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
        <RolePicker value={f.roles} onChange={(roles) => setF({ ...f, roles })} idPrefix="inv" />
        <label className="ee-check">
          <input type="checkbox" checked={f.skipContract} onChange={(e) => setF({ ...f, skipContract: e.target.checked })} />
          <span>Hat schon einen Vertrag – nach der Datenerfassung direkt Zugang</span>
        </label>
        <p className="ee-hint">Ablauf: Formular für die Stammdaten → {f.skipContract ? "" : "Vertrag zur Unterschrift → "}Zugang mit eigenem Passwort.</p>
        {error && <div className="ee-alert ee-alert--bad">{error}</div>}
        <button className="ee-btn ee-btn--primary" type="submit" disabled={busy}>
          <Icon name="send" small /> Einladung senden
        </button>
      </form>
    </section>
  );
}

/* ---------- Bestehende MAs übernehmen (Liste einfügen) ---------- */
function ImportCard({ onDone }: { onDone: () => void }) {
  const { toast } = useDashboard();
  const [text, setText] = useState("");
  const [skip, setSkip] = useState(true);
  const [preview, setPreview] = useState<ImportLine[] | null>(null);
  const [result, setResult] = useState<{ name: string; ok: boolean; message: string }[] | null>(null);
  const [busy, setBusy] = useState(false);
  const valid = preview?.filter((l) => !l.error).length ?? 0;
  return (
    <section className="ee-card" data-component="ImportCard">
      <h2>Bestehende MAs übernehmen</h2>
      <p className="muted" style={{ fontSize: ".88rem", margin: "6px 0 12px" }}>
        Eine Zeile je Person: <span className="mono">Name – E-Mail – Rollen</span> (z. B. „Setter, Presetter, Closer“ oder „admin, alle Rollen“). Jede Person bekommt das
        Formular für ihre Stammdaten und danach ihren Zugang.
      </p>
      <div className="stack" style={{ gap: 10 }}>
        <textarea
          className="ee-textarea"
          aria-label="Liste der MAs"
          rows={6}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setPreview(null);
            setResult(null);
          }}
          placeholder={"Vorname Nachname – name@beispiel.de – Setter, Presetter\n…"}
        />
        <label className="ee-check">
          <input type="checkbox" checked={skip} onChange={(e) => setSkip(e.target.checked)} />
          <span>Haben schon einen Vertrag – Vertragsschritt überspringen</span>
        </label>
        {preview && (
          <div className="ee-list">
            {preview.map((l, i) => (
              <div key={i} className="ee-list__row">
                <div className="ee-list__main">
                  <div className="ee-list__title">{l.name || l.line}</div>
                  <div className="ee-list__sub">{l.email || "–"}</div>
                </div>
                {l.error ? <ToneChip label={l.error} tone="bad" /> : <RoleChips roles={l.roles} />}
              </div>
            ))}
          </div>
        )}
        {result && (
          <div className="ee-list">
            {result.map((r, i) => (
              <div key={i} className="ee-list__row">
                <div className="ee-list__main">
                  <div className="ee-list__title">{r.name}</div>
                </div>
                <ToneChip label={r.message} tone={r.ok ? "ok" : "bad"} />
              </div>
            ))}
          </div>
        )}
        <div className="row">
          <button
            className="ee-btn"
            disabled={!text.trim() || busy}
            onClick={async () => {
              const res = await previewImportAction(text);
              if (res.ok) setPreview(res.data);
              else toast(res.error, "info");
            }}
          >
            Vorschau
          </button>
          <button
            className="ee-btn ee-btn--primary"
            disabled={!preview || !valid || busy}
            onClick={async () => {
              if (!window.confirm(`${valid} Person(en) einladen? Jede bekommt eine E-Mail mit dem Formular-Link.`)) return;
              setBusy(true);
              const res = await importMembersAction(text, skip);
              setBusy(false);
              if (!res.ok) return toast(res.error, "info");
              setResult(res.data);
              setPreview(null);
              toast(`${res.data.filter((r) => r.ok).length} von ${res.data.length} eingeladen`, "send");
              onDone();
            }}
          >
            <Icon name="send" small /> {valid ? `${valid} einladen` : "Einladen"}
          </button>
        </div>
      </div>
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

/* ---------- Details (Stammdaten, IBAN mit Protokoll) ---------- */
function MemberDetailsBox({ userId }: { userId: string }) {
  const { toast } = useDashboard();
  const [d, setD] = useState<MemberDetails | null>(null);
  const [iban, setIban] = useState<string | null>(null);
  useEffect(() => {
    let off = false;
    memberDetailsAction(userId).then((res) => !off && res.ok && setD(res.data));
    return () => {
      off = true;
    };
  }, [userId]);
  if (!d) return <div className="ee-empty">Lade …</div>;
  return (
    <div className="stack" style={{ gap: 8, width: "100%" }}>
      <dl className="ee-facts">
        <div>
          <dt>Telefon</dt>
          <dd className="mono">{d.telefon || "–"}</dd>
        </div>
        <div>
          <dt>Geburtsdatum</dt>
          <dd>{d.geburtsdatum || "–"}</dd>
        </div>
        <div>
          <dt>Adresse</dt>
          <dd>{d.adresse || "–"}</dd>
        </div>
        <div>
          <dt>IBAN</dt>
          <dd className="mono">{iban ?? (d.ibanMasked || "–")}</dd>
        </div>
        <div>
          <dt>Kontoinhaber</dt>
          <dd>{d.kontoinhaber || "–"}</dd>
        </div>
        <div>
          <dt>Steuernummer</dt>
          <dd>{d.steuernummer || "–"}</dd>
        </div>
        <div>
          <dt>Gewerbe · Kleinunternehmer</dt>
          <dd>
            {d.gewerbe ? "ja" : "nein"} · {d.kleinunternehmer ? "ja" : "nein"}
          </dd>
        </div>
        <div>
          <dt>Zwei-Faktor</dt>
          <dd>{d.twoFactor ? "eingerichtet" : "nicht eingerichtet"}</dd>
        </div>
      </dl>
      {d.ibanMasked && (
        <div className="row">
          <button
            className="ee-btn ee-btn--sm"
            disabled={!!iban}
            onClick={async () => {
              const res = await revealIbanAction(userId);
              if (!res.ok) return toast(res.error, "info");
              setIban(res.data);
              toast("IBAN angezeigt – Zugriff protokolliert", "shield");
            }}
          >
            <Icon name="eye" small /> IBAN anzeigen
          </button>
          <span className="ee-secure">
            <Icon name="shield" /> Zugriff wird protokolliert
          </span>
        </div>
      )}
    </div>
  );
}

/* ---------- Bearbeiten ---------- */
function EditForm({ row, onDone, onCancel }: { row: OnboardingRow; onDone: () => void; onCancel: () => void }) {
  const { toast } = useDashboard();
  const [f, setF] = useState({ name: row.name, email: row.email, roles: row.roles });
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="stack"
      style={{ gap: 10, width: "100%" }}
      onSubmit={async (e) => {
        e.preventDefault();
        const res = await updateMemberAction(row.userId, f);
        if (!res.ok) return setError(res.error);
        toast("Gespeichert");
        onDone();
      }}
    >
      <div className="ee-form" style={{ padding: 0 }}>
        <div className="ee-field">
          <label htmlFor={`en-${row.userId}`}>Name</label>
          <input className="ee-input" id={`en-${row.userId}`} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </div>
        <div className="ee-field">
          <label htmlFor={`ee-${row.userId}`}>E-Mail</label>
          <input className="ee-input" id={`ee-${row.userId}`} type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        </div>
      </div>
      <RolePicker value={f.roles} onChange={(roles) => setF({ ...f, roles })} idPrefix={`er-${row.userId}`} />
      {error && <div className="ee-alert ee-alert--bad">{error}</div>}
      <div className="row">
        <button className="ee-btn ee-btn--primary ee-btn--sm" type="submit">
          Speichern
        </button>
        <button className="ee-btn ee-btn--ghost ee-btn--sm" type="button" onClick={onCancel}>
          Abbrechen
        </button>
      </div>
    </form>
  );
}

/* ---------- Team-Liste (echte Nutzer) ---------- */
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

function MemberRow({ r, onReload }: { r: OnboardingRow; onReload: () => void }) {
  const { toast } = useDashboard();
  const [open, setOpen] = useState<null | "details" | "edit" | "check">(null);
  const [busy, setBusy] = useState(false);
  const s = STATUS[r.status];
  const run = async (fn: () => Promise<{ ok: boolean; error?: string }>, done: string, icon: "send" | "close" | "check" = "send") => {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (!res.ok) return toast(res.error ?? "Fehler", "info");
    toast(done, icon);
    onReload();
  };
  const step = (st: Step) => {
    if (CONFIRM[st] && !window.confirm(CONFIRM[st])) return;
    run(() => onboardingStepAction(r.userId, st), DONE[st], st === "withdraw" ? "close" : "send");
  };
  const btn = (label: string, onClick: () => void, cls = "ee-btn ee-btn--sm") => (
    <button className={cls} disabled={busy} onClick={onClick}>
      {label}
    </button>
  );
  const active = r.status === "aktiv";
  return (
    <div className="ee-list__row" style={{ flexWrap: "wrap", alignItems: "flex-start" }} data-member={r.email}>
      <div className="ee-list__main" style={{ minWidth: 220 }}>
        <div className="ee-list__title">{r.name}</div>
        <div className="ee-list__sub">
          {r.email}
          {s.next && !r.banned ? ` · ${r.status === "daten_erfasst" && r.skipContract ? "bekommt Zugang" : s.next}` : ""}
          {r.formLinkExpired ? " · Link abgelaufen" : ""}
          {r.remindersSent ? ` · ${r.remindersSent}× erinnert` : ""}
        </div>
        <div style={{ marginTop: 6 }}>
          <RoleChips roles={r.roles} />
        </div>
        {r.roles.includes("setter") && r.status !== "zurueckgezogen" && <PipedriveName row={r} onSaved={onReload} />}
      </div>
      {r.banned ? <ToneChip label="Gesperrt" tone="bad" /> : <ToneChip label={s.label} tone={r.formLinkExpired ? "bad" : s.tone} />}
      <div className="row" style={{ width: "100%", justifyContent: "flex-end", gap: 6 }}>
        {!r.banned && r.status === "eingeladen" && btn("Link erneut senden", () => step("resend"))}
        {!r.banned && r.status === "daten_erfasst" && btn(open === "check" ? "Daten ausblenden" : "Daten prüfen", () => setOpen(open === "check" ? null : "check"))}
        {!r.banned && r.status === "daten_erfasst" && btn("Vertrag senden", () => step("contract"), "ee-btn ee-btn--primary ee-btn--sm")}
        {!r.banned && r.status === "unterschrieben" && btn("Zugangs-Link erneut senden", () => step("access"))}
        {!r.banned && ["eingeladen", "daten_erfasst", "vertrag_versendet"].includes(r.status) && btn("Direkt freischalten", () => step("direct"))}
        {!r.banned && !["aktiv", "zurueckgezogen"].includes(r.status) && btn("Zurückziehen", () => step("withdraw"))}
        {active && btn(open === "details" ? "Details zu" : "Details", () => setOpen(open === "details" ? null : "details"))}
        {btn("Bearbeiten", () => setOpen(open === "edit" ? null : "edit"))}
        {active &&
          btn(r.banned ? "Entsperren" : "Sperren", () => {
            if (!r.banned && !window.confirm(`${r.name} sperren? Alle Sitzungen enden sofort.`)) return;
            run(() => setBannedAction(r.userId, !r.banned), r.banned ? "Entsperrt" : "Gesperrt", r.banned ? "check" : "close");
          })}
        {btn(
          "Löschen",
          () => {
            if (!window.confirm(`${r.name} und alle Daten (Stammdaten, Bankverbindung, Zugang) endgültig löschen? Das kann nicht rückgängig gemacht werden.`)) return;
            run(() => deleteMemberAction(r.userId), "Gelöscht", "close");
          },
          "ee-btn ee-btn--ghost ee-btn--sm",
        )}
      </div>
      {open === "details" && <MemberDetailsBox userId={r.userId} />}
      {open === "edit" && (
        <EditForm
          row={r}
          onCancel={() => setOpen(null)}
          onDone={() => {
            setOpen(null);
            onReload();
          }}
        />
      )}
      {open === "check" && r.data && (
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
}

export default function TeamView() {
  const { toast } = useDashboard();
  const [rows, setRows] = useState<OnboardingRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"alle" | "offen" | "aktiv">("alle");

  const load = useCallback(async () => {
    const res = await listOnboardingAction();
    if (res.ok) setRows(res.data);
    else setError(res.error);
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Daten beim Öffnen der Ansicht laden
    void load();
  }, [load]);

  async function reminders() {
    const res = await runRemindersAction();
    if (!res.ok) return toast(res.error, "info");
    const { formReminders, accessResent, stuck } = res.data;
    const n = formReminders.length + accessResent.length;
    toast(n || stuck.length ? `${n} Erinnerung(en) gesendet${stuck.length ? ` · ${stuck.length} Fall/Fälle an Admins gemeldet` : ""}` : "Nichts zu erinnern", "bell");
    void load();
  }

  const isOpen = (r: OnboardingRow) => !["aktiv", "zurueckgezogen"].includes(r.status);
  const list = (rows ?? []).filter((r) => filter === "alle" || (filter === "offen" ? isOpen(r) : r.status === "aktiv"));
  const count = (k: typeof filter) => (rows ?? []).filter((r) => k === "alle" || (k === "offen" ? isOpen(r) : r.status === "aktiv")).length;

  return (
    <>
      <PageHead title="Team & Setter" />
      <div className="ee-grid g-main" style={{ alignItems: "start" }}>
        <section className="ee-card" data-component="TeamList">
          <div className="ee-card__head">
            <h2>Team{rows ? ` (${rows.length})` : ""}</h2>
            <button className="ee-btn ee-btn--ghost ee-btn--sm" onClick={reminders} title="Läuft sonst täglich automatisch">
              <Icon name="bell" small /> Erinnerungen prüfen
            </button>
          </div>
          <div className="ee-filters">
            {(
              [
                ["alle", "Alle"],
                ["offen", "Onboarding offen"],
                ["aktiv", "Aktiv"],
              ] as [typeof filter, string][]
            ).map(([k, l]) => (
              <button key={k} className="ee-filter" aria-pressed={filter === k} onClick={() => setFilter(k)}>
                {l}
                <span className="c">{count(k)}</span>
              </button>
            ))}
          </div>
          {error ? (
            <div className="ee-alert ee-alert--bad">{error}</div>
          ) : !rows ? (
            <div className="ee-empty">Lade …</div>
          ) : list.length ? (
            <div className="ee-list">
              {list.map((r) => (
                <MemberRow key={r.userId} r={r} onReload={load} />
              ))}
            </div>
          ) : (
            <div className="ee-empty">Niemand in dieser Auswahl.</div>
          )}
        </section>
        <div className="stack" style={{ gap: 18 }}>
          <InviteForm onDone={load} />
          <ImportCard onDone={load} />
        </div>
      </div>
    </>
  );
}

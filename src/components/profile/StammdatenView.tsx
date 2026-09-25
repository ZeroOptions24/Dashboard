"use client";

import { useCallback, useEffect, useState } from "react";
import { getMyProfileAction, revealMyIbanAction, updateMyProfileAction } from "@/app/actions/profile";
import Icon from "@/components/ui/Icon";
import { PageHead } from "@/components/ui/Kpi";
import { formatIban } from "@/lib/iban";
import { useDashboard } from "@/lib/useDashboard";
import type { MyProfile, ProfileErrors, ProfileUpdate } from "@/server/profile";

const ROLE_LABEL: Record<string, string> = { setter: "Setter", presetter: "Presetter", closer: "Closer", admin: "Admin" };

const toUpdate = (p: MyProfile): ProfileUpdate => ({
  telefon: p.telefon,
  strasse: p.strasse,
  plz: p.plz,
  ort: p.ort,
  iban: "",
  kontoinhaber: p.kontoinhaber,
  steuernummer: p.steuernummer,
  kleinunternehmer: p.kleinunternehmer,
  gewerbeAngemeldet: p.gewerbeAngemeldet,
});

export default function StammdatenView() {
  const { toast } = useDashboard();
  const [p, setP] = useState<MyProfile | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [edit, setEdit] = useState<ProfileUpdate | null>(null);
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [iban, setIban] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await getMyProfileAction();
    if (res.ok) setP(res.data);
    else setLoadError(res.error);
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Daten beim Öffnen der Ansicht laden
    void load();
  }, [load]);

  if (loadError) return <div className="ee-alert ee-alert--bad">{loadError}</div>;
  if (!p) return <div className="ee-empty">Lade …</div>;

  const ed = !!edit;
  const set = <K extends keyof ProfileUpdate>(k: K, v: ProfileUpdate[K]) => {
    setEdit((x) => (x ? { ...x, [k]: v } : x));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };
  /** Feld: im Lesemodus schreibgeschützt, im Bearbeiten-Modus änderbar (nur Felder aus ProfileUpdate) */
  const field = (id: string, label: string, value: string, opts: { full?: boolean; type?: string; key?: keyof ProfileUpdate; readOnly?: boolean } = {}) => {
    const editable = ed && opts.key && !opts.readOnly;
    const err = opts.key ? errors[opts.key] : undefined;
    return (
      <div className={opts.full ? "ee-field ee-field--full" : "ee-field"}>
        <label htmlFor={id}>{label}</label>
        <input
          className={err ? "ee-input is-invalid" : "ee-input"}
          id={id}
          type={opts.type || "text"}
          value={editable ? String(edit![opts.key!] ?? "") : value}
          readOnly={!editable}
          onChange={editable ? (e) => set(opts.key!, e.target.value as never) : undefined}
        />
        {err && <span className="ee-hint ee-hint--err">{err}</span>}
      </div>
    );
  };

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!edit) return;
    setBusy(true);
    const res = await updateMyProfileAction(edit);
    setBusy(false);
    if (!res.ok) {
      setErrors(res.errors);
      if ("error" in res && res.error) toast(res.error, "info");
      return;
    }
    setEdit(null);
    setIban(null);
    toast(res.ibanChanged ? "Gespeichert – du bekommst eine Bestätigung per E-Mail" : "Stammdaten gespeichert");
    void load();
  }

  return (
    <>
      <PageHead title="Stammdaten" />
      <div className="ee-grid g-main" style={{ alignItems: "start" }}>
        <form className="stack" style={{ gap: 22 }} data-component="ProfileForm" onSubmit={save}>
          <section className="ee-card">
            <div className="ee-card__head">
              <h2>Persönliche Daten</h2>
              {!ed && (
                <button type="button" className="ee-btn ee-btn--sm" onClick={() => setEdit(toUpdate(p))}>
                  <Icon name="edit" small /> Bearbeiten
                </button>
              )}
            </div>
            <div className="ee-form">
              {field("pName", "Vollständiger Name", p.name, { readOnly: true })}
              {field("pGeb", "Geburtsdatum", p.geburtsdatum, { readOnly: true })}
              {field("pTel", "Telefon", p.telefon, { type: "tel", key: "telefon" })}
              {field("pMail", "E-Mail", p.email, { type: "email", readOnly: true })}
              {field("pStr", "Straße und Hausnummer", p.strasse, { full: true, key: "strasse" })}
              {field("pPlz", "PLZ", p.plz, { key: "plz" })}
              {field("pOrt", "Ort", p.ort, { key: "ort" })}
            </div>
            {ed && <p className="ee-hint" style={{ marginTop: 10 }}>Name, Geburtsdatum und E-Mail ändert ein Admin für dich.</p>}
          </section>
          <section className="ee-card">
            <div className="ee-card__head">
              <h2>Bankverbindung</h2>
              <span className="ee-secure">
                <Icon name="shield" /> Nur für dich und die Buchhaltung sichtbar
              </span>
            </div>
            <div className="ee-form">
              <div className="ee-field ee-field--full">
                <label htmlFor="pIban">IBAN</label>
                <div className="ee-masked">
                  <input
                    className={errors.iban ? "ee-input is-invalid" : "ee-input"}
                    id="pIban"
                    autoComplete="off"
                    spellCheck={false}
                    readOnly={!ed}
                    placeholder={ed ? "Leer lassen = unverändert" : undefined}
                    value={ed ? edit!.iban : iban ?? p.ibanMasked}
                    onChange={ed ? (e) => set("iban", e.target.value) : undefined}
                    onBlur={ed ? () => edit!.iban && set("iban", formatIban(edit!.iban)) : undefined}
                  />
                  {!ed && p.ibanMasked && (
                    <button
                      type="button"
                      className="ee-btn"
                      aria-label={iban ? "IBAN verbergen" : "IBAN anzeigen"}
                      onClick={async () => {
                        if (iban) return setIban(null);
                        const res = await revealMyIbanAction();
                        if (res.ok) setIban(res.data);
                      }}
                    >
                      <Icon name={iban ? "eyeoff" : "eye"} small /> {iban ? "Verbergen" : "Anzeigen"}
                    </button>
                  )}
                </div>
                <span className={errors.iban ? "ee-hint ee-hint--err" : "ee-hint"}>
                  {errors.iban || (ed ? `Aktuell: ${p.ibanMasked || "keine"}. Bei Änderung bekommst du und die Buchhaltung eine E-Mail.` : "")}
                </span>
              </div>
              {field("pInh", "Kontoinhaber/in", p.kontoinhaber, { key: "kontoinhaber" })}
            </div>
          </section>
          <section className="ee-card">
            <div className="ee-card__head">
              <h2>Steuer &amp; Gewerbe</h2>
            </div>
            <div className="ee-form">
              {field("pSt", "Steuernummer", p.steuernummer, { key: "steuernummer" })}
              <label className="ee-check ee-field--full">
                <input
                  type="checkbox"
                  checked={ed ? edit!.gewerbeAngemeldet : p.gewerbeAngemeldet}
                  disabled={!ed}
                  onChange={(e) => set("gewerbeAngemeldet", e.target.checked)}
                />
                <span>Gewerbe angemeldet</span>
              </label>
              <label className="ee-check ee-field--full">
                <input
                  type="checkbox"
                  checked={ed ? edit!.kleinunternehmer : p.kleinunternehmer}
                  disabled={!ed}
                  onChange={(e) => set("kleinunternehmer", e.target.checked)}
                />
                <span>Kleinunternehmerregelung (§ 19 UStG) – Abrechnung ohne Umsatzsteuer</span>
              </label>
            </div>
          </section>
          {ed && (
            <div className="row" style={{ position: "sticky", bottom: "calc(var(--bottom-h) + 10px)" }}>
              <button className="ee-btn ee-btn--primary" type="submit" disabled={busy}>
                <Icon name="check" small /> Speichern
              </button>
              <button
                className="ee-btn"
                type="button"
                onClick={() => {
                  setEdit(null);
                  setErrors({});
                }}
              >
                Abbrechen
              </button>
            </div>
          )}
        </form>
        <div className="stack">
          <section className="ee-card">
            <h2>Konto</h2>
            <dl className="ee-facts" style={{ gridTemplateColumns: "1fr" }}>
              <div>
                <dt>Rolle</dt>
                <dd>{ROLE_LABEL[p.role] || p.role}</dd>
              </div>
              <div>
                <dt>MB seit</dt>
                <dd>{p.memberSince || "–"}</dd>
              </div>
            </dl>
          </section>
        </div>
      </div>
    </>
  );
}

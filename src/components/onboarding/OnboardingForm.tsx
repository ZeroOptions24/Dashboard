"use client";

import { useState } from "react";
import { submitOnboardingFormAction } from "@/app/actions/onboarding";
import { formatIban, isValidIban } from "@/lib/iban";
import type { OnboardingFormData } from "@/server/onboarding";

type Errors = Partial<Record<keyof OnboardingFormData, string>>;

export default function OnboardingForm({ token, name, email }: { token: string; name: string; email: string }) {
  const [d, setD] = useState<OnboardingFormData>({
    telefon: "",
    geburtsdatum: "",
    strasse: "",
    plz: "",
    ort: "",
    iban: "",
    kontoinhaber: name,
    steuernummer: "",
    kleinunternehmer: false,
    gewerbeAngemeldet: false,
    datenschutz: false,
  });
  const [errors, setErrors] = useState<Errors>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const set = <K extends keyof OnboardingFormData>(k: K, v: OnboardingFormData[K]) => {
    setD((x) => ({ ...x, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await submitOnboardingFormAction(token, d);
    setBusy(false);
    if (res.ok) return setDone(true);
    setErrors(res.errors || {});
    setError("error" in res && res.error ? res.error : "Bitte prüfe die markierten Felder.");
  }

  if (done)
    return (
      <section className="ee-card stack">
        <h1>Danke, {name.split(" ")[0]}!</h1>
        <p className="muted">Deine Daten sind angekommen. Als Nächstes bekommst du deinen Vertrag per E-Mail zur elektronischen Unterschrift.</p>
        <ol className="ee-steps-list">
          <li className="is-done">✓ Daten ergänzt</li>
          <li className="is-current">→ Vertrag unterschreiben (kommt per E-Mail an {email})</li>
          <li>Passwort festlegen und loslegen</li>
        </ol>
      </section>
    );

  const field = (k: keyof OnboardingFormData, label: string, input: React.ReactNode, full = false, hint?: string) => (
    <div className={full ? "ee-field ee-field--full" : "ee-field"}>
      <label htmlFor={k}>{label}</label>
      {input}
      {errors[k] ? <span className="ee-hint ee-hint--err">{errors[k]}</span> : hint ? <span className="ee-hint">{hint}</span> : null}
    </div>
  );
  const text = (k: "telefon" | "strasse" | "plz" | "ort" | "kontoinhaber" | "steuernummer", props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <input className={errors[k] ? "ee-input is-invalid" : "ee-input"} id={k} value={d[k]} onChange={(e) => set(k, e.target.value)} {...props} />
  );
  const ibanOk = d.iban.replace(/\s/g, "").length >= 15 && isValidIban(d.iban);

  return (
    <section className="ee-card">
      <form className="stack" onSubmit={submit} noValidate>
        <div>
          <h1>Deine Daten für den Vertrag</h1>
          <p className="muted" style={{ marginTop: 6 }}>
            Hallo {name.split(" ")[0]}, mit diesen Angaben erstellen wir deinen Vertrag und zahlen deine Provision aus. Deine Bankdaten werden
            verschlüsselt gespeichert.
          </p>
        </div>
        <div className="ee-form" style={{ padding: 0 }}>
          {field("strasse", "Straße und Hausnummer", text("strasse", { autoComplete: "street-address", required: true }), true)}
          {field("plz", "PLZ", text("plz", { inputMode: "numeric", autoComplete: "postal-code", maxLength: 5, required: true }))}
          {field("ort", "Ort", text("ort", { autoComplete: "address-level2", required: true }))}
          {field(
            "geburtsdatum",
            "Geburtsdatum",
            <input
              className={errors.geburtsdatum ? "ee-input is-invalid" : "ee-input"}
              id="geburtsdatum"
              type="date"
              value={d.geburtsdatum}
              onChange={(e) => set("geburtsdatum", e.target.value)}
              required
            />,
          )}
          {field("telefon", "Telefon (WhatsApp)", text("telefon", { type: "tel", autoComplete: "tel", required: true }))}
          {field(
            "iban",
            "IBAN",
            <input
              className={errors.iban ? "ee-input is-invalid" : "ee-input"}
              id="iban"
              value={d.iban}
              autoComplete="off"
              spellCheck={false}
              placeholder="DE00 0000 0000 0000 0000 00"
              onChange={(e) => set("iban", e.target.value)}
              onBlur={() => d.iban && set("iban", formatIban(d.iban))}
              required
            />,
            true,
            ibanOk ? "✓ IBAN gültig" : "Für die Auszahlung deiner Provision",
          )}
          {field("kontoinhaber", "Kontoinhaber/in", text("kontoinhaber", { required: true }))}
          {field("steuernummer", "Steuernummer (falls vorhanden)", text("steuernummer"))}
          <label className="ee-check ee-field--full">
            <input type="checkbox" checked={d.gewerbeAngemeldet} onChange={(e) => set("gewerbeAngemeldet", e.target.checked)} />
            <span>Ich habe ein Gewerbe angemeldet</span>
          </label>
          <label className="ee-check ee-field--full">
            <input type="checkbox" checked={d.kleinunternehmer} onChange={(e) => set("kleinunternehmer", e.target.checked)} />
            <span>Ich nutze die Kleinunternehmerregelung (§ 19 UStG)</span>
          </label>
          <label className="ee-check ee-field--full">
            <input type="checkbox" checked={d.datenschutz} onChange={(e) => set("datenschutz", e.target.checked)} />
            <span>
              Ich habe die{" "}
              <a className="ee-link" href="/datenschutz" target="_blank">
                Datenschutzhinweise
              </a>{" "}
              gelesen.
              {errors.datenschutz && (
                <>
                  <br />
                  <span className="ee-hint ee-hint--err">{errors.datenschutz}</span>
                </>
              )}
            </span>
          </label>
        </div>
        {error && <div className="ee-alert ee-alert--bad">{error}</div>}
        <button className="ee-btn ee-btn--primary ee-btn--block" type="submit" disabled={busy}>
          Daten absenden
        </button>
      </form>
    </section>
  );
}

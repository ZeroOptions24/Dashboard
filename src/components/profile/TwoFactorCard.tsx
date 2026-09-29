"use client";

import { useState } from "react";
import QRCode from "qrcode";
import Icon from "@/components/ui/Icon";
import { ToneChip } from "@/components/ui/Chips";
import { authClient } from "@/lib/auth-client";
import { useDashboard } from "@/lib/useDashboard";

type Step = "idle" | "password" | "scan" | "disable";

/** Zwei-Faktor-Anmeldung einrichten / ausschalten (Authenticator-App + Ersatz-Codes). */
export default function TwoFactorCard({ enabled, recommended, onChange }: { enabled: boolean; recommended: boolean; onChange: () => void }) {
  const { toast } = useDashboard();
  const [step, setStep] = useState<Step>("idle");
  const [password, setPassword] = useState("");
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState("");
  const [codes, setCodes] = useState<string[]>([]);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setStep("idle");
    setPassword("");
    setCode("");
    setQr(null);
    setCodes([]);
    setError(null);
  };

  async function start(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { data, error } = await authClient.twoFactor.enable({ password });
    setBusy(false);
    if (error || !data) return setError("Passwort ist falsch.");
    if (!("totpURI" in data)) return setError("Unerwartete Antwort – bitte erneut versuchen.");
    setQr(await QRCode.toDataURL(data.totpURI, { margin: 1, width: 200 }));
    setSecret(new URL(data.totpURI).searchParams.get("secret") ?? "");
    setCodes(data.backupCodes);
    setPassword("");
    setStep("scan");
  }

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await authClient.twoFactor.verifyTotp({ code: code.replace(/\s/g, "") });
    setBusy(false);
    if (error) return setError("Code stimmt nicht – bitte den aktuellen Code aus der App eingeben.");
    toast("Zwei-Faktor-Anmeldung ist eingerichtet", "shield");
    reset();
    onChange();
  }

  async function disable(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await authClient.twoFactor.disable({ password });
    setBusy(false);
    if (error) return setError("Passwort ist falsch.");
    toast("Zwei-Faktor-Anmeldung ausgeschaltet", "close");
    reset();
    onChange();
  }

  return (
    <section className="ee-card" data-component="TwoFactorCard">
      <div className="ee-card__head">
        <h2>Sicherheit</h2>
        {enabled ? <ToneChip label="Zwei-Faktor aktiv" tone="ok" /> : recommended ? <ToneChip label="Empfohlen" tone="warn" /> : null}
      </div>
      {step === "idle" && (
        <div className="stack" style={{ gap: 10 }}>
          <p className="muted" style={{ fontSize: ".9rem" }}>
            {enabled
              ? "Beim Anmelden fragen wir zusätzlich nach einem Code aus deiner Authenticator-App."
              : "Schütze deinen Zugang mit einem zweiten Faktor: Beim Anmelden gibst du zusätzlich einen Code aus einer Authenticator-App ein (z. B. Google Authenticator, Microsoft Authenticator, 1Password)."}
          </p>
          {enabled ? (
            <button className="ee-btn ee-btn--sm" onClick={() => setStep("disable")}>
              Ausschalten
            </button>
          ) : (
            <button className="ee-btn ee-btn--primary ee-btn--sm" onClick={() => setStep("password")}>
              <Icon name="shield" small /> Zwei-Faktor einrichten
            </button>
          )}
        </div>
      )}
      {(step === "password" || step === "disable") && (
        <form className="stack" style={{ gap: 10 }} onSubmit={step === "password" ? start : disable}>
          <div className="ee-field">
            <label htmlFor="tfPw">Zur Bestätigung: dein Passwort</label>
            <input className="ee-input" id="tfPw" type="password" autoComplete="current-password" required autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error && <div className="ee-alert ee-alert--bad">{error}</div>}
          <div className="row">
            <button className={step === "password" ? "ee-btn ee-btn--primary ee-btn--sm" : "ee-btn ee-btn--danger ee-btn--sm"} type="submit" disabled={busy}>
              {step === "password" ? "Weiter" : "Zwei-Faktor ausschalten"}
            </button>
            <button className="ee-btn ee-btn--ghost ee-btn--sm" type="button" onClick={reset}>
              Abbrechen
            </button>
          </div>
        </form>
      )}
      {step === "scan" && (
        <form className="stack" style={{ gap: 12 }} onSubmit={confirm}>
          <p style={{ fontSize: ".9rem" }}>
            <b>1.</b> QR-Code mit der Authenticator-App scannen:
          </p>
          {qr && (
            // eslint-disable-next-line @next/next/no-img-element -- lokal erzeugtes data:-Bild, keine Optimierung nötig
            <img src={qr} alt="QR-Code für die Authenticator-App" width={200} height={200} style={{ borderRadius: 8, background: "#fff" }} />
          )}
          <p className="faint" style={{ fontSize: ".8rem" }}>
            Kein Scan möglich? Schlüssel von Hand eingeben: <span className="mono">{secret}</span>
          </p>
          <p style={{ fontSize: ".9rem" }}>
            <b>2.</b> Ersatz-Codes sicher aufbewahren (z. B. im Passwort-Manager). Jeder funktioniert einmal, falls das Handy weg ist:
          </p>
          <div className="ee-note mono" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: "4px 16px" }}>
            {codes.map((c) => (
              <span key={c}>{c}</span>
            ))}
          </div>
          <button
            type="button"
            className="ee-btn ee-btn--sm"
            onClick={() => {
              navigator.clipboard?.writeText(codes.join("\n"));
              toast("Ersatz-Codes kopiert");
            }}
          >
            <Icon name="copy" small /> Ersatz-Codes kopieren
          </button>
          <div className="ee-field">
            <label htmlFor="tfCode">
              <b>3.</b> Aktuellen 6-stelligen Code aus der App eingeben
            </label>
            <input className="ee-input num" id="tfCode" inputMode="numeric" autoComplete="one-time-code" required value={code} onChange={(e) => setCode(e.target.value)} style={{ maxWidth: 180, letterSpacing: ".2em" }} />
          </div>
          {error && <div className="ee-alert ee-alert--bad">{error}</div>}
          <div className="row">
            <button className="ee-btn ee-btn--primary ee-btn--sm" type="submit" disabled={busy}>
              <Icon name="check" small /> Aktivieren
            </button>
            <button className="ee-btn ee-btn--ghost ee-btn--sm" type="button" onClick={reset}>
              Abbrechen
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

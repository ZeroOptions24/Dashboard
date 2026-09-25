"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export const MIN_PASSWORD = 10;

export default function SetPasswordForm({ token }: { token: string }) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < MIN_PASSWORD) return setError(`Mindestens ${MIN_PASSWORD} Zeichen.`);
    if (pw !== pw2) return setError("Die Passwörter stimmen nicht überein.");
    setBusy(true);
    setError(null);
    const { error } = await authClient.resetPassword({ newPassword: pw, token });
    if (error) {
      setError("Der Link ist abgelaufen oder wurde schon benutzt. Bitte fordere einen neuen an.");
      setBusy(false);
      return;
    }
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- bewusst voller Neuladen: keine Daten der vorherigen Sitzung im Speicher
    window.location.href = "/login?passwort=gesetzt";
  }

  return (
    <section className="ee-card">
      <form className="stack" onSubmit={submit}>
        <h1>Passwort festlegen</h1>
        <p className="muted">Mindestens {MIN_PASSWORD} Zeichen. Am sichersten ist ein Satz aus mehreren Wörtern.</p>
        <div className="ee-field">
          <label htmlFor="pw">Neues Passwort</label>
          <input className="ee-input" id="pw" type="password" autoComplete="new-password" required value={pw} onChange={(e) => setPw(e.target.value)} />
        </div>
        <div className="ee-field">
          <label htmlFor="pw2">Passwort wiederholen</label>
          <input className="ee-input" id="pw2" type="password" autoComplete="new-password" required value={pw2} onChange={(e) => setPw2(e.target.value)} />
        </div>
        {error && <div className="ee-alert ee-alert--bad">{error}</div>}
        <button className="ee-btn ee-btn--primary ee-btn--block" type="submit" disabled={busy}>
          Passwort speichern
        </button>
      </form>
    </section>
  );
}

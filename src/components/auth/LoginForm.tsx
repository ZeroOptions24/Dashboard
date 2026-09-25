"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export default function LoginForm({ passwordSet }: { passwordSet?: boolean }) {
  const [mode, setMode] = useState<"login" | "forgot" | "sent">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await authClient.signIn.email({ email, password });
    if (error) {
      setError(error.status === 403 ? "Dieser Zugang ist gesperrt." : "E-Mail oder Passwort ist falsch.");
      setBusy(false);
      return;
    }
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- bewusst voller Neuladen: keine Daten der vorherigen Sitzung im Speicher
    window.location.href = "/";
  }

  async function forgot(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    /* Antwort bewusst immer gleich – verrät nicht, ob die E-Mail existiert */
    await authClient.requestPasswordReset({ email, redirectTo: `${window.location.origin}/passwort-setzen` });
    setBusy(false);
    setMode("sent");
  }

  if (mode === "sent")
    return (
      <section className="ee-card stack">
        <h1>Schau in dein Postfach</h1>
        <p className="muted">Wenn es zu {email} einen Zugang gibt, haben wir dir einen Link zum Festlegen eines neuen Passworts geschickt.</p>
        <button className="ee-btn" onClick={() => setMode("login")}>
          Zurück zur Anmeldung
        </button>
      </section>
    );

  return (
    <section className="ee-card">
      <form className="stack" onSubmit={mode === "login" ? login : forgot}>
        <h1>{mode === "login" ? "Anmelden" : "Passwort vergessen"}</h1>
        {passwordSet && mode === "login" && <div className="ee-alert ee-alert--ok">Passwort gespeichert – du kannst dich jetzt anmelden.</div>}
        {mode === "forgot" && <p className="muted">Gib deine E-Mail ein, wir schicken dir einen Link für ein neues Passwort.</p>}
        <div className="ee-field">
          <label htmlFor="email">E-Mail</label>
          <input className="ee-input" id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        {mode === "login" && (
          <div className="ee-field">
            <label htmlFor="password">Passwort</label>
            <input
              className="ee-input"
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        )}
        {error && <div className="ee-alert ee-alert--bad">{error}</div>}
        <button className="ee-btn ee-btn--primary ee-btn--block" type="submit" disabled={busy}>
          {mode === "login" ? "Anmelden" : "Link senden"}
        </button>
        <button type="button" className="ee-btn ee-btn--ghost ee-btn--sm" onClick={() => setMode(mode === "login" ? "forgot" : "login")}>
          {mode === "login" ? "Passwort vergessen?" : "Zurück zur Anmeldung"}
        </button>
      </form>
    </section>
  );
}

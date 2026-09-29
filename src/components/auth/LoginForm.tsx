"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export default function LoginForm({ passwordSet }: { passwordSet?: boolean }) {
  const [mode, setMode] = useState<"login" | "forgot" | "sent" | "2fa">("login");
  const [code, setCode] = useState("");
  const [backup, setBackup] = useState(false);
  const [trust, setTrust] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { data, error } = await authClient.signIn.email({ email, password });
    if (error) {
      setError(error.status === 403 ? "Dieser Zugang ist gesperrt." : "E-Mail oder Passwort ist falsch.");
      setBusy(false);
      return;
    }
    /* Zwei-Faktor-Anmeldung eingerichtet → zweiter Schritt mit Code aus der App */
    if (data && "twoFactorRedirect" in data && data.twoFactorRedirect) {
      setBusy(false);
      setMode("2fa");
      return;
    }
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- bewusst voller Neuladen: keine Daten der vorherigen Sitzung im Speicher
    window.location.href = "/";
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const c = code.replace(/\s/g, "");
    const { error } = backup
      ? await authClient.twoFactor.verifyBackupCode({ code: c, trustDevice: trust })
      : await authClient.twoFactor.verifyTotp({ code: c, trustDevice: trust });
    if (error) {
      setError(backup ? "Ersatz-Code ungültig oder schon benutzt." : "Code falsch oder abgelaufen – bitte den aktuellen Code aus der App eingeben.");
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

  if (mode === "2fa")
    return (
      <section className="ee-card">
        <form className="stack" onSubmit={verify}>
          <h1>Bestätigungscode</h1>
          <p className="muted">
            {backup ? "Gib einen deiner Ersatz-Codes ein. Jeder Code funktioniert nur einmal." : "Öffne deine Authenticator-App und gib den 6-stelligen Code für EnergyEngel ein."}
          </p>
          <div className="ee-field">
            <label htmlFor="code">{backup ? "Ersatz-Code" : "Code"}</label>
            <input
              className="ee-input num"
              id="code"
              autoComplete="one-time-code"
              inputMode={backup ? "text" : "numeric"}
              autoFocus
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              style={{ letterSpacing: ".2em", fontSize: "1.1rem" }}
            />
          </div>
          <label className="ee-check">
            <input type="checkbox" checked={trust} onChange={(e) => setTrust(e.target.checked)} />
            <span>Diesem Gerät 30 Tage vertrauen</span>
          </label>
          {error && <div className="ee-alert ee-alert--bad">{error}</div>}
          <button className="ee-btn ee-btn--primary ee-btn--block" type="submit" disabled={busy}>
            Bestätigen
          </button>
          <button
            type="button"
            className="ee-btn ee-btn--ghost ee-btn--sm"
            onClick={() => {
              setBackup(!backup);
              setCode("");
              setError(null);
            }}
          >
            {backup ? "Code aus der App verwenden" : "Handy nicht zur Hand? Ersatz-Code verwenden"}
          </button>
        </form>
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

import AuthShell from "@/components/auth/AuthShell";
import SetPasswordForm from "@/components/auth/SetPasswordForm";

export const metadata = { title: "Passwort festlegen · EnergyEngel MB-Dashboard" };

/* Ziel des Einmal-Links aus „Zugang einrichten“ bzw. „Passwort vergessen“.
   Better Auth leitet mit ?token=… hierher (oder ?error=INVALID_TOKEN bei abgelaufenem Link). */
export default async function SetPasswordPage({ searchParams }: PageProps<"/passwort-setzen">) {
  const sp = await searchParams;
  const token = typeof sp.token === "string" ? sp.token : null;
  return (
    <AuthShell>
      {token && !sp.error ? (
        <SetPasswordForm token={token} />
      ) : (
        <section className="ee-card stack">
          <h1>Link abgelaufen</h1>
          <p className="muted">
            Dieser Link ist nicht mehr gültig. Fordere auf der Anmeldeseite unter „Passwort vergessen?“ einen neuen an – oder frag bei deinem
            Admin nach.
          </p>
          <a className="ee-btn ee-btn--primary" href="/login">
            Zur Anmeldung
          </a>
        </section>
      )}
    </AuthShell>
  );
}

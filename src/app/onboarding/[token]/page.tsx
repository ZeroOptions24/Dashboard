import AuthShell from "@/components/auth/AuthShell";
import OnboardingForm from "@/components/onboarding/OnboardingForm";
import { checkFormToken } from "@/server/onboarding";

/* Bei jedem Aufruf frisch aus der Datenbank – nie beim Build vorab erzeugen */
export const dynamic = "force-dynamic";
export const metadata = { title: "Deine Daten · EnergyEngel", robots: { index: false } };

/* Öffentliche Formularseite aus der Einladungsmail. Ohne gültigen Link: keine Daten. */
export default async function OnboardingPage({ params }: PageProps<"/onboarding/[token]">) {
  const { token } = await params;
  const invite = await checkFormToken(token);
  return (
    <AuthShell wide={!!invite}>
      {invite ? (
        <OnboardingForm token={token} name={invite.name} email={invite.email} />
      ) : (
        <section className="ee-card stack">
          <h1>Link nicht mehr gültig</h1>
          <p className="muted">
            Dieser Link ist abgelaufen oder wurde schon benutzt. Wenn du deine Daten noch nicht abgeschickt hast, bitte deinen Ansprechpartner bei
            EnergyEngel um einen neuen Link.
          </p>
        </section>
      )}
    </AuthShell>
  );
}

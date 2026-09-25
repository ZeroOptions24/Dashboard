import AuthShell from "@/components/auth/AuthShell";

export const metadata = { title: "Datenschutzhinweise · EnergyEngel MB-Dashboard" };

/* TODO (EnergyEngel): Datenschutzhinweise für MAs (Stammdaten, Bankdaten, Dashboard-Nutzung)
   von der/dem Datenschutzbeauftragten bzw. Anwalt erstellen lassen und hier einsetzen. */
export default function DatenschutzPage() {
  return (
    <AuthShell wide>
      <section className="ee-card stack">
        <h1>Datenschutzhinweise</h1>
        <div className="ee-dev-banner">Platzhalter – der endgültige Text wird von EnergyEngel noch geliefert.</div>
        <p className="muted">
          Hier stehen später die Datenschutzhinweise für Mitarbeitende: welche Daten erhoben werden (Kontakt-, Adress-, Bank- und Steuerdaten),
          wofür (Vertrag, Provisionsabrechnung), wie lange sie gespeichert werden, wer Zugriff hat und welche Rechte du hast.
        </p>
      </section>
    </AuthShell>
  );
}

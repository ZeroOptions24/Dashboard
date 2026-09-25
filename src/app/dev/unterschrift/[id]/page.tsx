import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import AuthShell from "@/components/auth/AuthShell";
import { db, schema } from "@/server/db";
import { markSigned } from "@/server/onboarding";

export const metadata = { title: "Vertrag unterschreiben (Test) · EnergyEngel" };

/* Nur Entwicklung: simuliert die Unterschrift beim Signing-Tool.
   Mit SIGNING_PROVIDER=yousign übernimmt das Yousign, Ergebnis kommt per Webhook. */
async function sign(formData: FormData) {
  "use server";
  if (process.env.NODE_ENV !== "development") notFound();
  const id = String(formData.get("id"));
  await markSigned(id);
  redirect(`/dev/unterschrift/${id}`);
}

export default async function DevSignPage({ params }: PageProps<"/dev/unterschrift/[id]">) {
  if (process.env.NODE_ENV !== "development") notFound();
  const { id } = await params;
  const [row] = await db
    .select({ status: schema.onboarding.status, name: schema.user.name })
    .from(schema.onboarding)
    .innerJoin(schema.user, eq(schema.user.id, schema.onboarding.userId))
    .where(eq(schema.onboarding.signatureRequestId, id));
  if (!row) notFound();
  const signed = row.status !== "vertrag_versendet";
  return (
    <AuthShell>
      <div className="ee-dev-banner">Test-Unterschrift – im echten Betrieb unterschreibt man bei Yousign.</div>
      <section className="ee-card stack">
        <h1>Vertrag für {row.name}</h1>
        {signed ? (
          <div className="ee-alert ee-alert--ok">Unterschrieben. Die E-Mail zum Festlegen des Passworts ist unterwegs.</div>
        ) : (
          <form action={sign} className="stack">
            <p className="muted">Hier würde der Vertrag angezeigt. Mit dem Button wird die Unterschrift simuliert.</p>
            <input type="hidden" name="id" value={id} />
            <button className="ee-btn ee-btn--primary ee-btn--block" type="submit">
              Vertrag unterschreiben
            </button>
          </form>
        )}
      </section>
    </AuthShell>
  );
}

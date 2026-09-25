import { redirect } from "next/navigation";
import AuthShell from "@/components/auth/AuthShell";
import LoginForm from "@/components/auth/LoginForm";
import { getSession } from "@/server/auth";
import { db, schema } from "@/server/db";

/* Bei jedem Aufruf frisch aus der Datenbank – nie beim Build vorab erzeugen */
export const dynamic = "force-dynamic";
export const metadata = { title: "Anmelden · EnergyEngel MB-Dashboard" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (await getSession()) redirect("/");
  /* Noch kein Konto angelegt → Ersteinrichtung */
  const [anyUser] = await db.select({ id: schema.user.id }).from(schema.user).limit(1);
  if (!anyUser) redirect("/setup");
  const sp = await searchParams;
  return (
    <AuthShell>
      <LoginForm passwordSet={sp.passwort === "gesetzt"} />
    </AuthShell>
  );
}

import { redirect } from "next/navigation";
import AuthShell from "@/components/auth/AuthShell";
import { auth } from "@/server/auth";
import { db, schema } from "@/server/db";

/* Bei jedem Aufruf frisch aus der Datenbank – nie beim Build vorab erzeugen */
export const dynamic = "force-dynamic";
export const metadata = { title: "Ersteinrichtung · EnergyEngel MB-Dashboard" };

const noUsersYet = async () => !(await db.select({ id: schema.user.id }).from(schema.user).limit(1)).length;

/* Legt den allerersten Admin an. Funktioniert nur, solange es noch KEIN Konto gibt –
   danach leitet die Seite immer zur Anmeldung um. */
async function createFirstAdmin(formData: FormData) {
  "use server";
  if (!(await noUsersYet())) redirect("/login");
  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  if (!name || !email.includes("@") || password.length < 10) redirect("/setup?fehler=1");
  const ctx = await auth.$context;
  const user = await ctx.internalAdapter.createUser({ name, email, role: "admin", emailVerified: true }, { method: "admin" });
  await ctx.internalAdapter.linkAccount({ userId: user.id, providerId: "credential", accountId: user.id, password: await ctx.password.hash(password) });
  await db.insert(schema.onboarding).values({ userId: user.id, status: "aktiv", activatedAt: new Date(), signedAt: new Date() });
  await db.insert(schema.profile).values({ userId: user.id });
  redirect("/login");
}

export default async function SetupPage({ searchParams }: PageProps<"/setup">) {
  if (!(await noUsersYet())) redirect("/login");
  const sp = await searchParams;
  return (
    <AuthShell>
      <section className="ee-card">
        <form className="stack" action={createFirstAdmin}>
          <h1>Ersteinrichtung</h1>
          <p className="muted">Es gibt noch kein Konto. Lege den ersten Admin an – alle weiteren MAs lädt ein Admin dann im Dashboard ein.</p>
          <div className="ee-field">
            <label htmlFor="name">Vor- und Nachname</label>
            <input className="ee-input" id="name" name="name" required />
          </div>
          <div className="ee-field">
            <label htmlFor="email">E-Mail</label>
            <input className="ee-input" id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="ee-field">
            <label htmlFor="password">Passwort (mind. 10 Zeichen)</label>
            <input className="ee-input" id="password" name="password" type="password" autoComplete="new-password" minLength={10} required />
          </div>
          {sp.fehler && <div className="ee-alert ee-alert--bad">Bitte alle Felder ausfüllen, Passwort mindestens 10 Zeichen.</div>}
          <button className="ee-btn ee-btn--primary ee-btn--block" type="submit">
            Admin anlegen
          </button>
        </form>
      </section>
    </AuthShell>
  );
}

import { redirect } from "next/navigation";
import AppShell from "@/components/shell/AppShell";
import { getSession, needsTwoFactorSetup } from "@/server/auth";
import type { Role } from "@/lib/types";

/* Dashboard – nur mit Anmeldung. Den Rollenwechsel „Ansicht als“ sehen nur Admins.
   ?view=<ansicht> öffnet direkt eine Ansicht (z. B. aus E-Mails: ?view=team). */
export default async function Home({ searchParams }: PageProps<"/">) {
  const session = await getSession();
  if (!session) redirect("/login");
  const role = (session.user.role || "setter") as Role;
  const sp = await searchParams;
  const view = typeof sp.view === "string" ? sp.view : undefined;
  return (
    <AppShell
      role={role}
      name={session.user.name}
      view={view}
      isAdmin={role === "admin"}
      banner={
        /* Nur wenn ADMIN_2FA_PFLICHT (src/server/auth.ts) eingeschaltet ist */
        needsTwoFactorSetup(session.user) && (
          <div className="ee-alert ee-alert--bad" role="alert" style={{ margin: "18px 28px 0" }}>
            Bitte richte die Zwei-Faktor-Anmeldung ein – bis dahin sind Admin-Aktionen gesperrt.{" "}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- Startansicht wird beim Laden gelesen, daher voller Seitenaufruf */}
            <a className="ee-link" href="/?view=stammdaten">
              Jetzt einrichten
            </a>
          </div>
        )
      }
    />
  );
}

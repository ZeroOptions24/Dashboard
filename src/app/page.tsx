import { redirect } from "next/navigation";
import AppShell from "@/components/shell/AppShell";
import { lockedRoles } from "@/server/academy";
import { getSession, needsTwoFactorSetup } from "@/server/auth";
import { defaultRole, isAdmin, parseRoles } from "@/lib/roles";

/* Dashboard – nur mit Anmeldung. Den Rollenwechsel „Ansicht als“ sehen nur Admins.
   ?view=<ansicht> öffnet direkt eine Ansicht (z. B. aus E-Mails: ?view=team). */
export default async function Home({ searchParams }: PageProps<"/">) {
  const session = await getSession();
  if (!session) redirect("/login");
  const roles = parseRoles(session.user.role);
  /* Akademie: Rollen ohne bestandenen Test sind gesperrt; gestartet wird in einer freien Rolle, sonst in der ersten */
  const locked = await lockedRoles(session.user.id, roles);
  const startRole = roles.find((r) => !locked.includes(r as never)) ?? defaultRole(roles);
  const sp = await searchParams;
  const view = typeof sp.view === "string" ? sp.view : undefined;
  return (
    <AppShell
      roles={roles}
      startRole={isAdmin(roles) ? defaultRole(roles) : startRole}
      locked={locked}
      name={session.user.name}
      view={view}
      isAdmin={isAdmin(roles)}
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

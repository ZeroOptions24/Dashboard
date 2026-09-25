import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins";
import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements, userAc } from "better-auth/plugins/admin/access";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { db, schema } from "./db";
import { mailLayout, sendMail } from "./mail";

/* Login mit E-Mail und Passwort.
   - Keine Selbstregistrierung: Zugänge legen nur Admins an (Einladung, src/server/onboarding.ts).
   - Das eigene Passwort setzt ein MA über einen Einmal-Link – beim ersten Mal
     („Zugang einrichten“) wie beim Zurücksetzen („Passwort vergessen“).
   - Rollen: setter, presetter, closer, admin. */

export const ROLES = ["setter", "presetter", "closer", "admin"] as const;

/* Rechte: Admins verwalten Nutzer (anlegen, sperren …), alle anderen nichts davon.
   Was jemand im Dashboard SIEHT, regeln die Datenabfragen je Rolle. */
const ac = createAccessControl(defaultStatements);
const roles = {
  admin: ac.newRole({ ...adminAc.statements }),
  setter: ac.newRole({ ...userAc.statements }),
  presetter: ac.newRole({ ...userAc.statements }),
  closer: ac.newRole({ ...userAc.statements }),
};
export type AuthRole = (typeof ROLES)[number];

/** Gültigkeit des Passwort-Links: 48 Stunden */
const PASSWORD_LINK_SECONDS = 48 * 3600;

export const auth = betterAuth({
  appName: "EnergyEngel MB-Dashboard",
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user: schema.user, session: schema.session, account: schema.account, verification: schema.verification },
  }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 10,
    resetPasswordTokenExpiresIn: PASSWORD_LINK_SECONDS,
    revokeSessionsOnPasswordReset: true,
    async sendResetPassword({ user, url }) {
      const [ob] = await db.select().from(schema.onboarding).where(eq(schema.onboarding.userId, user.id));
      const firstTime = ob && !ob.activatedAt;
      await sendMail(
        user.email,
        firstTime ? "Dein Zugang zum EnergyEngel MB-Dashboard" : "Passwort für das MB-Dashboard zurücksetzen",
        mailLayout(
          firstTime
            ? {
                title: `Willkommen im Team, ${user.name.split(" ")[0]}!`,
                intro: "Dein Vertrag ist unterschrieben. Lege jetzt dein Passwort fest – danach kannst du dich jederzeit im MB-Dashboard anmelden.",
                button: "Passwort festlegen",
                url,
                outro: "Der Link ist 48 Stunden gültig und funktioniert nur einmal.",
              }
            : {
                title: "Passwort zurücksetzen",
                intro: "Du hast ein neues Passwort angefordert. Über den Button legst du es fest.",
                button: "Neues Passwort festlegen",
                url,
                outro: "Der Link ist 48 Stunden gültig. Wenn du das nicht warst, ignoriere diese E-Mail.",
              },
        ),
      );
    },
    async onPasswordReset({ user }) {
      /* Erstes Passwort gesetzt → Onboarding abgeschlossen */
      await db
        .update(schema.onboarding)
        .set({ status: "aktiv", activatedAt: new Date(), updatedAt: new Date() })
        .where(eq(schema.onboarding.userId, user.id));
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 Tage
    updateAge: 60 * 60 * 24,
  },
  plugins: [
    admin({
      ac,
      roles,
      defaultRole: "setter",
      adminRoles: ["admin"],
    }),
    nextCookies(), // muss das letzte Plugin sein
  ],
});

export type Session = typeof auth.$Infer.Session;

/** Aktuelle Sitzung (Server Components, Server Actions, Route Handler). */
export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

/** Wirft, wenn nicht angemeldet oder kein Admin. In JEDER Admin-Server-Action aufrufen. */
export async function requireAdmin() {
  const s = await getSession();
  if (!s || s.user.role !== "admin") throw new Error("Nicht berechtigt");
  return s;
}

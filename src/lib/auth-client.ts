"use client";

import { createAuthClient } from "better-auth/react";
import { twoFactorClient } from "better-auth/client/plugins";

/* Login-Funktionen für den Browser (Anmelden, Abmelden, Passwort setzen, Zwei-Faktor). */
export const authClient = createAuthClient({
  plugins: [twoFactorClient()],
});

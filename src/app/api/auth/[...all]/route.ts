import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/server/auth";

/* Alle Login-Endpunkte (/api/auth/*) von Better Auth */
export const { GET, POST } = toNextJsHandler(auth);

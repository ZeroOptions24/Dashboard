import { timingSafeEqual } from "node:crypto";
import { sendReminders } from "@/server/onboarding";

/* Tägliche Onboarding-Erinnerungen.
   TODO (Hosting): einmal täglich aufrufen, z. B. als geplante Aufgabe in Coolify:
     curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://<domain>/api/cron/reminders
   Ohne CRON_SECRET ist der Endpunkt gesperrt. */

export const dynamic = "force-dynamic";

function authorized(header: string | null) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !header) return false;
  const a = Buffer.from(header),
    b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (!process.env.CRON_SECRET) return Response.json({ error: "CRON_SECRET ist nicht gesetzt" }, { status: 503 });
  if (!authorized(request.headers.get("authorization"))) return Response.json({ error: "Nicht berechtigt" }, { status: 401 });
  return Response.json(await sendReminders());
}

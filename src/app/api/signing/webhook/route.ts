import { markSigned } from "@/server/onboarding";
import { verifyYousignWebhook } from "@/server/signing";

/* Webhook von Yousign: Ereignis „signature_request.done“ → MA bekommt den Zugang.
   TODO (EnergyEngel): Webhook in Yousign auf <APP_URL>/api/signing/webhook anlegen
   und das Secret als YOUSIGN_WEBHOOK_SECRET hinterlegen. */
export async function POST(request: Request) {
  const raw = await request.text();
  if (!verifyYousignWebhook(raw, request.headers.get("x-yousign-signature-256"))) {
    return Response.json({ error: "Ungültige Signatur" }, { status: 401 });
  }
  const body = JSON.parse(raw) as { event_name?: string; data?: { signature_request?: { id?: string } } };
  const id = body.data?.signature_request?.id;
  if (body.event_name === "signature_request.done" && id) await markSigned(id);
  return Response.json({ ok: true });
}

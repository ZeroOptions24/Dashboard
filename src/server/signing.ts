import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { SIGNATURE_FIELD, type ContractDocument } from "./contracts";
import { appUrl, mailLayout, sendMail } from "./mail";

/* Versand von Verträgen zur elektronischen Unterschrift.
   SIGNING_PROVIDER=yousign → Yousign (EU, eIDAS), sonst "dev": In der Entwicklung
   bekommt der MA eine Mail mit Link auf /dev/unterschrift/<id>, dort lässt sich
   die Unterschrift simulieren. Ergebnis landet in beiden Fällen in markSigned(). */

export interface Signer {
  firstName: string;
  lastName: string;
  email: string;
}

export interface SigningProvider {
  name: string;
  /** Vertrag zur Unterschrift senden; liefert die ID der Signaturanfrage */
  send(doc: ContractDocument, signer: Signer): Promise<string>;
}

/* ---------- Entwicklung: simulierte Unterschrift ---------- */
const devProvider: SigningProvider = {
  name: "dev",
  async send(doc, signer) {
    const id = `dev-${randomBytes(8).toString("hex")}`;
    await sendMail(
      signer.email,
      "Bitte unterschreibe deinen Vertrag mit EnergyEngel",
      mailLayout({
        title: `Hallo ${signer.firstName}, dein Vertrag ist bereit`,
        intro: "Bitte prüfe den Vertrag und unterschreibe ihn elektronisch. Danach bekommst du deinen Zugang zum MB-Dashboard.",
        button: "Vertrag ansehen und unterschreiben",
        url: `${appUrl()}/dev/unterschrift/${id}`,
        outro: "(Entwicklungsmodus: Die Unterschrift wird nur simuliert.)",
      }),
    );
    return id;
  },
};

/* ---------- Yousign (API v3) ----------
   TODO (EnergyEngel): Yousign-Konto anlegen, API-Key erzeugen, Webhook auf
   <APP_URL>/api/signing/webhook (Ereignis signature_request.done) einrichten und
   YOUSIGN_API_KEY + YOUSIGN_WEBHOOK_SECRET setzen. Zum Testen YOUSIGN_SANDBOX=1.
   Hinweis: nach den Yousign-Doku-Endpunkten implementiert, aber mangels Zugang
   noch NICHT gegen die echte API getestet. */
function yousignBase() {
  return process.env.YOUSIGN_SANDBOX ? "https://api-sandbox.yousign.app/v3" : "https://api.yousign.app/v3";
}

async function ys<T>(path: string, init: RequestInit): Promise<T> {
  const key = process.env.YOUSIGN_API_KEY;
  if (!key) throw new Error("YOUSIGN_API_KEY ist nicht gesetzt.");
  const res = await fetch(yousignBase() + path, { ...init, headers: { authorization: `Bearer ${key}`, ...(init.headers || {}) } });
  if (!res.ok) throw new Error(`Yousign ${path}: HTTP ${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

const yousignProvider: SigningProvider = {
  name: "yousign",
  async send(doc, signer) {
    const json = { "content-type": "application/json" };
    const req = await ys<{ id: string }>("/signature_requests", {
      method: "POST",
      headers: json,
      body: JSON.stringify({ name: doc.title, delivery_mode: "email", timezone: "Europe/Berlin" }),
    });
    const form = new FormData();
    form.append("file", new Blob([doc.pdf as BlobPart], { type: "application/pdf" }), doc.fileName);
    form.append("nature", "signable_document");
    const file = await ys<{ id: string }>(`/signature_requests/${req.id}/documents`, { method: "POST", body: form });
    await ys(`/signature_requests/${req.id}/signers`, {
      method: "POST",
      headers: json,
      body: JSON.stringify({
        info: { first_name: signer.firstName, last_name: signer.lastName, email: signer.email, locale: "de" },
        signature_level: "electronic_signature",
        signature_authentication_mode: "no_otp",
        fields: [
          {
            document_id: file.id,
            type: "signature",
            page: SIGNATURE_FIELD.page,
            x: SIGNATURE_FIELD.x,
            /* Yousign misst von oben, pdf-lib von unten (A4 = 842 pt hoch) */
            y: 842 - SIGNATURE_FIELD.y - SIGNATURE_FIELD.height,
            width: SIGNATURE_FIELD.width,
            height: SIGNATURE_FIELD.height,
          },
        ],
      }),
    });
    await ys(`/signature_requests/${req.id}/activate`, { method: "POST" });
    return req.id;
  },
};

export function signingProvider(): SigningProvider {
  return process.env.SIGNING_PROVIDER === "yousign" ? yousignProvider : devProvider;
}

/** Prüft die Signatur eines Yousign-Webhooks (HMAC-SHA256 über den Rohtext). */
export function verifyYousignWebhook(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.YOUSIGN_WEBHOOK_SECRET;
  if (!secret || !signatureHeader) return false;
  const expected = "sha256=" + createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected),
    b = Buffer.from(signatureHeader);
  return a.length === b.length && timingSafeEqual(a, b);
}

import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/* Verschlüsselung sensibler Felder (IBAN) mit AES-256-GCM.
   Schlüssel: DATA_ENCRYPTION_KEY (32 Byte, base64) – nur auf dem Server, nie im Repo.
   Format: v1.<iv>.<tag>.<ciphertext> (base64url) */

function key() {
  const k = process.env.DATA_ENCRYPTION_KEY;
  if (!k) throw new Error("DATA_ENCRYPTION_KEY ist nicht gesetzt (siehe .env.example).");
  const buf = Buffer.from(k, "base64");
  if (buf.length !== 32) throw new Error("DATA_ENCRYPTION_KEY muss 32 Byte (base64) lang sein.");
  return buf;
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), enc.toString("base64url")].join(".");
}

export function decrypt(payload: string): string {
  const [v, iv, tag, enc] = payload.split(".");
  if (v !== "v1") throw new Error("Unbekanntes Verschlüsselungsformat");
  const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(enc, "base64url")), d.final()]).toString("utf8");
}

/** Zufälliges Token für Einmal-Links (URL-sicher). */
export const newToken = () => randomBytes(32).toString("base64url");

/** Tokens werden nur als Hash gespeichert – ein Datenbank-Leak verrät keine gültigen Links. */
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

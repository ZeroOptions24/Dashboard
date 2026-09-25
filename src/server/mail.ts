import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { eq } from "drizzle-orm";
import { db, schema } from "./db";

/* E-Mail-Versand.
   Jede Mail wird in der Tabelle outbox protokolliert. Ist SMTP konfiguriert
   (SMTP_HOST, SMTP_USER, SMTP_PASS, MAIL_FROM), wird sie zusätzlich verschickt –
   sonst nur lokal unter /dev/postfach angezeigt (Entwicklung). */

const smtpConfigured = () => !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

let transport: Transporter | null = null;
function getTransport() {
  transport ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_PORT === "465",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return transport;
}

export const appUrl = () => (process.env.BETTER_AUTH_URL || "http://localhost:3000").replace(/\/$/, "");

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Einheitliches, schlichtes Mail-Layout mit einem Button. */
export function mailLayout({ title, intro, button, url, outro }: { title: string; intro: string; button?: string; url?: string; outro?: string }) {
  return `<!doctype html><html lang="de"><body style="margin:0;background:#F2F5F1;font-family:Arial,sans-serif;color:#13221A">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px">
    <div style="font-weight:800;font-size:20px;margin-bottom:24px">Energy<span style="color:#C99312">Engel</span></div>
    <div style="background:#fff;border-radius:14px;padding:28px">
      <h1 style="font-size:20px;margin:0 0 14px">${esc(title)}</h1>
      <p style="line-height:1.55;margin:0 0 20px">${esc(intro)}</p>
      ${button && url ? `<p style="margin:0 0 20px"><a href="${esc(url)}" style="display:inline-block;background:#1D4C37;color:#fff;text-decoration:none;padding:12px 20px;border-radius:9px;font-weight:bold">${esc(button)}</a></p>
      <p style="font-size:12px;color:#77887E;word-break:break-all;margin:0 0 16px">Falls der Button nicht funktioniert: ${esc(url)}</p>` : ""}
      ${outro ? `<p style="line-height:1.55;color:#48594F;margin:0">${esc(outro)}</p>` : ""}
    </div>
  </div></body></html>`;
}

export async function sendMail(to: string, subject: string, html: string) {
  const [row] = await db.insert(schema.outbox).values({ to, subject, html }).returning({ id: schema.outbox.id });
  if (!smtpConfigured()) {
    console.info(`[mail] SMTP nicht konfiguriert – „${subject}“ an ${to} nur unter /dev/postfach`);
    return;
  }
  try {
    await getTransport().sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to, subject, html });
    await db.update(schema.outbox).set({ sentAt: new Date() }).where(eq(schema.outbox.id, row.id));
  } catch (e) {
    await db.update(schema.outbox).set({ error: String(e) }).where(eq(schema.outbox.id, row.id));
    throw e;
  }
}

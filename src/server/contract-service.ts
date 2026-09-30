import "server-only";
import { randomBytes } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { isAdmin, parseRoles } from "@/lib/roles";
import { adminEmails } from "./auth";
import { documentsForRoles, generateContract } from "./contracts";
import { db, schema } from "./db";
import { appUrl, mailLayout, sendMail } from "./mail";
import { signingProvider } from "./signing";

/* Verträge: erzeugen, zur Unterschrift senden, Status, PDF, Rückfragen.
   Aufrufer prüfen die Berechtigung (Admin bzw. eigene Verträge). */

const audit = (actorId: string | null, action: string, targetUserId: string, detail?: string) =>
  db.insert(schema.auditLog).values({ actorId, action, targetUserId, detail });

export type ContractStatus = "offen" | "unterschrieben" | "storniert";

export interface ContractRow {
  id: string;
  userId: string;
  name: string;
  documents: string[];
  status: ContractStatus;
  sentAt: string;
  signedAt: string | null;
  question: string | null;
  /** nur Entwicklung: Link zur simulierten Unterschrift */
  devSignUrl: string | null;
}

const fmt = (d: Date | null) => (d ? d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) : null);

/** Vertrag aus Stammdaten erzeugen, speichern und zur Unterschrift senden. Liefert die Signatur-ID. */
export async function createAndSendContract(userId: string, sentBy: string | null, documents?: string[]) {
  const [row] = await db
    .select({ u: schema.user, p: schema.profile })
    .from(schema.user)
    .leftJoin(schema.profile, eq(schema.profile.userId, schema.user.id))
    .where(eq(schema.user.id, userId));
  if (!row) throw new Error("Person nicht gefunden");
  const { u, p } = row;
  if (!p?.strasse) throw new Error("Für einen Vertrag fehlen noch die Stammdaten dieser Person");
  const roles = parseRoles(u.role);
  const docs = documents?.length ? documents : documentsForRoles(roles);
  if (!docs.length) throw new Error("Keine Unterlagen ausgewählt");
  const pdf = await generateContract({
    roles,
    documents: docs,
    name: u.name,
    email: u.email,
    strasse: p.strasse ?? "",
    plz: p.plz ?? "",
    ort: p.ort ?? "",
    geburtsdatum: p.geburtsdatum ?? "",
    steuernummer: p.steuernummer ?? "",
    kleinunternehmer: p.kleinunternehmer,
  });
  const [first, ...rest] = u.name.split(" ");
  const requestId = await signingProvider().send(pdf, { firstName: first, lastName: rest.join(" ") || first, email: u.email });
  await db.insert(schema.contract).values({
    id: randomBytes(8).toString("hex"),
    userId,
    documents: JSON.stringify(docs),
    signatureRequestId: requestId,
    pdfBase64: Buffer.from(pdf.pdf).toString("base64"),
    sentBy,
  });
  await audit(sentBy, "contract.sent", userId, docs.join(" | "));
  return requestId;
}

/** Unterschrift eingegangen (Webhook bzw. Test-Seite). Liefert die Person oder null (unbekannt/doppelt). */
export async function markContractSigned(signatureRequestId: string) {
  const [c] = await db.select().from(schema.contract).where(eq(schema.contract.signatureRequestId, signatureRequestId));
  if (!c || c.status !== "offen") return null;
  await db.update(schema.contract).set({ status: "unterschrieben", signedAt: new Date() }).where(eq(schema.contract.id, c.id));
  await audit(null, "contract.signed", c.userId, signatureRequestId);
  return c.userId;
}

export async function listContracts(viewer: { id: string; role: string | null }, scope: "mine" | "all"): Promise<ContractRow[]> {
  const all = scope === "all" && isAdmin(parseRoles(viewer.role));
  const rows = await db
    .select({ c: schema.contract, name: schema.user.name })
    .from(schema.contract)
    .innerJoin(schema.user, eq(schema.user.id, schema.contract.userId))
    .where(all ? undefined : eq(schema.contract.userId, viewer.id))
    .orderBy(desc(schema.contract.sentAt));
  const dev = process.env.NODE_ENV === "development" && process.env.SIGNING_PROVIDER !== "yousign";
  return rows.map(({ c, name }) => ({
    id: c.id,
    userId: c.userId,
    name,
    documents: JSON.parse(c.documents) as string[],
    status: c.status as ContractStatus,
    sentAt: fmt(c.sentAt)!,
    signedAt: fmt(c.signedAt),
    question: c.question,
    devSignUrl: dev && c.status === "offen" && c.signatureRequestId ? `/dev/unterschrift/${c.signatureRequestId}` : null,
  }));
}

/** Zähler für Menü und Übersicht */
export async function contractSummary(viewer: { id: string; role: string | null }) {
  const rows = await db.select({ userId: schema.contract.userId, status: schema.contract.status, question: schema.contract.question }).from(schema.contract);
  const admin = isAdmin(parseRoles(viewer.role));
  return {
    openMine: rows.filter((r) => r.userId === viewer.id && r.status === "offen").length,
    openAll: admin ? rows.filter((r) => r.status === "offen").length : 0,
    questions: admin ? rows.filter((r) => !!r.question).length : 0,
  };
}

/** PDF für die Person selbst oder Admins */
export async function contractPdf(id: string, viewer: { id: string; role: string | null }) {
  const [c] = await db.select().from(schema.contract).where(eq(schema.contract.id, id));
  if (!c || !c.pdfBase64) return null;
  if (c.userId !== viewer.id && !isAdmin(parseRoles(viewer.role))) return null;
  if (c.userId !== viewer.id) await audit(viewer.id, "contract.pdf_viewed", c.userId, id);
  return { pdf: Buffer.from(c.pdfBase64, "base64"), name: `Vertrag-${id}.pdf` };
}

export async function askQuestion(id: string, userId: string, text: string) {
  const q = text.trim().slice(0, 2000);
  if (!q) throw new Error("Bitte eine Frage eingeben");
  const [c] = await db
    .update(schema.contract)
    .set({ question: q, questionAt: new Date() })
    .where(and(eq(schema.contract.id, id), eq(schema.contract.userId, userId)))
    .returning();
  if (!c) throw new Error("Vertrag nicht gefunden");
  const [u] = await db.select({ name: schema.user.name }).from(schema.user).where(eq(schema.user.id, userId));
  for (const email of await adminEmails())
    await sendMail(
      email,
      `Rückfrage zum Vertrag von ${u.name}`,
      mailLayout({ title: `${u.name} hat eine Rückfrage`, intro: q, button: "Im Dashboard öffnen", url: `${appUrl()}/?view=vertraege` }),
    );
}

export async function resolveQuestion(id: string, adminId: string) {
  const [c] = await db.update(schema.contract).set({ question: null, questionAt: null }).where(eq(schema.contract.id, id)).returning();
  if (!c) throw new Error("Vertrag nicht gefunden");
  await audit(adminId, "contract.question_resolved", c.userId, id);
}

/** Erinnerung an die Unterschrift (eigene E-Mail; Yousign erinnert zusätzlich selbst) */
export async function remindContract(id: string, adminId: string) {
  const [row] = await db
    .select({ c: schema.contract, u: schema.user })
    .from(schema.contract)
    .innerJoin(schema.user, eq(schema.user.id, schema.contract.userId))
    .where(eq(schema.contract.id, id));
  if (!row || row.c.status !== "offen") throw new Error("Nur offene Verträge");
  await sendMail(
    row.u.email,
    "Erinnerung: Dein Vertrag mit EnergyEngel wartet auf deine Unterschrift",
    mailLayout({
      title: `Hallo ${row.u.name.split(" ")[0]}, dein Vertrag ist noch offen`,
      intro: "Den Link zur elektronischen Unterschrift hast du per E-Mail bekommen. Im MB-Dashboard unter „Verträge“ siehst du den Stand.",
      button: "Zu meinen Verträgen",
      url: `${appUrl()}/?view=vertraege`,
    }),
  );
  await db.update(schema.contract).set({ lastReminderAt: new Date() }).where(eq(schema.contract.id, id));
  await audit(adminId, "contract.reminded", row.u.id, id);
}

/** Aktive Personen für „Vertrag senden“ (Admin) */
export async function contractRecipients() {
  const rows = await db
    .select({ id: schema.user.id, name: schema.user.name, banned: schema.user.banned, strasse: schema.profile.strasse })
    .from(schema.user)
    .leftJoin(schema.profile, eq(schema.profile.userId, schema.user.id));
  return rows.filter((r) => !r.banned).map((r) => ({ id: r.id, name: r.name, ready: !!r.strasse }));
}

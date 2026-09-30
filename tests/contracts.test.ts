import { beforeAll, describe, expect, it, vi } from "vitest";

/* Verträge: wer was sehen und tun darf (Datenbank: PGlite im Speicher, Signatur: Test-Anbieter). */

vi.mock("@/server/db", async () => (await import("./db")).createTestDb());
vi.mock("@/server/auth", () => ({ adminEmails: async () => ["ada@beispiel.test"] }));
vi.stubEnv("SIGNING_PROVIDER", "");
vi.spyOn(console, "info").mockImplementation(() => {});

const { db, schema } = await import("@/server/db");
const cs = await import("@/server/contract-service");

const admin = { id: "u-admin", role: "admin" };
const mia = { id: "u-mia", role: "setter,closer" };
const tom = { id: "u-tom", role: "setter" };

beforeAll(async () => {
  const u = (id: string, name: string, role: string) => ({ id, name, email: `${id}@beispiel.test`, role, emailVerified: true });
  await db.insert(schema.user).values([u("u-admin", "Ada Admin", "admin"), u("u-mia", "Mia Muster", "setter,closer"), u("u-tom", "Tom Test", "setter")]);
  await db.insert(schema.profile).values({ userId: "u-mia", strasse: "Teststraße 1", plz: "04109", ort: "Leipzig", geburtsdatum: "1999-01-01" });
});

describe("Verträge", () => {
  let id = "",
    requestId = "";

  it("ohne Stammdaten kein Vertrag; mit Stammdaten die Unterlagen passend zu den Rollen", async () => {
    await expect(cs.createAndSendContract("u-tom", "u-admin")).rejects.toThrow(/Stammdaten/);
    requestId = await cs.createAndSendContract("u-mia", "u-admin");
    const [row] = await cs.listContracts(mia, "mine");
    id = row.id;
    expect(row.documents).toEqual(expect.arrayContaining(["Handelsvertretervertrag (§ 84 HGB)", "Provisionsvereinbarung Setting", "Provisionsvereinbarung Closing"]));
    expect(row.status).toBe("offen");
  });

  it("MAs sehen nur ihre eigenen Verträge – auch wenn sie „alle“ anfragen", async () => {
    expect(await cs.listContracts(tom, "all")).toEqual([]);
    expect(await cs.listContracts(admin, "all")).toHaveLength(1);
  });

  it("PDF: nur die Person selbst oder Admins (Admin-Abruf wird protokolliert)", async () => {
    expect(await cs.contractPdf(id, tom)).toBeNull();
    expect((await cs.contractPdf(id, mia))?.pdf.subarray(0, 4).toString()).toBe("%PDF");
    expect(await cs.contractPdf(id, admin)).not.toBeNull();
    const log = await db.select().from(schema.auditLog);
    expect(log.some((l) => l.action === "contract.pdf_viewed" && l.actorId === "u-admin")).toBe(true);
  });

  it("Rückfragen nur zum eigenen Vertrag; Admins bekommen eine E-Mail", async () => {
    await expect(cs.askQuestion(id, "u-tom", "Hallo?")).rejects.toThrow(/nicht gefunden/);
    await expect(cs.askQuestion(id, "u-mia", "   ")).rejects.toThrow(/Frage/);
    await cs.askQuestion(id, "u-mia", "Ab wann gilt die Staffel?");
    expect(await cs.contractSummary(admin)).toEqual({ openMine: 0, openAll: 1, questions: 1 });
    expect(await cs.contractSummary(tom)).toEqual({ openMine: 0, openAll: 0, questions: 0 });
    const mails = await db.select().from(schema.outbox);
    expect(mails.some((m) => m.to === "ada@beispiel.test" && m.subject.includes("Mia Muster"))).toBe(true);
  });

  it("Unterschrift wird genau einmal verbucht", async () => {
    expect(await cs.markContractSigned(requestId)).toBe("u-mia");
    expect(await cs.markContractSigned(requestId)).toBeNull();
    expect(await cs.markContractSigned("unbekannt")).toBeNull();
    expect((await cs.listContracts(mia, "mine"))[0].status).toBe("unterschrieben");
    await expect(cs.remindContract(id, "u-admin")).rejects.toThrow(/offene/);
  });
});

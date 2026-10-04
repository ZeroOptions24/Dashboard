import { beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

/* Automatische Erinnerungen: offene Verträge (A15) und fehlende IBAN vor dem Stichtag (A12). */

vi.mock("@/server/db", async () => (await import("./db")).createTestDb());
vi.mock("@/server/auth", () => ({ adminEmails: async () => ["ada@beispiel.test"] }));
vi.stubEnv("SIGNING_PROVIDER", "");
vi.spyOn(console, "info").mockImplementation(() => {});

const { db, schema } = await import("@/server/db");
const cs = await import("@/server/contract-service");
const prov = await import("@/server/provisions");

const day = (iso: string) => new Date(`${iso}T10:00:00+02:00`);

beforeAll(async () => {
  const u = (id: string, name: string, role: string) => ({ id, name, email: `${id}@beispiel.test`, role, emailVerified: true });
  await db.insert(schema.user).values([u("u-admin", "Ada Admin", "admin"), u("u-mia", "Mia Muster", "setter"), u("u-tom", "Tom Test", "setter")]);
  await db.insert(schema.profile).values([
    { userId: "u-mia", strasse: "Teststraße 1", plz: "04109", ort: "Leipzig", geburtsdatum: "1999-01-01" },
    { userId: "u-tom", strasse: "Weg 2", plz: "04109", ort: "Leipzig", ibanEnc: "verschluesselt", ibanLast4: "1234" },
  ]);
});

describe("Vertragserinnerung", () => {
  it("erinnert nach 7 Tagen, danach höchstens wöchentlich, nach 28 Tagen nicht mehr", async () => {
    await cs.createAndSendContract("u-mia", "u-admin");
    const [c] = await db.select().from(schema.contract);
    const sent = c.sentAt.getTime();
    const at = (days: number) => new Date(sent + days * 864e5);

    expect(await cs.remindOverdueContracts(at(3))).toEqual([]);
    expect(await cs.remindOverdueContracts(at(7.1))).toEqual([c.id]);
    expect(await cs.remindOverdueContracts(at(8))).toEqual([]); /* gerade erst erinnert */
    expect(await cs.remindOverdueContracts(at(14.5))).toEqual([c.id]);
    expect(await cs.remindOverdueContracts(at(29))).toEqual([]);

    await db.update(schema.contract).set({ status: "unterschrieben" }).where(eq(schema.contract.id, c.id));
    expect(await cs.remindOverdueContracts(at(21.5))).toEqual([]);
  });
});

describe("IBAN-Erinnerung vor dem Stichtag", () => {
  beforeAll(async () => {
    await db.insert(schema.provision).values([
      { id: "pv1", userId: "u-mia", role: "setter", leadId: "PD-1", kunde: "Kunde A", anlass: "Verkauf", betrag: 1000, status: "fest", festAt: day("2026-10-10") },
      { id: "pv2", userId: "u-tom", role: "setter", leadId: "PD-2", kunde: "Kunde B", anlass: "Verkauf", betrag: 1000, status: "fest", festAt: day("2026-10-10") },
    ]);
  });

  it("nur am Tag vor dem 1. und 15., nur ohne IBAN", async () => {
    expect(await prov.remindMissingBankData(day("2026-10-10"))).toBe(0);
    expect(await prov.remindMissingBankData(day("2026-10-14"))).toBe(1); /* Mia hat keine IBAN, Tom schon */
    const n = await db.select().from(schema.notification).where(eq(schema.notification.userId, "u-mia"));
    expect(n.some((x) => /IBAN fehlt noch/.test(x.text))).toBe(true);
    expect((await db.select().from(schema.notification).where(eq(schema.notification.userId, "u-tom"))).length).toBe(0);
  });

  it("die Abrechnung ohne IBAN wird gehalten und die Person benachrichtigt", async () => {
    await prov.runSettlement(new Date(2026, 9, 15));
    const [p] = await db.select().from(schema.payout).where(eq(schema.payout.userId, "u-mia"));
    expect(p.hinweis).toBe("IBAN fehlt");
  });
});

import { beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

/* Admin-Oberfläche nach Tims Vorlage: To-Do-Regeln, Alle freigeben, Überweisungsliste. */

vi.mock("@/server/db", async () => (await import("./db")).createTestDb());
vi.stubEnv("DATA_ENCRYPTION_KEY", Buffer.alloc(32, 9).toString("base64"));

const { db, schema } = await import("@/server/db");
const prov = await import("@/server/provisions");
const { exportTransfers } = await import("@/server/payout-export");
const { encrypt } = await import("@/server/crypto");
const { todoItems, TODO_CATS } = await import("@/lib/todos");

const admin = { id: "u-admin", roles: ["admin" as const] };
const mia = { id: "u-mia", roles: ["setter" as const] };

describe("Admin-To-Dos", () => {
  const person = (k: string) => ({ key: k, name: k, first: k, role: "setter" as const, initials: "X" });
  const base = { role: "admin" as const, me: "u-admin", now: new Date("2026-10-04T10:00:00"), leads: [], appts: [], slots: [], person, openContracts: 0 };
  const payout = (id: string, status: "pruefung" | "freigegeben" | "ausgezahlt", hinweis: string | null) => ({ id, periode: "Stichtag 01.10.2026", betrag: 750, status, datum: "10.10.2026", posten: [], hinweis });
  const items = todoItems({
    ...base,
    admin: {
      payouts: { "u-mia": [payout("p1", "pruefung", "IBAN fehlt"), payout("p2", "pruefung", null), payout("p3", "ausgezahlt", null)] },
      provisions: [{ id: "v1", user: "u-mia", role: "setter", lead: "L1", kunde: "Kunde X", anlass: "Verkauf", betrag: 1000, status: "tbk" as const, datum: "01.10.2026", frage: "Warum nur 1.000 €?", antwort: null }],
      mbStats: [{ key: "u-tom", leads: 0, termin: 0, checks: 0, verkauft: 0, last: "29.09.2026", days: 5 }],
      contracts: { openAll: 2, questions: 1 },
      closers: ["u-carl"],
    },
  });
  const by = (key: string) => items.find((t) => t.key === key);

  it("gehaltene Abrechnung, Freigabe, Rückfrage, Verträge, Inaktive, Slots – mit Bereich und Person", () => {
    expect(by("k_iban:p1")).toMatchObject({ group: "today", cat: "geld", mb: ["u-mia"], what: "Auszahlung gehalten", when: "IBAN fehlt" });
    expect(by("frei:p2")).toMatchObject({ group: "later", cat: "geld", what: "Abrechnung freigeben" });
    expect(by("frei:p1")).toBeUndefined(); /* gehaltene werden nicht zusätzlich zur Freigabe angeboten */
    expect(by("frei:p3")).toBeUndefined(); /* ausgezahlt ist erledigt */
    expect(by("frage:v1")).toMatchObject({ cat: "geld", mb: ["u-mia"], where: expect.stringContaining("Kunde X") });
    expect(by("q_vertrag:alle")).toMatchObject({ cat: "vertrag", what: "1 Rückfrage zu Verträgen" });
    expect(by("k_vertrag:alle")).toMatchObject({ group: "later", what: "2 Verträge nicht unterschrieben" });
    expect(by("k_inaktiv:u-tom")).toMatchObject({ tone: "bad", cat: "team", mb: ["u-tom"], what: "Seit 5 Tagen kein Lead" });
    expect(by("k_slots:u-carl")).toMatchObject({ cat: "closer", what: "Zu wenige freie Slots", when: "0 von 4 für nächste Woche", act: { kind: "team", key: "u-carl" } });
  });
  it("sortiert überfällig vor heute vor demnächst; alle Bereiche stehen in der Filterliste", () => {
    const order = { over: 0, today: 1, later: 2 };
    expect(items.map((t) => order[t.group])).toEqual([...items.map((t) => order[t.group])].sort());
    for (const t of items) expect(TODO_CATS.map(([k]) => k)).toContain(t.cat);
  });
  it("Setter bekommen keine Admin-Aufgaben", () => {
    expect(todoItems({ ...base, role: "setter", me: "u-mia" })).toEqual([]);
  });
});

describe("Alle freigeben und Überweisungsliste", () => {
  beforeAll(async () => {
    const u = (id: string, name: string, role: string) => ({ id, name, email: `${id}@beispiel.test`, role, emailVerified: true });
    await db.insert(schema.user).values([u("u-admin", "Ada Admin", "admin"), u("u-mia", "Mia Muster", "setter"), u("u-tom", "Tom Test", "setter")]);
    await db.insert(schema.profile).values([
      { userId: "u-mia", ibanEnc: encrypt("DE89370400440532013000"), ibanLast4: "3000", kontoinhaber: "Mia Muster" },
      { userId: "u-tom" },
    ]);
    const row = (id: string, userId: string, betrag: number) => ({ id, userId, periode: "Stichtag 01.10.2026", betrag, status: "pruefung", datum: "10.10.2026", posten: "[]" });
    await db.insert(schema.payout).values([row("AZ-1", "u-mia", 1250), row("AZ-2", "u-tom", 400)]);
  });

  it("nur Admins; Abrechnungen ohne IBAN bleiben liegen und werden gezählt", async () => {
    await expect(prov.releaseAllPayouts(mia)).rejects.toThrow(/Berechtigung/);
    expect(await prov.releaseAllPayouts(admin)).toEqual({ released: 1, skipped: 1 });
    const st = Object.fromEntries((await db.select().from(schema.payout)).map((p) => [p.id, p.status]));
    expect(st).toEqual({ "AZ-1": "freigegeben", "AZ-2": "pruefung" });
  });

  it("Überweisungsliste: nur freigegebene, IBAN entschlüsselt, Betrag deutsch, Abruf protokolliert", async () => {
    const out = (await exportTransfers("u-admin")).replace("﻿", "").split("\r\n");
    expect(out).toEqual([
      '"Empfänger";"IBAN";"Betrag (EUR)";"Verwendungszweck";"Auszahlung am";"Abrechnung"',
      '"Mia Muster";"DE89 3704 0044 0532 0130 00";"1250,00";"Gutschrift AZ-1 Stichtag 01.10.2026";"10.10.2026";"AZ-1"',
    ]);
    const log = await db.select().from(schema.auditLog).where(eq(schema.auditLog.action, "payout.export"));
    expect(log).toHaveLength(1);
    expect(log[0].detail).toContain("1 Abrechnungen");
  });
});

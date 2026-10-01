import { beforeAll, describe, expect, it, vi } from "vitest";

/* „Wird gerade bearbeitet“ im Telefonleitfaden */

vi.mock("@/server/db", async () => (await import("./db")).createTestDb());
const { db, schema } = await import("@/server/db");
const { claimLead, releaseLeads } = await import("@/server/lead-lock");

const aimee = { id: "u-a", roles: ["presetter" as const] };
const lara = { id: "u-l", roles: ["presetter" as const, "admin" as const] };

beforeAll(async () => {
  await db.insert(schema.user).values([
    { id: "u-a", name: "Aimée Test", email: "a@beispiel.test", role: "presetter", emailVerified: true },
    { id: "u-l", name: "Lara Test", email: "l@beispiel.test", role: "presetter,admin", emailVerified: true },
  ]);
});

describe("Lead-Sperre", () => {
  it("die zweite Person sieht, wer den Lead offen hat", async () => {
    expect(await claimLead(aimee, "PD-1")).toEqual({ other: null });
    const r = await claimLead(lara, "PD-1");
    expect(r.other?.name).toBe("Aimée");
    expect(await claimLead(aimee, "PD-1")).toEqual({ other: null }); /* eigene Sperre verlängern */
  });

  it("man hält immer nur einen Lead; Wechsel gibt den alten frei", async () => {
    await claimLead(aimee, "PD-2");
    expect(await claimLead(lara, "PD-1")).toEqual({ other: null });
  });

  it("„Trotzdem übernehmen“ und Freigabe beim Verlassen", async () => {
    expect((await claimLead(lara, "PD-2")).other?.name).toBe("Aimée");
    expect(await claimLead(lara, "PD-2", true)).toEqual({ other: null });
    expect((await claimLead(aimee, "PD-2")).other?.name).toBe("Lara");
    await releaseLeads(lara);
    expect(await claimLead(aimee, "PD-2")).toEqual({ other: null });
  });

  it("abgelaufene Sperren gelten nicht mehr", async () => {
    await db.update(schema.leadLock).set({ until: new Date(Date.now() - 1000) });
    expect(await claimLead(lara, "PD-2")).toEqual({ other: null });
  });
});

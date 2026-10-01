import { beforeAll, describe, expect, it, vi } from "vitest";

/* Admin-Werkzeuge: Protokoll, Datenauskunft (DSGVO), Wettbewerb abschließen */

vi.mock("@/server/db", async () => (await import("./db")).createTestDb());
vi.mock("@/server/auth", () => ({ auth: {} }));
vi.mock("@/server/onboarding", () => ({ inviteMember: vi.fn() }));
vi.stubEnv("DATA_ENCRYPTION_KEY", Buffer.alloc(32, 7).toString("base64"));

const { db, schema } = await import("@/server/db");
const team = await import("@/server/team");
const ws = await import("@/server/workspace");
const { encrypt } = await import("@/server/crypto");

beforeAll(async () => {
  await db.insert(schema.user).values([
    { id: "u-admin", name: "Ada Admin", email: "ada@beispiel.test", role: "admin", emailVerified: true },
    { id: "u-mia", name: "Mia Muster", email: "mia@beispiel.test", role: "setter", emailVerified: true },
  ]);
  await db.insert(schema.profile).values({ userId: "u-mia", strasse: "Teststraße 1", plz: "04109", ort: "Leipzig", ibanEnc: encrypt("DE89370400440532013000"), ibanLast4: "3000" });
  await db.insert(schema.notification).values({ userId: "u-mia", text: "Hallo Mia" });
});

describe("Admin-Werkzeuge", () => {
  it("Datenauskunft enthält die eigenen Daten inkl. IBAN, aber keine Geheimnisse – und wird protokolliert", async () => {
    const d = await team.exportMember("u-mia", "u-admin");
    expect(d.konto).toMatchObject({ name: "Mia Muster", email: "mia@beispiel.test", rollen: ["setter"] });
    expect(d.stammdaten).toMatchObject({ ort: "Leipzig", iban: "DE89 3704 0044 0532 0130 00" });
    expect(JSON.stringify(d)).not.toContain("ibanEnc");
    expect(d.benachrichtigungen).toHaveLength(1);
    const log = await team.listAudit();
    expect(log[0]).toMatchObject({ actor: "Ada Admin", label: "Datenauskunft erstellt", target: "Mia Muster" });
  });

  it("Wettbewerb abschließen: nur Admins, danach Archiv + neuer Entwurf", async () => {
    const admin = { id: "u-admin", roles: ["admin" as const] };
    await expect(ws.archiveBoard(admin)).rejects.toThrow(/kein veröffentlichter/);
    await ws.publishBoard(admin, { id: null, title: "Cup Oktober", ends: "31.10.2026", rows: [] });
    await expect(ws.archiveBoard({ id: "u-mia", roles: ["setter"] })).rejects.toThrow(/Berechtigung/);
    expect(await ws.archiveBoard(admin)).toBe("Cup Oktober");
    const w = await ws.loadWorkspace(admin);
    expect(w.board.id).toBeNull();
    expect(w.boardArchive[0].title).toBe("Cup Oktober");
    expect((await team.listAudit())[0].label).toBe("Wettbewerb abgeschlossen");
  });
});

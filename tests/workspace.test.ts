import { beforeAll, describe, expect, it, vi } from "vitest";
import type { Viewer } from "@/server/workspace";

/* Team-Alltag: Rechte und Abläufe gegen eine echte Datenbank (PGlite im Speicher). */

vi.mock("@/server/db", async () => (await import("./db")).createTestDb());
/* Kein Pipedrive in Tests → Setter-Benachrichtigung zu Pipedrive-Leads entfällt */
vi.mock("@/server/pipedrive/client", () => ({
  getDeals: vi.fn(async () => {
    throw new Error("offline");
  }),
  getPersons: vi.fn(async () => []),
}));

const { db, schema } = await import("@/server/db");
const ws = await import("@/server/workspace");

const admin: Viewer = { id: "u-admin", roles: ["admin"] };
const setter: Viewer = { id: "u-setter", roles: ["setter"] };
const closer: Viewer = { id: "u-closer", roles: ["closer"] };
const closer2: Viewer = { id: "u-closer2", roles: ["closer"] };
const presetter: Viewer = { id: "u-pre", roles: ["presetter"] };

const tomorrow = (() => {
  const d = new Date(Date.now() + 864e5);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
})();
const notifsOf = async (userId: string) => (await ws.loadWorkspace({ id: userId, roles: ["setter"] })).notifications.map((n) => n.t);

beforeAll(async () => {
  const u = (id: string, name: string, role: string) => ({ id, name, email: `${id}@beispiel.test`, role, emailVerified: true });
  await db
    .insert(schema.user)
    .values([u("u-admin", "Ada Admin", "admin"), u("u-setter", "Sven Setter", "setter"), u("u-closer", "Clara Closer", "closer"), u("u-closer2", "Carl Closer", "closer"), u("u-pre", "Paula Presetter", "presetter")]);
});

describe("Closer-Kalender und Buchung", () => {
  let slotId = "";

  it("nur Closer tragen Slots ein; Presetter werden informiert", async () => {
    await expect(ws.addSlots(setter, [{ date: tomorrow, start: 10 }])).rejects.toThrow(/Nur Closer/);
    const rows = await ws.addSlots(closer, [
      { date: tomorrow, start: 10 },
      { date: tomorrow, start: 11 },
      { date: "2020-01-01", start: 10 } /* Vergangenheit wird ignoriert */,
    ]);
    expect(rows.map((r) => r.start)).toEqual([10, 11]);
    slotId = rows[0].id;
    expect(await notifsOf("u-pre")).toContain("Clara hat 2 neue freie Slots eingetragen");
    expect(await notifsOf("u-closer")).not.toContain("Clara hat 2 neue freie Slots eingetragen");
  });

  it("doppelte Slots entstehen nicht", async () => {
    expect(await ws.addSlots(closer, [{ date: tomorrow, start: 10 }])).toEqual([]);
  });

  it("fremde Slots darf man nicht löschen", async () => {
    await expect(ws.removeSlot(closer2, slotId)).rejects.toThrow(/Berechtigung/);
  });

  it("Closer dürfen nicht buchen; ein Slot lässt sich nur einmal buchen", async () => {
    await expect(ws.bookSlot(closer2, slotId, { id: "PD-1", kunde: "Kunde", ort: "Leipzig" })).rejects.toThrow(/Berechtigung/);
    const a = await ws.bookSlot(setter, slotId, { id: "PD-1", kunde: "Familie Test", ort: "Leipzig" });
    expect(a.closer).toBe("u-closer");
    await expect(ws.bookSlot(presetter, slotId, { id: "PD-2", kunde: "Andere", ort: "" })).rejects.toThrow(/nicht mehr frei/);
    expect((await notifsOf("u-closer")).some((t) => t.startsWith("Neuer Ersttermin: Familie Test"))).toBe(true);
  });

  it("Termine sieht der zuständige Closer und wer gebucht hat – andere Closer nicht", async () => {
    expect((await ws.loadWorkspace(closer)).appointments).toHaveLength(1);
    expect((await ws.loadWorkspace(setter)).appointments).toHaveLength(1);
    expect((await ws.loadWorkspace(closer2)).appointments).toHaveLength(0);
    expect(await ws.leadIdsForCloser("u-closer")).toEqual(new Set(["PD-1"]));
  });

  it("Rückmeldung nur vom zuständigen Closer; 2. Termin wird angelegt", async () => {
    const [appt] = (await ws.loadWorkspace(closer)).appointments;
    await expect(ws.saveFeedback(setter, appt.id, { result: "checks" })).rejects.toThrow(/Nur Closer/);
    await expect(ws.saveFeedback(closer2, appt.id, { result: "checks" })).rejects.toThrow(/Berechtigung/);
    const r = await ws.saveFeedback(closer, appt.id, { result: "checks", note: "Heizung alt", second: { date: tomorrow, hour: 17 } });
    expect(r.second).toMatchObject({ kind: "closing", closer: "u-closer", start: 17 });
    const list = (await ws.loadWorkspace(closer)).appointments;
    expect(list.find((x) => x.id === appt.id)!.feedback).toMatchObject({ result: "checks", note: "Heizung alt" });
    expect(list).toHaveLength(2);
  });
});

describe("Events", () => {
  it("nur Admins posten; die Zielgruppe wird benachrichtigt und sieht das Event", async () => {
    const input = { title: "Closer-Training", date: tomorrow, time: "18:00", ort: "Büro", type: "Training", target: "Closer", desc: "" };
    await expect(ws.postEvent(setter, input)).rejects.toThrow(/Berechtigung/);
    const id = await ws.postEvent(admin, input);
    expect((await ws.loadWorkspace(closer)).events.map((e) => e.id)).toContain(id);
    expect((await ws.loadWorkspace(setter)).events.map((e) => e.id)).not.toContain(id);
    expect(await notifsOf("u-closer2")).toContain(`Neues Event: Closer-Training am ${tomorrow.slice(8)}.${tomorrow.slice(5, 7)}.${tomorrow.slice(2, 4)}`);
    expect(await notifsOf("u-setter")).not.toContain(expect.stringContaining("Closer-Training"));
  });

  it("Zusage an- und abschalten", async () => {
    const [ev] = (await ws.loadWorkspace(closer)).events;
    expect(await ws.toggleRsvp(closer, ev.id)).toBe(true);
    expect((await ws.loadWorkspace(closer)).events[0].going).toEqual(["u-closer"]);
    expect(await ws.toggleRsvp(closer, ev.id)).toBe(false);
    expect((await ws.loadWorkspace(closer)).events[0].going).toEqual([]);
  });

  it("ungültige Eingaben werden abgelehnt", async () => {
    await expect(ws.postEvent(admin, { title: "X", date: "morgen", time: "18", ort: "B", type: "T", target: "Closer", desc: "" })).rejects.toThrow(/Datum/);
    await expect(ws.postEvent(admin, { title: "X", date: tomorrow, time: "18", ort: "B", type: "T", target: "Chefs", desc: "" })).rejects.toThrow(/Zielgruppe/);
  });
});

describe("Wettbewerb", () => {
  it("Entwurf enthält alle Closer; nur Admins veröffentlichen; Teilnehmer erfahren ihren Platz", async () => {
    const draft = (await ws.loadWorkspace(admin)).board;
    expect(draft.id).toBeNull();
    expect(draft.rows.map((r) => r[0]).sort()).toEqual(["u-closer", "u-closer2"]);
    const input = { id: null, title: "Cup Oktober", ends: "31.10.2026", goal: 20, rows: [["u-closer", 3], ["u-closer2", 5], ["fremd", 9]] as [string, number][] };
    await expect(ws.publishBoard(closer, input)).rejects.toThrow(/Berechtigung/);
    const id = await ws.publishBoard(admin, input);
    const b = (await ws.loadWorkspace(closer)).board;
    expect(b.id).toBe(id);
    expect(b.rows).toEqual([
      ["u-closer", 3],
      ["u-closer2", 5],
    ]); /* unbekannte Personen fliegen raus */
    expect(await notifsOf("u-closer")).toContain("Neue Rangliste: Cup Oktober – du bist auf Platz 2");
  });
});

describe("Auszahlungen", () => {
  beforeAll(async () => {
    await db.insert(schema.payout).values([
      { id: "p1", userId: "u-closer", periode: "September 2026", betrag: 1200, datum: "15.10.2026" },
      { id: "p2", userId: "u-setter", periode: "September 2026", betrag: 300, datum: "15.10.2026" },
    ]);
  });

  it("MAs sehen nur ihre eigenen Abrechnungen, Admins alle", async () => {
    expect(Object.keys((await ws.loadWorkspace(closer)).payouts)).toEqual(["u-closer"]);
    expect(Object.keys((await ws.loadWorkspace(admin)).payouts).sort()).toEqual(["u-closer", "u-setter"]);
  });

  it("nur Admins geben frei – einmalig, mit Protokoll und Benachrichtigung", async () => {
    await expect(ws.releasePayout(closer, "p1")).rejects.toThrow(/Berechtigung/);
    await ws.releasePayout(admin, "p1");
    await expect(ws.releasePayout(admin, "p1")).rejects.toThrow(/schon freigegeben/);
    const log = await db.select().from(schema.auditLog);
    expect(log.some((l) => l.action === "payout.release" && l.targetUserId === "u-closer")).toBe(true);
    expect(await notifsOf("u-closer")).toContain("Deine Abrechnung September 2026 wurde freigegeben (1.200 €)");
  });
});

describe("Benachrichtigungen und Einstellungen", () => {
  it("nur die eigenen werden als gelesen markiert", async () => {
    await ws.markNotificationsRead(closer);
    expect((await ws.loadWorkspace(closer)).notifications.every((n) => !n.unread)).toBe(true);
    expect((await ws.loadWorkspace(closer2)).notifications.some((n) => n.unread)).toBe(true);
  });

  it("Monatsziel wird gespeichert und begrenzt", async () => {
    await ws.setMoneyGoal(setter, 4500.4);
    expect((await ws.loadWorkspace(setter)).moneyGoal).toBe(4500);
    await ws.setMoneyGoal(setter, -5);
    expect((await ws.loadWorkspace(setter)).moneyGoal).toBe(0);
  });
});

import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { Viewer } from "@/server/workspace";

/* Team-Alltag: Rechte und Abläufe gegen eine echte Datenbank (PGlite im Speicher). */

vi.mock("@/server/db", async () => (await import("./db")).createTestDb());
/* Kein Pipedrive in Tests → Setter-Benachrichtigung zu Pipedrive-Leads entfällt */
vi.mock("@/server/pipedrive/client", () => ({
  getRecentNotes: async () => [],
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
    const a = await ws.bookSlot(presetter, slotId, { id: "PD-1", kunde: "Familie Test", ort: "Leipzig" });
    expect(a.closer).toBe("u-closer");
    await expect(ws.bookSlot(presetter, slotId, { id: "PD-2", kunde: "Andere", ort: "" })).rejects.toThrow(/nicht mehr frei/);
    expect((await notifsOf("u-closer")).some((t) => t.startsWith("Neuer Aufmaßtermin: Familie Test"))).toBe(true);
  });

  it("Termine sieht der zuständige Closer und wer gebucht hat – andere Closer nicht", async () => {
    expect((await ws.loadWorkspace(closer)).appointments).toHaveLength(1);
    expect((await ws.loadWorkspace(setter)).appointments).toHaveLength(0); /* gebucht hat die Presetterin */
    expect((await ws.loadWorkspace(presetter)).appointments).toHaveLength(1);
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

describe("Termin direkt eintragen", () => {
  it("nur Setter/Presetter; nur echte Closer; keine Überschneidung; passender Slot wird verbraucht", async () => {
    const lead = { id: "PD-50", kunde: "Direkt Kunde", ort: "Leipzig" };
    await expect(ws.bookDirect(closer, lead, { date: tomorrow, start: 14, closerId: "u-closer" })).rejects.toThrow(/Berechtigung/);
    await expect(ws.bookDirect(presetter, lead, { date: tomorrow, start: 14, closerId: "u-setter" })).rejects.toThrow(/Closer wählen/);
    await expect(ws.bookDirect(presetter, lead, { date: "2020-01-01", start: 14, closerId: "u-closer" })).rejects.toThrow(/ab heute/);
    await expect(ws.bookDirect(presetter, lead, { date: tomorrow, start: 14.25, closerId: "u-closer" })).rejects.toThrow(/Uhrzeit/);
    const [slot] = await ws.addSlots(closer2, [{ date: tomorrow, start: 15 }]);
    const a = await ws.bookDirect(presetter, lead, { date: tomorrow, start: 15.5, closerId: "u-closer2" });
    expect(a).toMatchObject({ closer: "u-closer2", start: 15.5 });
    expect((await ws.loadWorkspace(presetter)).slots.some((x) => x.id === slot.id)).toBe(false);
    await expect(ws.bookDirect(setter, { ...lead, id: "PD-51" }, { date: tomorrow, start: 16.5, closerId: "u-closer2" })).rejects.toThrow(/schon einen Termin/);
    expect((await ws.loadWorkspace(presetter)).closers.sort()).toEqual(["u-closer", "u-closer2"]);
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
    /* ohne IBAN keine Freigabe */
    await expect(ws.releasePayout(admin, "p1")).rejects.toThrow(/IBAN fehlt/);
    await db.insert(schema.profile).values({ userId: "u-closer", ibanEnc: "verschluesselt", ibanLast4: "1234" });
    await ws.releasePayout(admin, "p1");
    await expect(ws.releasePayout(admin, "p1")).rejects.toThrow(/schon freigegeben/);
    const log = await db.select().from(schema.auditLog);
    expect(log.some((l) => l.action === "payout.release" && l.targetUserId === "u-closer")).toBe(true);
    expect(await notifsOf("u-closer")).toContain("Deine Abrechnung September 2026 wurde freigegeben (1.200 €) – Auszahlung am 15.10.2026");
  });
});

describe("Provisionen: Termin, Verkauf, TBK, Abrechnung, Storno", () => {
  it("vom Aufmaßtermin bis zur Auszahlung – mit Umsatzsteuer, Rückfrage und Gegenbuchung nach Storno", async () => {
    const prov = await import("@/server/provisions");
    const base = { leadId: "PD-77", kunde: "Familie Provision" };
    await prov.onLeadStatus({ ...base, status: "aufmass", presetterId: "u-pre" });
    await prov.onLeadStatus({ ...base, status: "aufmass", presetterId: "u-pre" }); /* doppelt → nur einmal */
    await prov.onLeadStatus({ ...base, status: "verkauft", setterId: "u-setter", closerId: "u-closer" });
    let rows = await db.select().from(schema.provision).where(eq(schema.provision.leadId, "PD-77"));
    expect(rows.map((r) => [r.role, r.userId, r.betrag, r.status]).sort()).toEqual([
      ["closer", "u-closer", 1000, "tbk"],
      ["presetter", "u-pre", 250, "tbk"],
      ["setter", "u-setter", 1000, "tbk"],
    ]);
    /* noch nicht fest → keine Abrechnung */
    expect(await prov.runSettlement(new Date(2099, 0, 1))).toEqual([]);
    await expect(prov.markTbk(closer, "PD-77")).rejects.toThrow(/Berechtigung/);
    expect(await prov.markTbk(admin, "PD-77")).toBe(3);
    /* Rückfrage nur zur eigenen Position, Antwort vom Admin */
    const setterRow = (await db.select().from(schema.provision).where(eq(schema.provision.userId, "u-setter")))[0];
    await expect(prov.askProvision(closer, setterRow.id, "Warum?")).rejects.toThrow(/nicht gefunden/);
    await prov.askProvision(setter, setterRow.id, "Wann kommt das Geld?");
    expect((await notifsOf("u-admin")).some((t) => t.startsWith("Rückfrage von Sven zu Familie Provision"))).toBe(true);
    await prov.answerProvision(admin, setterRow.id, "Am 10.");
    expect(await notifsOf("u-setter")).toContain("Antwort zu Familie Provision: Am 10.");
    /* Abrechnung zum 1.1.2099: Closer (kein Kleinunternehmer) mit 19 % USt, Auszahlung am 10. */
    const ids = await prov.runSettlement(new Date(2099, 0, 1));
    expect(ids).toHaveLength(3);
    expect(await prov.runSettlement(new Date(2099, 0, 1))).toEqual([]); /* zweiter Lauf: nichts doppelt */
    const [closerPay] = await db.select().from(schema.payout).where(eq(schema.payout.id, ids.find((i) => i.endsWith("u-closer"))!));
    expect(closerPay).toMatchObject({ netto: 1000, ust: 190, betrag: 1190, datum: "10.01.2099", hinweis: null });
    const [setterPay] = await db.select().from(schema.payout).where(eq(schema.payout.userId, "u-setter")).orderBy(schema.payout.createdAt);
    expect(setterPay).toBeDefined();
    /* Storno nach der Abrechnung → Gegenbuchung −1.000 € für die nächste */
    await prov.storno(admin, "PD-77", "Widerruf innerhalb von 14 Tagen");
    rows = await db.select().from(schema.provision).where(eq(schema.provision.leadId, "PD-77"));
    expect(rows.filter((r) => r.role.startsWith("storno-")).map((r) => r.betrag).sort()).toEqual([-1000, -1000, -250]);
    /* Freigabe + Auszahlungstag */
    await ws.releasePayout(admin, closerPay.id);
    await prov.markPaid(new Date(2099, 0, 9)); /* einen Tag vorher: noch nicht */
    expect((await db.select().from(schema.payout).where(eq(schema.payout.id, closerPay.id)))[0].status).toBe("freigegeben");
    expect(await prov.markPaid(new Date(2099, 0, 10))).toBe(1);
    expect((await db.select().from(schema.payout).where(eq(schema.payout.id, closerPay.id)))[0].status).toBe("ausgezahlt");
  });

  it("Absage storniert offene Provisionen automatisch; Stichtage 1./15. → Auszahlung 10./25.", async () => {
    const prov = await import("@/server/provisions");
    await prov.onLeadStatus({ leadId: "PD-78", kunde: "Familie Absage", status: "aufmass", presetterId: "u-pre" });
    await prov.onLeadStatus({ leadId: "PD-78", kunde: "Familie Absage", status: "verloren", reason: "Zu teuer" });
    const [r] = await db.select().from(schema.provision).where(eq(schema.provision.leadId, "PD-78"));
    expect(r).toMatchObject({ status: "storno", grund: "Kein Verkauf – Zu teuer" });
    const { nextRun, deDate } = await import("@/lib/payouts");
    const n = (d: Date) => [deDate(nextRun(d).stichtag), deDate(nextRun(d).zahltag)];
    expect(n(new Date(2026, 9, 1))).toEqual(["01.10.2026", "10.10.2026"]);
    expect(n(new Date(2026, 9, 4))).toEqual(["15.10.2026", "25.10.2026"]);
    expect(n(new Date(2026, 9, 20))).toEqual(["01.11.2026", "10.11.2026"]);
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

describe("Termin vormerken (Zwei-Schritte-System)", () => {
  const inThreeDays = (() => {
    const d = new Date(Date.now() + 3 * 864e5);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();

  it("Zwei-Schritte-System: Setter merkt nur vor, Presetter bestätigt – erst dann wird der Closer informiert", async () => {
    const [slot] = await ws.addSlots(closer2, [{ date: inThreeDays, start: 15 }]);
    const r = await ws.bookSlot(setter, slot.id, { id: "PD-9", kunde: "Familie Vormerk", ort: "Halle" }, "setter");
    expect(r.reserved).toBe(true);
    expect((await notifsOf("u-closer2")).some((t) => t.includes("Familie Vormerk"))).toBe(false);
    expect((await notifsOf("u-pre")).some((t) => t.startsWith("Termin vorgemerkt: Familie Vormerk"))).toBe(true);
    /* Closer sieht nur „reserviert“ ohne Kunde, und der Lead ist für ihn nicht freigegeben */
    const seen = (await ws.loadWorkspace({ id: "u-closer2", roles: ["closer"] })).appointments.find((x) => x.id === r.id)!;
    expect(seen).toMatchObject({ reserved: true, lead: "", kunde: null });
    expect((await ws.leadIdsForCloser("u-closer2")).has("PD-9")).toBe(false);
    /* Setter darf nicht bestätigen, Presetter schon */
    await expect(ws.confirmReservation(setter, r.id)).rejects.toThrow(/Presetter/);
    await ws.confirmReservation(presetter, r.id);
    expect((await notifsOf("u-closer2")).some((t) => t.startsWith("Neuer Aufmaßtermin: Familie Vormerk"))).toBe(true);
    expect((await ws.leadIdsForCloser("u-closer2")).has("PD-9")).toBe(true);
    await expect(ws.confirmReservation(presetter, r.id)).rejects.toThrow(/Vormerkung/);
  });

  it("Vormerkung lösen gibt den Slot wieder frei; unbestätigte Vormerkungen verfallen 24 Std. vorher", async () => {
    const [slot] = await ws.addSlots(closer2, [{ date: inThreeDays, start: 16 }]);
    const r = await ws.bookSlot(setter, slot.id, { id: "PD-10", kunde: "Familie Lösen", ort: "" }, "setter");
    await ws.releaseReservation(presetter, r.id, "passt nicht");
    const slots = await db.select().from(schema.closerSlot);
    expect(slots.some((x) => x.date === inThreeDays && x.start === 16)).toBe(true);
    expect((await notifsOf("u-setter")).some((t) => t.includes("Vormerkung") && t.includes("passt nicht"))).toBe(true);
    /* in drei Tagen 16 Uhr: heute noch nicht fällig, aus Sicht „in drei Tagen“ schon */
    const [slot2] = await db.select().from(schema.closerSlot).where(eq(schema.closerSlot.start, 16));
    const r2 = await ws.bookSlot(setter, slot2.id, { id: "PD-11", kunde: "Familie Verfall", ort: "" }, "setter");
    expect(await ws.releaseStaleReservations()).toBe(0);
    expect(await ws.releaseStaleReservations(new Date(Date.now() + 3 * 864e5))).toBeGreaterThanOrEqual(1);
    expect((await db.select().from(schema.appointment).where(eq(schema.appointment.id, r2.id))).length).toBe(0);
  });
});

import { describe, expect, it } from "vitest";
import { bookableSlots, closerPaused, freeSlots } from "@/lib/appointments";
import { formatIban, isValidIban } from "@/lib/iban";
import { defaultRole, isAdmin, parseRoles, serializeRoles, viewableRoles } from "@/lib/roles";
import { computeStats } from "@/lib/stats";
import type { Appointment, Lead, Slot } from "@/lib/types";

/* Reine Logik ohne Datenbank und ohne Netzwerk. */

describe("Rollen", () => {
  it("liest mehrere Rollen in fester Reihenfolge und ignoriert Unbekanntes", () => {
    expect(parseRoles("closer, ADMIN,setter,foo")).toEqual(["setter", "closer", "admin"]);
    expect(serializeRoles(["admin", "setter"])).toBe("setter,admin");
  });
  it("Admins dürfen alle Ansichten öffnen, MAs nur ihre eigenen", () => {
    expect(viewableRoles(["admin"])).toEqual(["setter", "presetter", "closer", "admin"]);
    expect(viewableRoles(["setter", "closer"])).toEqual(["setter", "closer"]);
    expect(isAdmin(["closer"])).toBe(false);
    expect(defaultRole(["presetter", "closer"])).toBe("presetter");
    expect(defaultRole(["setter", "admin"])).toBe("admin");
  });
});

describe("IBAN", () => {
  it("prüft die Prüfsumme", () => {
    expect(isValidIban("DE89 3704 0044 0532 0130 00")).toBe(true);
    expect(isValidIban("DE89 3704 0044 0532 0130 01")).toBe(false);
    expect(isValidIban("DE8937040044053201300")).toBe(false); /* zu kurz für DE */
  });
  it("formatiert in Viererblöcken", () => {
    expect(formatIban("de89370400440532013000")).toBe("DE89 3704 0044 0532 0130 00");
  });
});

describe("Closer-Kalender", () => {
  const now = new Date(2026, 8, 30, 12, 0);
  const slot = (id: string, closer: string, date: string, start: number): Slot => ({ id, closer, date, start });
  const appt = (id: string, closer: string, date: string, start: number, feedback = false): Appointment => ({
    id,
    lead: "PD-1",
    closer,
    kind: "erst",
    date,
    start,
    dur: 1.5,
    ort: "",
    feedback: feedback ? { result: "checks", at: "" } : null,
  });

  it("zeigt nur künftige Slots, sortiert", () => {
    const s = [slot("a", "c1", "2026-10-01", 9), slot("b", "c1", "2026-09-30", 10), slot("c", "c1", "2026-09-30", 16)];
    expect(freeSlots(s, [], "c1", now).map((x) => x.id)).toEqual(["c", "a"]);
  });

  it("pausiert Closer mit überfälliger Rückmeldung und nimmt ihre Slots aus der Buchung", () => {
    const appts = [appt("t1", "c1", "2026-09-27", 10)]; /* vor 3 Tagen, ohne Rückmeldung */
    expect(closerPaused(appts, "c1", now)).toBe(true);
    const s = [slot("a", "c1", "2026-10-01", 9), slot("b", "c2", "2026-10-01", 11)];
    const r = bookableSlots(s, appts, now);
    expect(r.slots.map((x) => x.id)).toEqual(["b"]);
    expect(r.closers).toEqual(["c2"]);
    expect(r.paused).toEqual(["c1"]);
  });

  it("mit Rückmeldung ist der Closer wieder buchbar", () => {
    const appts = [appt("t1", "c1", "2026-09-27", 10, true)];
    expect(closerPaused(appts, "c1", now)).toBe(false);
  });
});

describe("Kennzahlen aus Leads", () => {
  const lead = (id: string, setter: string, datum: string, status: Lead["status"], reason: string | null = null): Lead => ({
    id,
    pd: null,
    kunde: id,
    anrede: id,
    tel: "",
    ort: "",
    produkt: "wp",
    status,
    setter,
    datum,
    setNote: "",
    preNote: "",
    hist: [["Lead eingereicht", `${datum.slice(0, 6)} 10:00`]],
    attempts: 0,
    nextTry: null,
    reason,
    reasonNote: "",
    eigenlead: true,
  });
  const now = new Date(2026, 8, 30, 12, 0);
  const leads = [
    lead("1", "anna", "29.09.2026", "eingereicht"),
    lead("2", "anna", "28.09.2026", "termin"),
    lead("3", "ben", "10.09.2026", "verkauft"),
    lead("4", "ben", "11.09.2026", "verloren", "Zu teuer"),
    lead("5", "anna", "20.08.2026", "termin"),
    lead("6", "unbekannt", "15.09.2026", "eingereicht"),
  ];
  const s = computeStats(leads, now);

  it("zählt den laufenden Monat und den Vormonat", () => {
    expect(s.adminKpi).toMatchObject({ monat: "September", vormonat: "August", leads: 5, leadsVormonat: 1, termin: 3, verkauft: 1 });
  });
  it("je Setter, ohne „unbekannt“", () => {
    expect(s.perSetter.map((p) => [p.key, p.leads, p.termin])).toEqual([
      ["anna", 2, 1],
      ["ben", 2, 2],
    ]);
  });
  it("Verlustgründe und Monatsende", () => {
    expect(s.lossStats).toEqual([["Zu teuer", 1]]);
    expect(s.monatsende).toBe("30.09.2026");
  });
});

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
    lead("2", "anna", "28.09.2026", "aufmass"),
    lead("3", "ben", "10.09.2026", "verkauft"),
    lead("4", "ben", "11.09.2026", "verloren", "Zu teuer"),
    lead("5", "anna", "20.08.2026", "aufmass"),
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

describe("Rückruf-Fälligkeit", () => {
  it("berücksichtigt das Jahr im Rückrufwunsch", async () => {
    const { callbackDue, callbackLate } = await import("@/lib/leads");
    const now = new Date(2026, 9, 2, 10, 0);
    const l = { nextTry: "Rückruf Mo. 01.03.2027, 09:39 Uhr" } as Parameters<typeof callbackDue>[0];
    expect(callbackDue(l, now)?.getFullYear()).toBe(2027);
    expect(callbackLate(l, now)).toBe(false);
    expect(callbackLate({ ...l, nextTry: "Rückruf 01.10. 18:00" }, now)).toBe(true);
  });
});

describe("E-Mail-Textfassung", () => {
  it("macht aus dem HTML-Layout lesbaren Text mit ausgeschriebenem Link", async () => {
    const { mailLayout, htmlToText } = await import("@/server/mail");
    const t = htmlToText(mailLayout({ title: "Passwort zurücksetzen", intro: "Über den Button legst du es fest.", button: "Neues Passwort festlegen", url: "https://x.test/a?b=1&c=2", outro: "48 Stunden gültig." }));
    expect(t).toContain("Passwort zurücksetzen");
    expect(t).toContain("Neues Passwort festlegen: https://x.test/a?b=1&c=2");
    expect(t.match(/Passwort zurücksetzen/g)).toHaveLength(1);
    expect(t).not.toMatch(/<|&amp;/);
  });
});

describe("Closer-Kennzahlen und To-Dos", () => {
  it("Rückmeldungen heute, Woche, Serie und Quoten mit Teamschnitt", async () => {
    const { closerStats } = await import("@/lib/closer-stats");
    const a = (closerId: string, leadId: string, kind: string, date: string, feedbackResult: string | null, feedbackAt: string | null) => ({ closerId, leadId, kind, date, kunde: `Kunde ${leadId}`, feedbackResult, feedbackAt });
    const appts = [
      a("leo", "L1", "erst", "2026-09-28", "checks", "2026-09-28T18:00:00Z"),
      a("leo", "L1", "closing", "2026-09-29", "verkauft", "2026-09-29T17:00:00Z"),
      a("leo", "L2", "erst", "2026-09-30", "nicht_angetroffen", "2026-09-30T09:00:00Z"),
      a("leo", "L3", "erst", "2026-09-30", null, null),
      a("max", "L4", "erst", "2026-09-29", "verloren", "2026-09-29T12:00:00Z"),
    ];
    const s = closerStats(appts, "leo", new Date("2026-09-30T15:00:00Z"));
    expect(s.doneToday).toEqual([{ what: "Rückmeldung Aufmaßtermin", leadId: "L2", who: "Kunde L2", time: "11:00" }]);
    expect(s.week.slice(0, 4)).toEqual([["Mo", 1, 1], ["Di", 1, 1], ["Mi", 1, 2], ["Do", null, 0]]);
    expect(s.streak).toBe(2);
    expect(s).toMatchObject({ verkaufQuote: 100, checksQuote: 100, teamVerkaufQuote: 50, teamChecksQuote: 50 });
  });

  it("To-Dos: Presetter-Anrufe nach Dringlichkeit, Setter-Tagesziel, offene Verträge", async () => {
    const { todoItems } = await import("@/lib/todos");
    const now = new Date(2026, 8, 30, 15, 0);
    const person = (k: string) => ({ key: k, name: k, first: k, role: "setter" as const, initials: "" });
    const base = { now, appts: [], slots: [], person, openContracts: 1 };
    const mk = (id: string, status: Lead["status"], extra: Partial<Lead>): Lead => ({
      id, pd: null, kunde: `Kunde ${id}`, anrede: "", tel: "", ort: "", produkt: "wp", status, setter: "anna", presetter: "pia", datum: "28.09.2026",
      setNote: "", preNote: "", hist: [], attempts: 0, nextTry: null, reason: null, reasonNote: "", eigenlead: true, ...extra,
    });
    const leads = [
      mk("1", "eingereicht", { hist: [["Lead eingereicht", "28.09. 09:00"]] }),
      mk("2", "terminierung", { attempts: 1, nextTry: "Rückruf 01.10. 18:00", hist: [["Lead eingereicht", "30.09. 14:00"]] }),
    ];
    const p = todoItems({ ...base, role: "presetter", me: "pia", leads });
    expect(p.map((t) => [t.group, t.what, t.who])).toEqual([
      ["over", "Anruf überfällig", "Kunde 1"],
      ["today", "Vertrag unterschreiben", "Verträge"],
      ["later", "Rückruf", "Kunde 2"],
    ]);
    const s = todoItems({ ...base, role: "setter", me: "anna", leads, leadsToday: 2, dayGoal: 5, openContracts: 0 });
    expect(s.map((t) => t.what)).toEqual(["Noch 3 Leads"]);
    /* vom Setter vorgemerkter Termin übermorgen → „bestätigen“, unter 48 Std. rot */
    const appts = [{ id: "t1", lead: "1", closer: "leo", kind: "erst" as const, date: "2026-10-01", start: 14, dur: 1.5, ort: "", feedback: null, reserved: true }];
    const r = todoItems({ ...base, role: "presetter", me: "pia", leads, appts, openContracts: 0 });
    expect(r[0]).toMatchObject({ group: "over", tone: "bad", what: "Vorgemerkten Termin bestätigen", who: "Kunde 1" });
    /* alter Rückrufwunsch (> 7 Tage) ist nicht mehr überfällig */
    const alt = todoItems({ ...base, role: "presetter", me: "pia", leads: [mk("3", "eingereicht", { nextTry: "Rückruf 01.09. 18:00", hist: [["Lead eingereicht", "28.08. 09:00"]] })], openContracts: 0 });
    expect(alt[0]).toMatchObject({ group: "today", tone: "warn", what: "Wartet auf Anruf" });
  });
});

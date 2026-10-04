import { describe, expect, it } from "vitest";
import { faqFor, FAQS, LOCKED_TOUR, stepsFor, TOURS } from "@/lib/engel";
import { allowedView, navFor, NAV } from "@/lib/nav";

/* „Frag den Engel“: Jeder Rundgang führt nur zu Ansichten, die es für die Rolle gibt – auch für gesperrte Rollen. */

describe("Engel: Rundgang und FAQ", () => {
  it("jeder Schritt führt zu einer Ansicht der Rolle", () => {
    for (const role of ["setter", "presetter", "closer", "admin"] as const) {
      const views = NAV[role].map((i) => i[0]);
      for (const s of TOURS[role]) expect(views, `${role}: ${s.t}`).toContain(s.view);
      expect(FAQS[role].length).toBeGreaterThan(2);
    }
  });
  it("gesperrte Rolle: kurze Tour nur durch offene Bereiche, FAQ nur zur Akademie", () => {
    for (const role of ["setter", "presetter", "closer"] as const) {
      const open = navFor(role, [role]).map((i) => i[0]);
      expect(open).toEqual(["akademie", "vertraege", "events", "stammdaten"]);
      for (const s of LOCKED_TOUR) expect(open).toContain(s.view);
      expect(stepsFor(role, [role])).toBe(LOCKED_TOUR);
      expect(faqFor(role, [role]).every(([q]) => /gesperrt|Test/.test(q))).toBe(true);
      expect(stepsFor(role, [])).toBe(TOURS[role]);
    }
  });
  it("gesperrte Rolle landet immer in der Akademie, andere Rollen in der Übersicht", () => {
    expect(allowedView("closer", "leads", ["closer"])).toBe("akademie");
    expect(allowedView("closer", "vertraege", ["closer"])).toBe("vertraege");
    expect(allowedView("closer", "leads", [])).toBe("uebersicht");
    expect(allowedView("setter", "leads", ["closer"])).toBe("leads");
  });
});

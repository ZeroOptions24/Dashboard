import { describe, expect, it, vi } from "vitest";

/* Liste „Name – E-Mail – Rollen“ einlesen (bestehende MAs übernehmen). Erfundene Beispielnamen. */

vi.mock("@/server/db", () => ({ db: {}, schema: {} }));
vi.mock("@/server/auth", () => ({ auth: {} }));
vi.mock("@/server/onboarding", () => ({ inviteMember: vi.fn() }));

const { parseImport } = await import("@/server/team");

describe("Team-Import", () => {
  it("erkennt Trenner, Rollen und „alle Rollen“", () => {
    const r = parseImport(
      [
        "Erika Beispiel – erika@beispiel.test – Setter, Presetter, Closer",
        "Otto Muster - otto@beispiel.test - Presetterin",
        "Ada Admin; ada@beispiel.test; admin, alle Rollen",
        "Nur Name ohne Mail – Setter",
        "Karl Kein – karl@beispiel.test – Chef",
      ].join("\n"),
    );
    expect(r.map((l) => [l.name, l.email, l.roles, l.error])).toEqual([
      ["Erika Beispiel", "erika@beispiel.test", ["setter", "presetter", "closer"], undefined],
      ["Otto Muster", "otto@beispiel.test", ["presetter"], undefined],
      ["Ada Admin", "ada@beispiel.test", ["setter", "presetter", "closer", "admin"], undefined],
      ["Nur Name ohne Mail – Setter", "", [], "E-Mail fehlt"],
      ["Karl Kein", "karl@beispiel.test", [], "Rolle nicht erkannt"],
    ]);
  });

  it("„Presetter“ zählt nicht zusätzlich als „Setter“", () => {
    expect(parseImport("A B – a@beispiel.test – Presetter")[0].roles).toEqual(["presetter"]);
  });
});

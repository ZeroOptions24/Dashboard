import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PdDeal, PdPerson } from "@/server/pipedrive/client";

/* Pipedrive → Leads: Zuordnung, Filter je Rolle und Schutz der Telefonnummer.
   Die Pipedrive-API ist durch erfundene Deals ersetzt. */

const SETTER_FIELD = "3142c8c9e9e0bf916f449d2918b8baa84b6590ba";
const deal = (id: number, setter: string, stage = 180, status: PdDeal["status"] = "open"): PdDeal => ({
  id,
  title: `Wärmepumpe – Kunde ${id}`,
  person_id: id,
  stage_id: stage,
  pipeline_id: 21,
  status,
  lost_reason: null,
  add_time: "2026-09-28 08:00:00",
  update_time: "2026-09-28 08:00:00",
  stage_change_time: null,
  won_time: null,
  lost_time: null,
  owner_id: 1,
  custom_fields: { [SETTER_FIELD]: setter },
});
const person = (id: number): PdPerson => ({ id, name: `Kunde ${id}`, phones: [{ value: `0170 123450${id}`, primary: true }], postal_address: { locality: "Leipzig" } });

vi.mock("@/server/pipedrive/client", () => ({
  getDeals: vi.fn(async () => [deal(1, "Max"), deal(2, "Florian", 183), deal(3, "", 184, "won"), { ...deal(4, "Max"), title: "PV – Kunde 4" }, { ...deal(5, "Florian", 249), title: "Enpal – Kunde 5" }]),
  getPersons: vi.fn(async (ids: number[]) => ids.map(person)),
}));

describe("Pipedrive-Leads", () => {
  beforeEach(() => vi.resetModules());

  it("übersetzt Stufen, maskiert Nummern und nimmt nur Wärmepumpen und Enpal", async () => {
    const { loadLeadsFromPipedrive } = await import("@/server/pipedrive/leads");
    const leads = await loadLeadsFromPipedrive();
    expect(leads.map((l) => [l.id, l.status, l.setter])).toEqual(
      expect.arrayContaining([
        ["PD-1", "eingereicht", "max"],
        ["PD-2", "checks", "florian"],
        ["PD-3", "verkauft", "unbekannt"],
      ]),
    );
    expect(leads.some((l) => l.id === "PD-4")).toBe(false);
    expect(leads.find((l) => l.id === "PD-5")).toMatchObject({ kunde: "Kunde 5", setter: "florian", attempts: 2 });
    expect(leads.find((l) => l.id === "PD-1")!.tel).toBe("0170 •••• 4501");
  });

  it("Setter sehen nur eigene Leads und nie die volle Nummer", async () => {
    const { loadLeadsForUser } = await import("@/server/pipedrive/leads");
    const r = await loadLeadsForUser({ id: "user-max", roles: ["setter"] }, { setterIds: new Map([["max", "user-max"]]) });
    expect(r.keys.setter).toBe("user-max");
    expect(r.leads.map((l) => l.id)).toEqual(["PD-1"]);
    expect(r.leads[0].setter).toBe("user-max");
    expect(r.leads[0].telFull).toBeUndefined();
  });

  it("Zuweisung im Dashboard gilt nur, wenn in Pipedrive kein Setter steht", async () => {
    const { loadLeadsForUser } = await import("@/server/pipedrive/leads");
    const assignments = new Map([
      ["PD-3", "Max"] /* in Pipedrive leer → gilt */,
      ["PD-2", "Max"] /* in Pipedrive „Florian“ → Pipedrive hat Vorrang */,
    ]);
    const r = await loadLeadsForUser({ id: "user-max", roles: ["setter"] }, { setterIds: new Map([["max", "user-max"]]), assignments });
    expect(r.leads.map((l) => [l.id, l.setterFromDashboard ?? false])).toEqual([
      ["PD-1", false],
      ["PD-3", true],
    ]);
  });

  it("Closer sehen Leads mit Termin bei ihnen – mit voller Nummer", async () => {
    const { loadLeadsForUser } = await import("@/server/pipedrive/leads");
    const r = await loadLeadsForUser({ id: "user-jana", roles: ["closer"] }, { setterIds: new Map(), closerLeadIds: new Set(["PD-2"]) });
    expect(r.leads.map((l) => [l.id, l.telFull])).toEqual([["PD-2", "0170 1234502"]]);
  });

  it("Admins sehen alles", async () => {
    const { loadLeadsForUser } = await import("@/server/pipedrive/leads");
    const r = await loadLeadsForUser({ id: "a", roles: ["admin"] }, { setterIds: new Map() });
    expect(r.leads).toHaveLength(4);
  });

  it("Presetter: gemeinsamer Pool aller offenen Leads mit voller Nummer", async () => {
    const { loadLeadsForUser } = await import("@/server/pipedrive/leads");
    const r = await loadLeadsForUser({ id: "p", roles: ["presetter"] }, { setterIds: new Map() });
    expect(r.keys.presetter).toBe("p");
    expect(r.leads.map((l) => [l.id, l.telFull])).toEqual([
      ["PD-1", "0170 1234501"],
      ["PD-5", "0170 1234505"],
    ]); /* nur „eingereicht“ (Wärmepumpe und Enpal) */
  });
});

describe("Telefonnummer im Browser", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });
  const l = { tel: "0170 •••• 4501" } as Parameters<typeof import("@/lib/leads").telFull>[0];

  it("echte Daten: nie eine erfundene Nummer, kein Anruf-Link ohne volle Nummer", async () => {
    vi.stubEnv("NEXT_PUBLIC_DATA_SOURCE", "pipedrive");
    const { telFull, telHref } = await import("@/lib/leads");
    expect(telFull(l)).toBe("0170 •••• 4501");
    expect(telHref(l)).toBeUndefined();
    expect(telHref({ ...l, telFull: "0170 1234501" })).toBe("tel:01701234501");
  });

  it("Beispieldaten: Demo-Ergänzung wie im Prototyp", async () => {
    vi.stubEnv("NEXT_PUBLIC_DATA_SOURCE", "demo");
    const { telFull } = await import("@/lib/leads");
    expect(telFull(l)).toBe("0170 4418 4501");
  });
});

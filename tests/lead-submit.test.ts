import { beforeAll, describe, expect, it, vi } from "vitest";

/* „Lead erfassen“ → n8n (wp-lead): Format wie das bisherige Formular, Setter-Code, Fehlerfälle.
   n8n ist durch ein nachgebautes fetch ersetzt – es entstehen keine echten Deals. */

vi.mock("@/server/db", async () => (await import("./db")).createTestDb());
vi.mock("@/server/pipedrive/client", () => ({
  getDeals: async () => [
    {
      id: 77,
      title: "Wärmepumpe – Erik Beispiel",
      person_id: 7,
      stage_id: 180,
      pipeline_id: 21,
      status: "open",
      lost_reason: null,
      add_time: "2026-09-29 08:00:00",
      update_time: "2026-09-29 08:00:00",
      stage_change_time: null,
      won_time: null,
      lost_time: null,
      owner_id: 1,
      custom_fields: {},
    },
  ],
  getPersons: async () => [{ id: 7, name: "Erik Beispiel", phones: [{ value: "+49 170 1234567", primary: true }] }],
}));

const { db, schema } = await import("@/server/db");
const { submitLead, buildLeadPayload, findDuplicates } = await import("@/server/lead-submit");

const values = {
  anrede: "Herr",
  vorname: "Erik",
  nachname: "Beispiel",
  telefon: "0170 1234567",
  email: "erik@beispiel.test",
  strasse: "Teststraße",
  hausnummer: "1",
  plz: "04109",
  stadt: "Leipzig",
  thema: ["Wärmepumpe"],
  alle_entscheider: "Ja, alle Entscheider sind dabei",
  zeitfenster: ["abends"],
  notizen: "Hund im Garten",
};
const setter = { id: "u-s", roles: ["setter" as const] };

beforeAll(async () => {
  await db.insert(schema.user).values({ id: "u-s", name: "Sara Setter", email: "s@beispiel.test", role: "setter", emailVerified: true });
  await db.insert(schema.profile).values({ userId: "u-s" });
});

describe("Lead an n8n", () => {
  it("Format wie das Setter-Formular", () => {
    const p = buildLeadPayload(values, "abc123", { lat: 51.3 }, new Date("2026-10-01T10:00:00Z"));
    expect(p.kunde).toMatchObject({ name: "Erik Beispiel", adresse: "Teststraße 1, 04109 Leipzig" });
    expect(p.termin).toEqual({ thema: ["Wärmepumpe"], thema_text: "Wärmepumpe", alle_entscheider: "Ja, alle Entscheider sind dabei" });
    expect(p.meta).toEqual({ quelle: "MB-Dashboard", setter: "abc123", standort: { lat: 51.3 }, datum: "2026-10-01T10:00:00.000Z" });
  });

  it("ohne Webhook-Adresse oder ohne Setter-Code wird nichts gesendet", async () => {
    const f = vi.spyOn(globalThis, "fetch");
    vi.stubEnv("N8N_WP_LEAD_URL", "");
    await expect(submitLead(setter, values, null)).rejects.toThrow(/nicht eingerichtet/);
    vi.stubEnv("N8N_WP_LEAD_URL", "https://n8n.beispiel.test/webhook/wp-lead");
    await expect(submitLead(setter, values, null)).rejects.toThrow(/Setter-Link-Code/);
    await expect(submitLead({ id: "x", roles: ["presetter"] }, values, null)).rejects.toThrow(/Nur Setter/);
    await expect(submitLead(setter, { ...values, telefon: "" }, null)).rejects.toThrow(/Pflichtfelder/);
    expect(f).not.toHaveBeenCalled();
  });

  it("sendet mit Setter-Code und liefert die Deal-ID", async () => {
    await db.update(schema.profile).set({ setterCode: "sara-7" });
    const f = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(JSON.stringify({ dealId: 4711 }), { status: 200 }));
    expect(await submitLead(setter, values, null)).toEqual({ dealId: 4711 });
    const [url, init] = f.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://n8n.beispiel.test/webhook/wp-lead");
    expect(JSON.parse(String(init.body)).meta.setter).toBe("sara-7");
  });

  it("n8n-Fehler wird gemeldet", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("", { status: 500 }));
    await expect(submitLead(setter, values, null)).rejects.toThrow(/HTTP 500/);
  });

  it("Dublettenprüfung: gleiche Telefonnummer (auch mit +49) oder gleicher Name, ohne Kundendaten", async () => {
    const byPhone = await findDuplicates(setter, { ...values, vorname: "Anna", nachname: "Andere" });
    expect(byPhone).toEqual([{ datum: "29.09.2026", status: "Lead eingereicht", grund: "Telefon" }]);
    const byName = await findDuplicates(setter, { ...values, telefon: "0151 999999" });
    expect(byName[0].grund).toBe("Name");
    expect(await findDuplicates(setter, { ...values, vorname: "Neu", nachname: "Kunde", telefon: "0151 999999" })).toEqual([]);
  });
});

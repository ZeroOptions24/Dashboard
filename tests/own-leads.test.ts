import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

/* Dashboard-Pipeline: Leads aus „Lead erfassen“ – Dashboard ist Quelle der Wahrheit, Pipedrive wird mitgeschrieben.
   Pipedrive ist nachgebaut; es entstehen keine echten Deals. */

vi.mock("@/server/db", async () => (await import("./db")).createTestDb());

const pd = {
  pipelines: [] as { id: number; name: string }[],
  stages: [] as { id: number; name: string; order_nr: number; pipeline_id: number }[],
  fields: [{ key: "3142c8c9e9e0bf916f449d2918b8baa84b6590ba", name: "Setter", field_type: "varchar" }, { key: "a18aeb8b11a681ca6c4222a80306fd59ea94ae43", name: "VQ Wohnfläche m2", field_type: "varchar" }],
  createPerson: vi.fn<(...a: unknown[]) => Promise<unknown>>(async () => 501),
  createDeal: vi.fn<(...a: unknown[]) => Promise<unknown>>(async () => 9001),
  patchDeal: vi.fn<(...a: unknown[]) => Promise<unknown>>(async () => ({})),
  addDealNote: vi.fn<(...a: unknown[]) => Promise<unknown>>(async () => ({})),
  deleteDeal: vi.fn<(...a: unknown[]) => Promise<unknown>>(async () => ({})),
};
vi.mock("@/server/pipedrive/client", () => ({
  PipedriveNotConfigured: class extends Error {},
  pipedriveWriteMode: () => "aus",
  getDeals: async () => [],
  getPersons: async () => [],
  getRecentNotes: async () => [],
  listPipelines: async () => pd.pipelines,
  createPipeline: async (name: string) => (pd.pipelines.push({ id: 77, name }), 77),
  listStages: async (id: number) => pd.stages.filter((s) => s.pipeline_id === id),
  createStage: async (pipeline_id: number, name: string) => {
    const id = 700 + pd.stages.length;
    pd.stages.push({ id, name, order_nr: id, pipeline_id });
    return id;
  },
  updateStage: async (id: number, patch: { name?: string; order_nr?: number }) => {
    const s = pd.stages.find((x) => x.id === id)!;
    if (patch.name) s.name = patch.name;
    if (patch.order_nr) s.order_nr = patch.order_nr;
  },
  listDealFields: async () => pd.fields,
  createDealField: async (name: string, field_type: string) => {
    const key = `k${pd.fields.length}`;
    pd.fields.push({ key, name, field_type });
    return key;
  },
  createPerson: (...a: unknown[]) => pd.createPerson(...a),
  createDeal: (...a: unknown[]) => pd.createDeal(...a),
  patchDeal: (...a: unknown[]) => pd.patchDeal(...a),
  addDealNote: (...a: unknown[]) => pd.addDealNote(...a),
  updateDeal: async () => ({}),
  deleteDeal: (...a: unknown[]) => pd.deleteDeal(...a),
}));

const { db, schema } = await import("@/server/db");
const setup = await import("@/server/pipedrive/dashboard-pipeline");
const own = await import("@/server/own-leads");
const la = await import("@/server/lead-activity");
const ws = await import("@/server/workspace");
const { submitLead } = await import("@/server/lead-submit");

const sara = { id: "u-sara", roles: ["setter" as const], name: "Sara Setter" };
const aimee = { id: "u-aimee", roles: ["presetter" as const], name: "Aimée Test" };
const carl = { id: "u-carl", roles: ["closer" as const], name: "Carl Closer" };
const values = {
  anrede: "Herr", vorname: "Erik", nachname: "Beispiel", telefon: "0170 1234567", email: "erik@beispiel.test",
  strasse: "Teststraße", hausnummer: "1", plz: "04109", stadt: "Leipzig", thema: ["Wärmepumpe"], alle_entscheider: "Ja",
  rueckruf_datum: "2026-10-05", rueckruf_uhrzeit: "18:00", zeitfenster: [], notizen: "Hund im Garten",
};
const tomorrow = (() => {
  const d = new Date(Date.now() + 864e5);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
})();

beforeAll(async () => {
  const u = (id: string, name: string, role: string) => ({ id, name, email: `${id}@beispiel.test`, role, emailVerified: true });
  await db.insert(schema.user).values([u("u-sara", "Sara Setter", "setter"), u("u-aimee", "Aimée Test", "presetter"), u("u-carl", "Carl Closer", "closer"), u("u-admin", "Ada Admin", "admin")]);
  await db.insert(schema.profile).values({ userId: "u-sara", pipedriveSetterName: "Sara" });
});
beforeEach(() => {
  pd.patchDeal.mockClear();
  pd.addDealNote.mockClear();
});

describe("Dashboard-Pipeline", () => {
  it("ohne Einrichtung bleibt der Lead im Dashboard und wird als offen vermerkt", async () => {
    const r = await own.createOwnLead("u-sara", values, null);
    expect(r.dealId).toBeNull();
    expect(r.syncError).toMatch(/nicht eingerichtet/);
    await db.delete(schema.ownLead);
  });

  it("legt Pipeline, Stufen und fehlende Felder an – zweiter Lauf erkennt alles wieder", async () => {
    const r1 = await setup.ensurePipeline("u-admin");
    expect(r1.created).toContain("Pipeline „MB-Dashboard Wärmepumpe“");
    expect(r1.config.stages).toEqual({
      eingereicht: 700,
      uebergeben: 701,
      kontakt: 702,
      anruf5: 703,
      aufmass: 704,
      checks: 705,
      verkaufstermin: 706,
      verkauft: 707,
      auszahlung: 708,
    });
    expect(r1.config.vq).toEqual({ wohnflaeche: "a18aeb8b11a681ca6c4222a80306fd59ea94ae43" });
    const r2 = await setup.ensurePipeline("u-admin");
    expect(r2.created).toEqual([]);
  });

  it("„Lead erfassen“: Person mit Adresse + Deal mit allen Feldern in der neuen Pipeline", async () => {
    const r = await submitLead(sara, values, { lat: 51.3, lon: 12.37 });
    expect(r.leadId).toMatch(/^MB-[a-f0-9]{10}$/);
    expect(r.dealId).toBe(9001);
    expect(pd.createPerson).toHaveBeenCalledWith(expect.objectContaining({ name: "Erik Beispiel", phone: "0170 1234567", address: expect.objectContaining({ postal_code: "04109", locality: "Leipzig" }) }));
    const deal = pd.createDeal.mock.calls[0][0] as { title: string; pipelineId: number; stageId: number; customFields: Record<string, unknown> };
    const cfg = (await setup.getPipelineConfig())!;
    expect(deal).toMatchObject({ title: "Wärmepumpe – Erik Beispiel", pipelineId: 77, stageId: 700 });
    /* sofort an den Presetter übergeben (Stufe 2) */
    expect(pd.patchDeal).toHaveBeenLastCalledWith(9001, { status: "open", stage_id: 701 });
    expect(deal.customFields).toMatchObject({
      [cfg.fields.setter]: "Sara",
      [cfg.fields.thema]: "Wärmepumpe",
      [cfg.fields.rueckruf]: "05.10.2026, 18:00 Uhr",
      [cfg.fields.setterNotiz]: "Hund im Garten",
      [cfg.fields.strasse]: "Teststraße 1",
      [cfg.fields.plz]: "04109",
      [cfg.fields.ort]: "Leipzig",
      [cfg.fields.gps]: "51.3, 12.37",
      [cfg.fields.dashboardId]: r.leadId,
    });
  });

  it("Presetter: Versuch, Vorqualifizierung, Termin – alles landet in Pipedrive, auch ohne PIPEDRIVE_WRITE", async () => {
    const [lead] = await own.loadOwnLeads();
    const cfg = (await setup.getPipelineConfig())!;
    expect(lead).toMatchObject({ setter: "u-sara", adresse: "Teststraße 1, 04109 Leipzig", nextTry: "Rückruf 05.10.2026 18:00" });

    await la.recordLeadAction(aimee, "presetter", lead.id, { type: "status", status: "nicht_erreicht", reason: "Mailbox" });
    /* erster Versuch: Terminierung → Stufe „2.–4. Kontaktversuch“ */
    expect(pd.patchDeal).toHaveBeenLastCalledWith(9001, expect.objectContaining({ status: "open", stage_id: 702, custom_fields: expect.objectContaining({ [cfg.fields.versuche]: 1, [cfg.fields.presetter]: "Aimée" }) }));
    expect(pd.addDealNote).toHaveBeenCalledWith(9001, expect.stringContaining("Nicht erreicht (Versuch 1) – Mailbox"));

    await la.recordLeadAction(aimee, "presetter", lead.id, { type: "vq", answers: { wohnflaeche: "140" } });
    expect(pd.patchDeal).toHaveBeenLastCalledWith(9001, expect.objectContaining({ custom_fields: expect.objectContaining({ a18aeb8b11a681ca6c4222a80306fd59ea94ae43: "140" }) }));
    /* alle Antworten zusätzlich als Text im Feld „MB Vorqualifizierung“ */
    expect(pd.patchDeal).toHaveBeenLastCalledWith(9001, expect.objectContaining({ custom_fields: expect.objectContaining({ [cfg.fields.vqAlle!]: "— Gebäude —\nBeheizbare Wohnfläche (m²): 140" }) }));

    await ws.bookDirect(aimee, { id: lead.id, kunde: lead.kunde, ort: lead.ort }, { date: tomorrow, start: 17, closerId: "u-carl" });
    await la.recordLeadAction(aimee, "presetter", lead.id, { type: "status", status: "aufmass" });
    expect(pd.patchDeal).toHaveBeenLastCalledWith(9001, expect.objectContaining({ stage_id: 704, custom_fields: expect.objectContaining({ [cfg.fields.closer]: "Carl", [cfg.fields.termin]: expect.stringMatching(/ 17:00$/) }) }));
    expect((await own.getOwnLead(lead.id))!.status).toBe("aufmass");
    /* A20: Presetter legt den Kunden im EPP an → EPP-ID in Pipedrive, Closer wird informiert */
    await expect(la.recordLeadAction(aimee, "presetter", lead.id, { type: "epp", eppId: "48 170!" })).rejects.toThrow(/EPP-ID/);
    await la.recordLeadAction(aimee, "presetter", lead.id, { type: "epp", eppId: "EPP-48170" });
    expect(pd.patchDeal).toHaveBeenLastCalledWith(9001, expect.objectContaining({ custom_fields: expect.objectContaining({ [cfg.fields.eppId!]: "EPP-48170" }) }));
    const n = await db.select().from(schema.notification);
    expect(n.some((x) => x.userId === "u-carl" && x.text.includes("EPP-ID EPP-48170"))).toBe(true);
  });

  it("Closer: Rückmeldung „verloren“ mit Grund → Deal verloren; Setter wird informiert", async () => {
    const [lead] = await own.loadOwnLeads();
    await la.recordLeadAction(carl, "closer", lead.id, { type: "status", status: "verloren", reason: "Zu teuer", note: "Angebot zu hoch" });
    expect(pd.patchDeal).toHaveBeenLastCalledWith(9001, expect.objectContaining({ status: "lost", lost_reason: "Zu teuer – Angebot zu hoch" }));
    const n = await db.select().from(schema.notification);
    expect(n.some((x) => x.userId === "u-sara" && x.text.includes("Verloren – Zu teuer"))).toBe(true);
  });

  it("Pipedrive-Fehler: Lead bleibt gespeichert, Fehler wird vermerkt und später nachgeholt", async () => {
    pd.createDeal.mockRejectedValueOnce(new Error("HTTP 500"));
    const r = await submitLead(sara, { ...values, vorname: "Anna", telefon: "0151 999999" }, null);
    expect(r.dealId).toBeNull();
    expect(r.warning).toMatch(/HTTP 500/);
    pd.createDeal.mockResolvedValueOnce(9002);
    const retry = await own.retryOwnLeadSync();
    expect(retry.find((x) => x.id === r.leadId)).toMatchObject({ dealId: 9002, error: null });
  });

  it("Admin löscht einen Test-Lead: Deal in den Papierkorb, Lead + Aktionen weg, protokolliert", async () => {
    const [lead] = await own.loadOwnLeads();
    await own.deleteOwnLead(lead.id, "u-admin");
    expect(pd.deleteDeal).toHaveBeenCalledWith(lead.pd);
    expect(await own.getOwnLead(lead.id)).toBeNull();
    expect((await db.select().from(schema.leadActivity)).some((a) => a.leadId === lead.id)).toBe(false);
    expect((await db.select().from(schema.auditLog)).some((a) => a.action === "lead.deleted")).toBe(true);
  });
});

describe("7 Stufen im Dashboard, 9 Stufen in Pipedrive", () => {
  it("Dashboard-Status → Pipedrive-Stufe (ab 5 Versuchen „5. Anruf +“)", async () => {
    const { stageFor } = await import("@/server/pipedrive/dashboard-pipeline");
    expect(stageFor("eingereicht", 0)).toBe("uebergeben");
    expect(stageFor("terminierung", 1)).toBe("kontakt");
    expect(stageFor("terminierung", 4)).toBe("kontakt");
    expect(stageFor("terminierung", 5)).toBe("anruf5");
    expect(stageFor("aufmass", 0)).toBe("aufmass");
    expect(stageFor("verkaufstermin", 0)).toBe("verkaufstermin");
    expect(stageFor("ausgezahlt", 0)).toBe("auszahlung");
  });

  it("Rückmeldung des Closers → Status", async () => {
    const { feedbackStatus } = await import("@/server/workspace");
    expect(feedbackStatus("checks", false)).toBe("checks");
    expect(feedbackStatus("checks", true)).toBe("verkaufstermin");
    expect(feedbackStatus("entscheidung", false)).toBe("verkaufstermin");
    expect(feedbackStatus("nicht_angetroffen", false)).toBe("terminierung");
    expect(feedbackStatus("verkauft", false)).toBe("verkauft");
  });

  it("alte Werte werden übersetzt; veraltete Pipeline-Einrichtung wird gemeldet", async () => {
    const { normStatus } = await import("@/lib/domain");
    expect(normStatus("termin")).toBe("aufmass");
    expect(normStatus("unsinn")).toBe("eingereicht");
    const cfg = (await setup.getPipelineConfig())!;
    const alt: Partial<typeof cfg.stages> = { ...cfg.stages };
    delete alt.verkaufstermin;
    await db.update(schema.appSetting).set({ value: JSON.stringify({ ...cfg, stages: alt }) }).where(eq(schema.appSetting.key, "pipedrive.dashboard"));
    const r = await own.createOwnLead("u-sara", values, null);
    expect(r.syncError).toMatch(/Stufen der Dashboard-Pipeline sind veraltet/);
    await setup.ensurePipeline("u-admin");
    expect((await setup.getPipelineConfig())!.stages.verkaufstermin).toBe(706);
  });
});

describe("Pipeline aus der ersten Einrichtung (4 Stufen)", () => {
  it("benennt alte Stufen um, ergänzt fehlende und sortiert – ohne Leads zu verlieren", async () => {
    /* Ausgangslage wie auf dem Server: Pipeline mit den 4 Stufen vom 03.10. */
    pd.stages.splice(0, pd.stages.length, ...["Lead eingereicht", "Termin gelegt", "In den Checks", "Verkauf"].map((name, i) => ({ id: 800 + i, name, order_nr: i + 1, pipeline_id: 77 })));
    const r = await setup.ensurePipeline("u-admin");
    expect(r.created).toContain("Stufe „Termin gelegt“ → „An Closer übergeben · Aufmaßtermin“");
    expect(r.config.stages).toMatchObject({ eingereicht: 800, aufmass: 801, checks: 802, verkauft: 803 });
    const sorted = pd.stages.filter((x) => x.pipeline_id === 77).sort((a, b) => a.order_nr - b.order_nr).map((x) => x.name);
    expect(sorted).toEqual(setup.PIPELINE_STAGES.map(([, name]) => name));
    expect((await setup.ensurePipeline("u-admin")).created).toEqual([]);
  });
});

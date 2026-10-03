import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { applyActivities, presetterStats, type ActivityRow } from "@/lib/lead-activity";
import type { Lead } from "@/lib/types";

/* Presetter-Pool, Verlauf, Kennzahlen und Zurückschreiben nach Pipedrive (erfundene Daten). */

const lead = (id: string, over: Partial<Lead> = {}): Lead => ({
  id,
  pd: Number(id.slice(3)),
  kunde: `Kunde ${id}`,
  anrede: "",
  tel: "0170 •••• 0001",
  telFull: "0170 0000001",
  ort: "",
  produkt: "wp",
  status: "eingereicht",
  setter: "max",
  datum: "30.09.2026",
  setNote: "",
  preNote: "",
  hist: [["Lead eingereicht", "30.09. 08:00"]],
  attempts: 0,
  nextTry: null,
  reason: null,
  reasonNote: "",
  eigenlead: true,
  pdAddTime: "2026-09-30T06:00:00.000Z",
  pdChangedAt: "2026-09-30T06:00:00.000Z",
  ...over,
});
const act = (leadId: string, userId: string, kind: ActivityRow["kind"], createdAt: string, data: Record<string, unknown> = {}, text: string = kind): ActivityRow => ({
  leadId,
  userId,
  role: "presetter",
  kind,
  text,
  data,
  createdAt,
});

describe("Aktivitäten auf Leads", () => {
  it("Versuche, Rückruf, Notiz, Vorqualifizierung und Status aus dem Dashboard", () => {
    const [l] = applyActivities(
      [lead("PD-1")],
      [
        act("PD-1", "u-aimee", "attempt", "2026-09-30T08:00:00Z", { attempt: 1 }, "Nicht erreicht (Versuch 1)"),
        act("PD-1", "u-aimee", "callback", "2026-09-30T09:00:00Z", { when: "01.10. 18:00" }, "Rückruf vereinbart: 01.10. 18:00"),
        act("PD-1", "u-aimee", "note", "2026-09-30T09:01:00Z", { text: "Frau entscheidet mit" }),
        act("PD-1", "u-aimee", "vq", "2026-09-30T09:02:00Z", { answers: { wohnflaeche: "140" } }),
      ],
    );
    expect(l).toMatchObject({ attempts: 1, nextTry: "Rückruf 01.10. 18:00", preNote: "Frau entscheidet mit", vq: { wohnflaeche: "140" }, presetter: "u-aimee", status: "terminierung" });
    expect(l.hist[0][0]).toBe("Rückruf vereinbart: 01.10. 18:00");
    expect(l.hist[0][1]).toBe("30.09. 11:00"); /* deutsche Zeit */
  });

  it("Dashboard-Status gilt, bis Pipedrive danach selbst geändert wurde", () => {
    const status = act("PD-1", "u-aimee", "status", "2026-09-30T10:00:00Z", { status: "aufmass" });
    expect(applyActivities([lead("PD-1")], [status])[0].status).toBe("aufmass");
    expect(applyActivities([lead("PD-1", { status: "checks", pdChangedAt: "2026-09-30T12:00:00Z" })], [status])[0].status).toBe("checks");
  });

  it("Standard-Presetter für Leads ohne eigene Presetter-Aktion", () => {
    const [a, b] = applyActivities([lead("PD-1"), lead("PD-2")], [act("PD-2", "u-lara", "attempt", "2026-09-30T08:00:00Z", { attempt: 1 })], "u-aimee");
    expect(a.presetter).toBe("u-aimee");
    expect(b.presetter).toBe("u-lara");
  });

  it("Presetter-Kennzahlen: Anrufe heute, Ø bis Erstanruf, Terminquote, Teamschnitt", () => {
    const leads = [lead("PD-1"), lead("PD-2"), lead("PD-3")];
    const rows = [
      act("PD-1", "u-a", "attempt", "2026-09-30T08:00:00Z", { attempt: 1 }) /* 2 Std. nach Eingang */,
      act("PD-1", "u-a", "status", "2026-09-30T09:00:00Z", { status: "aufmass" }),
      act("PD-2", "u-a", "attempt", "2026-09-30T10:00:00Z", { attempt: 1 }) /* 4 Std. */,
      act("PD-3", "u-b", "status", "2026-09-30T07:00:00Z", { status: "abgesagt" }) /* 1 Std. */,
    ];
    const s = presetterStats(leads, rows, "u-a", new Date("2026-09-30T15:00:00Z"));
    expect(s).toMatchObject({ callsToday: 3, firstCallH: 3, terminQuote: 50, teamFirstCallH: 2.3, teamTerminQuote: 33 });
    /* 30.09.2026 ist ein Mittwoch */
    expect(s.callsWeek).toEqual([["Mo", 0], ["Di", 0], ["Mi", 3], ["Do", null], ["Fr", null], ["Sa", null]]);
    expect(s).toMatchObject({ termineToday: 1, reachQuote: 50, teamReachQuote: 67, boardRows: [["u-a", 1]] });
    expect(s.doneToday.map((d) => [d.leadId, d.time])).toEqual([["PD-2", "12:00"], ["PD-1", "11:00"], ["PD-1", "10:00"]]);
  });

  it("EPP-ID: letzte Eintragung gilt und steht im Verlauf", () => {
    const [l] = applyActivities(
      [lead("PD-1")],
      [act("PD-1", "u-aimee", "epp", "2026-09-30T08:00:00Z", { eppId: "111" }, "Im EPP angelegt – EPP-ID 111"), act("PD-1", "u-aimee", "epp", "2026-09-30T09:00:00Z", { eppId: "222" }, "Im EPP angelegt – EPP-ID 222")],
    );
    expect(l.eppId).toBe("222");
    expect(l.hist[0][0]).toBe("Im EPP angelegt – EPP-ID 222");
  });

  it("Antworten von der Tür: Vorqualifizierung des Setters wird als „door“ markiert", () => {
    const [l] = applyActivities(
      [lead("PD-1")],
      [
        act("PD-1", "u-sara", "vq", "2026-09-30T08:00:00Z", { answers: { wohnflaeche: "140", baujahr_haus: "" } }),
        act("PD-1", "u-aimee", "vq", "2026-09-30T09:00:00Z", { answers: { wohnflaeche: "140", heizungsart: "Gas" } }),
      ].map((a, i) => ({ ...a, role: i === 0 ? ("setter" as const) : a.role })),
    );
    expect(l.door).toEqual(["wohnflaeche"]);
    expect(l.vq).toEqual({ wohnflaeche: "140", heizungsart: "Gas" });
  });

  it("Serie: Tage in Folge mit erreichtem Anrufziel, Sonntage zählen nicht", () => {
    const rows = [
      act("PD-1", "u-a", "attempt", "2026-09-26T08:00:00Z", { attempt: 1 }) /* Sa */,
      act("PD-1", "u-a", "attempt", "2026-09-28T08:00:00Z", { attempt: 2 }) /* Mo */,
      act("PD-1", "u-a", "attempt", "2026-09-29T08:00:00Z", { attempt: 3 }) /* Di */,
    ];
    const s = presetterStats([lead("PD-1")], rows, "u-a", new Date("2026-09-30T15:00:00Z"), 1);
    expect(s.streak).toBe(3);
    expect(presetterStats([lead("PD-1")], rows, "u-a", new Date("2026-09-30T15:00:00Z"), 2).streak).toBe(0);
  });
});

/* ---------- Server: Rechte + Zurückschreiben ---------- */

vi.mock("@/server/db", async () => (await import("./db")).createTestDb());
const pd = { updateDeal: vi.fn(async () => ({})), addDealNote: vi.fn(async () => ({})) };
vi.mock("@/server/pipedrive/client", () => ({
  getRecentNotes: async () => [],
  PipedriveNotConfigured: class extends Error {},
  pipedriveWriteMode: () => (process.env.PIPEDRIVE_WRITE === "true" ? "alles" : process.env.PIPEDRIVE_WRITE === "notizen" ? "notizen" : "aus"),
  updateDeal: (...a: unknown[]) => pd.updateDeal(...(a as [])),
  addDealNote: (...a: unknown[]) => pd.addDealNote(...(a as [])),
  getDeals: async () => [
    {
      id: 7,
      title: "Wärmepumpe – Kunde 7",
      person_id: null,
      stage_id: 180,
      pipeline_id: 21,
      status: "open",
      lost_reason: null,
      add_time: "2026-09-30 06:00:00",
      update_time: "2026-09-30 06:00:00",
      stage_change_time: null,
      won_time: null,
      lost_time: null,
      owner_id: 1,
      custom_fields: { "3142c8c9e9e0bf916f449d2918b8baa84b6590ba": "Max" },
    },
  ],
  getPersons: async () => [],
}));

describe("Lead-Aktionen auf dem Server", () => {
  let la: typeof import("@/server/lead-activity");
  const aimee = { id: "u-aimee", roles: ["presetter" as const], name: "Aimée Test" };
  const max = { id: "u-max", roles: ["setter" as const], name: "Max Test" };
  const carl = { id: "u-carl", roles: ["closer" as const], name: "Carl Test" };

  beforeAll(async () => {
    const { db, schema } = await import("@/server/db");
    const u = (id: string, name: string, role: string) => ({ id, name, email: `${id}@beispiel.test`, role, emailVerified: true });
    await db.insert(schema.user).values([u("u-aimee", "Aimée Test", "presetter"), u("u-max", "Max Test", "setter"), u("u-carl", "Carl Test", "closer")]);
    la = await import("@/server/lead-activity");
  });
  beforeEach(() => {
    pd.updateDeal.mockClear();
    pd.addDealNote.mockClear();
  });

  it("Setter dürfen nicht, fremde Rollen auch nicht, Closer nur mit eigenem Termin", async () => {
    await expect(la.recordLeadAction(max, "setter", "PD-7", { type: "status", status: "nicht_erreicht" })).rejects.toThrow(/Nur Presetter/);
    await expect(la.recordLeadAction(max, "presetter", "PD-7", { type: "status", status: "nicht_erreicht" })).rejects.toThrow(/Berechtigung/);
    await expect(la.recordLeadAction(carl, "closer", "PD-7", { type: "status", status: "checks" })).rejects.toThrow(/Berechtigung/);
    await expect(la.recordLeadAction(aimee, "presetter", "L-1", { type: "note", text: "x" })).rejects.toThrow(/noch nicht in Pipedrive/);
  });

  it("ohne PIPEDRIVE_WRITE wird nur im Dashboard gespeichert", async () => {
    vi.stubEnv("PIPEDRIVE_WRITE", "");
    const r = await la.recordLeadAction(aimee, "presetter", "PD-7", { type: "status", status: "nicht_erreicht", reason: "Mailbox" });
    expect(r).toMatchObject({ attempts: 1, nextTry: "in 2 Std. erneut anrufen" });
    expect((await la.loadActivities()).at(-1)?.text).toBe("Nicht erreicht (Versuch 1) – Mailbox");
    expect(pd.updateDeal).not.toHaveBeenCalled();
  });

  it("PIPEDRIVE_WRITE=notizen: nur Notiz, Stufe/Status bleiben unverändert", async () => {
    vi.stubEnv("PIPEDRIVE_WRITE", "notizen");
    await la.recordLeadAction(aimee, "presetter", "PD-7", { type: "status", status: "abgesagt", reason: "Kein Eigentümer" });
    expect(pd.updateDeal).not.toHaveBeenCalled();
    expect((pd.addDealNote.mock.calls.at(-1) as unknown as [number, string])[1]).toContain("Abgesagt – Kein Eigentümer");
  });

  it("mit PIPEDRIVE_WRITE: Stufe, Notiz mit Gespräch und Vorqualifizierung, Verlustgrund", async () => {
    vi.stubEnv("PIPEDRIVE_WRITE", "true");
    const r = await la.recordLeadAction(aimee, "presetter", "PD-7", { type: "status", status: "nicht_erreicht" });
    expect(r.attempts).toBe(2);
    expect(pd.updateDeal).toHaveBeenLastCalledWith(7, { stage_id: 249 });
    await la.recordLeadAction(aimee, "presetter", "PD-7", { type: "note", text: "Heizung von 1995" });
    await la.recordLeadAction(aimee, "presetter", "PD-7", { type: "vq", answers: { wohnflaeche: "140" } });
    expect(pd.updateDeal).toHaveBeenCalledTimes(1); /* Notiz/VQ schreiben nichts */
    await la.recordLeadAction(aimee, "presetter", "PD-7", { type: "status", status: "aufmass" });
    expect(pd.updateDeal).toHaveBeenLastCalledWith(7, { stage_id: 181 });
    const note = pd.addDealNote.mock.calls.at(-1) as unknown as [number, string];
    expect(note[0]).toBe(7);
    expect(note[1]).toContain("Aufmaßtermin – Aimée (MB-Dashboard)");
    expect(note[1]).toContain("Gespräch: Heizung von 1995");
    expect(note[1]).toContain("140 m²");
    await expect(la.recordLeadAction(aimee, "presetter", "PD-7", { type: "status", status: "abgesagt" })).rejects.toThrow(/Grund/);
    await la.recordLeadAction(aimee, "presetter", "PD-7", { type: "status", status: "abgesagt", reason: "Kein Eigentümer", note: "Mieter" });
    expect(pd.updateDeal).toHaveBeenLastCalledWith(7, { status: "lost", lost_reason: "Kein Eigentümer – Mieter" });
  });

  it("Pipedrive-Fehler: im Dashboard gespeichert, mit Hinweis", async () => {
    vi.stubEnv("PIPEDRIVE_WRITE", "true");
    pd.updateDeal.mockRejectedValueOnce(new Error("HTTP 403"));
    const r = await la.recordLeadAction(aimee, "presetter", "PD-7", { type: "callback", date: "2026-10-01", time: "18:00" });
    expect(r.warning ?? "").toBe("");
    const r2 = await la.recordLeadAction(aimee, "presetter", "PD-7", { type: "status", status: "aufmass" });
    expect(r2.warning).toMatch(/HTTP 403/);
    const acts = await la.loadActivities();
    expect(acts.filter((a) => a.leadId === "PD-7").length).toBe(9);
  });

  it("Setter wird über Ergebnisse informiert", async () => {
    const { loadWorkspace } = await import("@/server/workspace");
    const texts = (await loadWorkspace({ id: "u-max", roles: ["setter"] })).notifications.map((n) => n.t);
    expect(texts).toContain("Kunde 7: Aufmaßtermin");
    expect(texts).toContain("Kunde 7: Rückruf vereinbart: 01.10. 18:00");
  });
});

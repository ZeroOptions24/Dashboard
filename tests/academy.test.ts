import { beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

/* Akademie: Lernpfad, Wissenschecks, Rollentest, Sperre und Freigabe durch den Admin. */

vi.mock("@/server/db", async () => (await import("./db")).createTestDb());

const { db, schema } = await import("@/server/db");
const ac = await import("@/server/academy");
const { MODULE_ANSWERS, TEST_ANSWERS } = await import("@/server/academy-answers");
const { pathFor, TESTS, passMark } = await import("@/lib/academy-content");

const admin = { id: "u-admin", roles: ["admin" as const] };
const mia = { id: "u-mia", roles: ["setter" as const] };
const tom = { id: "u-tom", roles: ["setter" as const, "closer" as const] };

beforeAll(async () => {
  const u = (id: string, name: string, role: string) => ({ id, name, email: `${id}@beispiel.test`, role, emailVerified: true });
  await db.insert(schema.user).values([u("u-admin", "Ada Admin", "admin"), u("u-mia", "Mia Muster", "setter"), u("u-tom", "Tom Test", "setter,closer")]);
});

const notifs = async (userId: string) => (await db.select().from(schema.notification).where(eq(schema.notification.userId, userId))).map((n) => n.text);
const wrongPick = (id: string) => (MODULE_ANSWERS[id].a + 1) % 2;

describe("Sperre", () => {
  it("ohne bestandenen Test ist die Rolle gesperrt – der Server nimmt sie aus den wirksamen Rollen", async () => {
    expect(await ac.lockedRoles("u-mia", mia.roles)).toEqual(["setter"]);
    expect(await ac.effectiveRoles("u-mia", mia.roles)).toEqual([]);
    expect(await ac.effectiveRoles("u-tom", tom.roles)).toEqual([]);
  });
  it("Admins sind nie gesperrt", async () => {
    expect(await ac.effectiveRoles("u-admin", admin.roles)).toEqual(["admin"]);
    expect(await ac.effectiveRoles("u-admin", ["admin", "setter"])).toEqual(["admin", "setter"]);
  });
  it("ausgeschaltet gilt keine Sperre", async () => {
    await ac.setLock(admin, false);
    expect(await ac.effectiveRoles("u-mia", mia.roles)).toEqual(["setter"]);
    await ac.setLock(admin, true);
    expect(await ac.effectiveRoles("u-mia", mia.roles)).toEqual([]);
  });
  it("nur Admins schalten um", async () => {
    await expect(ac.setLock(mia, false)).rejects.toThrow(/Berechtigung/);
  });
});

describe("Lernpfad und Wissenscheck", () => {
  it("Module kommen der Reihe nach; falsche Antwort zählt nicht, richtige schon", async () => {
    const path = pathFor("setter");
    await expect(ac.answerModule(mia, path[1].id, 0)).rejects.toThrow(/vorherige/);
    await expect(ac.answerModule(mia, "c1", 0)).rejects.toThrow(/nicht zu deinen Rollen/);
    const falsch = await ac.answerModule(mia, path[0].id, wrongPick(path[0].id));
    expect(falsch.correct).toBe(false);
    expect((await ac.loadAcademy(mia)).done).toEqual([]);
    const richtig = await ac.answerModule(mia, path[0].id, MODULE_ANSWERS[path[0].id].a);
    expect(richtig.correct).toBe(true);
    expect((await ac.loadAcademy(mia)).done).toEqual([path[0].id]);
    /* erledigt bleibt erledigt */
    expect((await ac.answerModule(mia, path[0].id, wrongPick(path[0].id))).correct).toBe(true);
  });
  it("die richtigen Antworten stehen nicht in den Inhalten für den Browser", async () => {
    const { MODULES } = await import("@/lib/academy-content");
    expect(JSON.stringify(MODULES)).not.toContain('"a":');
    expect(JSON.stringify(TESTS)).not.toContain('"a":');
  });
});

describe("Rollentest", () => {
  const finish = async (v: typeof mia, role: "setter" | "closer") => {
    for (const m of pathFor(role)) await ac.answerModule(v, m.id, MODULE_ANSWERS[m.id].a);
  };

  it("vor dem letzten Modul gibt es keinen Test", async () => {
    await expect(ac.submitTest(mia, "setter", TEST_ANSWERS.setter)).rejects.toThrow(/alle Module/);
  });

  it("durchgefallen → gesperrt bis zur Freigabe; Admin wird informiert; Wiederholung nur nach Freigabe", async () => {
    await finish(mia, "setter");
    const falsch = TEST_ANSWERS.setter.map((a) => (a + 1) % 4);
    const r = await ac.submitTest(mia, "setter", falsch);
    expect(r.passed).toBe(false);
    expect(r.wrong).toHaveLength(TESTS.setter.length);
    expect(r.wrong[0].correct).toBeTruthy();
    expect(await ac.effectiveRoles("u-mia", mia.roles)).toEqual([]);
    expect(await notifs("u-admin")).toContain(`Mia hat den Setter-Test nicht bestanden (0/${TESTS.setter.length}) – Wiederholung freigeben?`);
    await expect(ac.submitTest(mia, "setter", TEST_ANSWERS.setter)).rejects.toThrow(/Admin freigeben/);
    await ac.requestRetry(mia, "setter");
    expect((await notifs("u-admin")).some((t) => t.includes("Mia bittet um Freigabe"))).toBe(true);
    await expect(ac.setRetry(mia, "u-mia", "setter")).rejects.toThrow(/Berechtigung/);
    await ac.setRetry(admin, "u-mia", "setter");
    expect(await notifs("u-mia")).toContain("Der Admin hat den Setter-Test zur Wiederholung freigegeben");
  });

  it("bestanden ab 80 % → Ansicht frei; danach kein zweiter Versuch", async () => {
    const need = passMark(TESTS.setter.length);
    /* genau die Bestehensgrenze: need richtig, Rest falsch */
    const knapp = TEST_ANSWERS.setter.map((a, i) => (i < need ? a : (a + 1) % 4));
    const r = await ac.submitTest(mia, "setter", knapp);
    expect(r).toMatchObject({ passed: true, score: need, total: TESTS.setter.length, wrong: [] });
    expect(await ac.effectiveRoles("u-mia", mia.roles)).toEqual(["setter"]);
    await expect(ac.submitTest(mia, "setter", TEST_ANSWERS.setter)).rejects.toThrow(/schon bestanden/);
    const st = (await ac.loadAcademy(mia)).roles[0];
    expect(st).toMatchObject({ role: "setter", status: "bestanden", via: "test", tries: 2 });
  });

  it("eine Rolle von vielen: Closer bleibt gesperrt, Setter frei", async () => {
    await ac.unlockRole(admin, "u-tom", "setter");
    expect(await ac.effectiveRoles("u-tom", tom.roles)).toEqual(["setter"]);
    expect(await ac.lockedRoles("u-tom", tom.roles)).toEqual(["closer"]);
    expect(await notifs("u-tom")).toContain("Deine Setter-Ansicht ist freigeschaltet");
  });

  it("Admin setzt den Test zurück → Rolle wieder gesperrt", async () => {
    await ac.resetRole(admin, "u-tom", "setter");
    expect(await ac.lockedRoles("u-tom", tom.roles)).toEqual(["setter", "closer"]);
  });

  it("Closer-Pfad enthält die gemeinsamen Grundlagen und den TMVT-Block", () => {
    const ids = pathFor("closer").map((m) => m.id);
    expect(ids.slice(0, 5)).toEqual(["g1", "g2", "g3", "g4", "g5"]);
    expect(ids).toContain("p1");
    expect(ids).not.toContain("s1");
  });
});

describe("Admin-Ansicht und Videos", () => {
  it("Team mit Stand je Rolle – nur für Admins", async () => {
    expect((await ac.loadAcademy(mia)).team).toBeUndefined();
    const team = (await ac.loadAcademy(admin)).team!;
    expect(team.map((p) => p.name)).toEqual(["Mia Muster", "Tom Test"]);
    expect(team[0].states.setter?.status).toBe("bestanden");
    expect(team[1].states.closer?.status).toBe("offen");
  });
  it("YouTube-Link wird geprüft, gespeichert und entfernt", async () => {
    await expect(ac.setVideo(mia, "g1", "https://youtu.be/dQw4w9WgXcQ")).rejects.toThrow(/Berechtigung/);
    await expect(ac.setVideo(admin, "g1", "https://example.com/video")).rejects.toThrow(/YouTube/);
    await ac.setVideo(admin, "g1", "https://youtu.be/dQw4w9WgXcQ");
    expect((await ac.loadAcademy(mia)).videos).toEqual({ g1: "https://youtu.be/dQw4w9WgXcQ" });
    await ac.setVideo(admin, "g1", "");
    expect((await ac.loadAcademy(mia)).videos).toEqual({});
  });
});

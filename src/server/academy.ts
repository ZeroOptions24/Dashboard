import "server-only";
import { and, eq } from "drizzle-orm";
import { MA_ROLES_ALL, moduleById, moduleOpen, pathFor, passMark, TESTS, type MaRole } from "@/lib/academy-content";
import { isAdmin, parseRoles } from "@/lib/roles";
import type { Role } from "@/lib/types";
import { youtubeEmbed, type AcademyData, type RoleState } from "@/lib/academy";
import { MODULE_ANSWERS, TEST_ANSWERS } from "./academy-answers";
import { db, schema } from "./db";
import type { Viewer } from "./workspace";

/* Akademie (Tims Vorlage): Jede Rolle hat einen Lernpfad und einen Test. Erst nach bestandenem Test (≥ 80 %)
   ist die Ansicht der Rolle freigeschaltet. Gesperrte Rollen sehen nur Akademie, Verträge, Events und Stammdaten –
   und der Server gibt für sie keine Leads, Termine oder Zahlen heraus (siehe effectiveRoles).
   Bestehende MAs sind beim Einführen freigeschaltet (Migration 0014). Admins sind nie gesperrt. */

const LOCK_KEY = "academy.lock";
const must = (ok: boolean, msg = "Keine Berechtigung") => {
  if (!ok) throw new Error(msg);
};
const pad = (n: number) => String(n).padStart(2, "0");
const de = (d: Date) => `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
const isMaRole = (r: unknown): r is MaRole => MA_ROLES_ALL.includes(r as MaRole);
const maRolesOf = (roles: Role[]) => roles.filter(isMaRole);

type RoleRow = typeof schema.academyRole.$inferSelect;
const toState = (role: MaRole, r?: RoleRow): RoleState => ({
  role,
  status: r ? (r.status as RoleState["status"]) : "offen",
  via: r ? (r.via as RoleState["via"]) : null,
  score: r?.score ?? null,
  total: r?.total ?? null,
  tries: r?.tries ?? 0,
  retry: r?.retry ?? false,
  date: r?.passedAt ? de(r.passedAt) : r?.updatedAt && r.status === "nicht_bestanden" ? de(r.updatedAt) : null,
});

/* ---------- Sperre ---------- */

export async function lockOn() {
  const [row] = await db.select().from(schema.appSetting).where(eq(schema.appSetting.key, LOCK_KEY));
  return row ? row.value !== "false" : true;
}

/** Rollen dieser Person, deren Ansicht noch gesperrt ist (Admins: nie) */
export async function lockedRoles(userId: string, roles: Role[]): Promise<MaRole[]> {
  if (isAdmin(roles) || !(await lockOn())) return [];
  const rows = await db.select().from(schema.academyRole).where(eq(schema.academyRole.userId, userId));
  const frei = new Set(rows.filter((r) => r.status === "bestanden").map((r) => r.role));
  return maRolesOf(roles).filter((r) => !frei.has(r));
}

/** Rollen, mit denen diese Person Daten sehen und Aktionen ausführen darf. Gesperrte Rollen fallen weg –
 *  so bekommt jemand ohne bestandenen Test vom Server keine Leads, Termine oder Zahlen. */
export async function effectiveRoles(userId: string, roles: Role[]): Promise<Role[]> {
  const locked = new Set<Role>(await lockedRoles(userId, roles));
  return roles.filter((r) => !locked.has(r));
}

/* ---------- Laden ---------- */

export async function loadAcademy(v: Viewer): Promise<AcademyData> {
  const [progress, states, videos, on] = await Promise.all([
    db.select().from(schema.academyProgress).where(eq(schema.academyProgress.userId, v.id)),
    db.select().from(schema.academyRole).where(eq(schema.academyRole.userId, v.id)),
    db.select().from(schema.academyVideo),
    lockOn(),
  ]);
  const data: AcademyData = {
    lockOn: on,
    roles: maRolesOf(v.roles).map((r) => toState(r, states.find((s) => s.role === r))),
    done: progress.map((p) => p.moduleId),
    videos: Object.fromEntries(videos.map((x) => [x.moduleId, x.url])),
  };
  if (isAdmin(v.roles)) {
    const [users, allProgress, allStates] = await Promise.all([
      db.select({ id: schema.user.id, name: schema.user.name, role: schema.user.role, banned: schema.user.banned }).from(schema.user),
      db.select().from(schema.academyProgress),
      db.select().from(schema.academyRole),
    ]);
    data.team = users
      .filter((u) => !u.banned)
      .map((u) => ({ u, roles: maRolesOf(parseRoles(u.role)) }))
      .filter((x) => x.roles.length)
      .map(({ u, roles }) => ({
        id: u.id,
        name: u.name,
        roles,
        done: allProgress.filter((p) => p.userId === u.id).map((p) => p.moduleId),
        states: Object.fromEntries(roles.map((r) => [r, toState(r, allStates.find((s) => s.userId === u.id && s.role === r))])),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "de"));
  }
  return data;
}

/* ---------- Lernen ---------- */

/** Wissenscheck eines Moduls. Richtig → Modul erledigt. Die richtige Antwort verlässt den Server nie vorab. */
export async function answerModule(v: Viewer, moduleId: string, pick: number) {
  const m = moduleById(moduleId);
  must(!!m, "Modul nicht gefunden");
  const mine = maRolesOf(v.roles).filter((r) => m!.roles.includes(r));
  must(mine.length > 0, "Dieses Modul gehört nicht zu deinen Rollen");
  must(Number.isInteger(pick) && pick >= 0 && pick < m!.check.o.length, "Bitte eine Antwort wählen");
  const rows = await db.select().from(schema.academyProgress).where(eq(schema.academyProgress.userId, v.id));
  const done = new Set(rows.map((r) => r.moduleId));
  must(done.has(moduleId) || mine.some((r) => moduleOpen(r, moduleId, done)), "Erst das vorherige Modul abschließen");
  const ans = MODULE_ANSWERS[moduleId];
  const correct = done.has(moduleId) || pick === ans.a;
  if (correct && !done.has(moduleId)) {
    await db.insert(schema.academyProgress).values({ userId: v.id, moduleId }).onConflictDoNothing();
    done.add(moduleId);
  }
  return { correct, why: ans.why, testsOpen: mine.filter((r) => pathFor(r).every((x) => done.has(x.id))) };
}

/** Rollentest abgeben. Nur wenn der Lernpfad durch ist und der Test offen bzw. zur Wiederholung freigegeben ist. */
export async function submitTest(v: Viewer, role: MaRole, answers: number[]) {
  must(isMaRole(role) && v.roles.includes(role), "Diese Rolle hast du nicht");
  const qs = TESTS[role];
  must(Array.isArray(answers) && answers.length === qs.length && answers.every((a) => Number.isInteger(a)), "Bitte alle Fragen beantworten");
  const [progress, [cur]] = await Promise.all([
    db.select().from(schema.academyProgress).where(eq(schema.academyProgress.userId, v.id)),
    db.select().from(schema.academyRole).where(and(eq(schema.academyRole.userId, v.id), eq(schema.academyRole.role, role))),
  ]);
  const done = new Set(progress.map((p) => p.moduleId));
  must(pathFor(role).every((m) => done.has(m.id)), "Erst alle Module abschließen");
  must(!cur || (cur.status === "nicht_bestanden" && cur.retry), cur?.status === "bestanden" ? "Du hast diesen Test schon bestanden" : "Die Wiederholung muss der Admin freigeben");
  const key = TEST_ANSWERS[role];
  const wrong = qs.map((_, i) => (answers[i] === key[i] ? -1 : i)).filter((i) => i >= 0);
  const score = qs.length - wrong.length;
  const passed = score >= passMark(qs.length);
  const now = new Date();
  const values = { status: passed ? "bestanden" : "nicht_bestanden", via: "test", score, total: qs.length, tries: (cur?.tries ?? 0) + 1, retry: false, passedAt: passed ? now : null, updatedAt: now };
  await db
    .insert(schema.academyRole)
    .values({ userId: v.id, role, ...values })
    .onConflictDoUpdate({ target: [schema.academyRole.userId, schema.academyRole.role], set: values });
  const first = (await userName(v.id)).split(" ")[0];
  await notifyAdmins(
    passed
      ? `${first} hat den ${LABEL[role]}-Test bestanden (${score}/${qs.length}) – Ansicht freigeschaltet`
      : `${first} hat den ${LABEL[role]}-Test nicht bestanden (${score}/${qs.length}) – Wiederholung freigeben?`,
  );
  await audit(v.id, passed ? "academy.test_passed" : "academy.test_failed", v.id, `${role} ${score}/${qs.length}`);
  return {
    passed,
    score,
    total: qs.length,
    need: passMark(qs.length),
    /** nur bei Nichtbestehen: falsch beantwortete Fragen mit der richtigen Antwort */
    wrong: passed ? [] : wrong.map((i) => ({ q: qs[i].q, correct: qs[i].o[key[i]] })),
  };
}

/** Wiederholung beim Admin anfragen */
export async function requestRetry(v: Viewer, role: MaRole) {
  must(isMaRole(role) && v.roles.includes(role), "Diese Rolle hast du nicht");
  const [cur] = await db.select().from(schema.academyRole).where(and(eq(schema.academyRole.userId, v.id), eq(schema.academyRole.role, role)));
  must(cur?.status === "nicht_bestanden" && !cur.retry, "Eine Anfrage ist gerade nicht nötig");
  await notifyAdmins(`${(await userName(v.id)).split(" ")[0]} bittet um Freigabe für den ${LABEL[role]}-Test`);
}

/* ---------- Admin ---------- */

export async function setRetry(v: Viewer, userId: string, role: MaRole) {
  must(isAdmin(v.roles));
  const res = await db
    .update(schema.academyRole)
    .set({ retry: true, updatedAt: new Date() })
    .where(and(eq(schema.academyRole.userId, userId), eq(schema.academyRole.role, role), eq(schema.academyRole.status, "nicht_bestanden")))
    .returning();
  must(res.length > 0, "Diese Person hat den Test nicht verfehlt");
  await notifyUsers([userId], `Der Admin hat den ${LABEL[role]}-Test zur Wiederholung freigegeben`);
  await audit(v.id, "academy.retry_granted", userId, role);
}

/** Test muss neu gemacht werden (Lernfortschritt bleibt) */
export async function resetRole(v: Viewer, userId: string, role: MaRole) {
  must(isAdmin(v.roles));
  await db.delete(schema.academyRole).where(and(eq(schema.academyRole.userId, userId), eq(schema.academyRole.role, role)));
  await audit(v.id, "academy.role_reset", userId, role);
}

/** Admin schaltet eine Rolle von Hand frei (z. B. für Leute, die schon eingearbeitet sind) */
export async function unlockRole(v: Viewer, userId: string, role: MaRole) {
  must(isAdmin(v.roles));
  must(isMaRole(role), "Rolle ungültig");
  const now = new Date();
  const values = { status: "bestanden", via: "admin", retry: false, passedAt: now, updatedAt: now };
  await db
    .insert(schema.academyRole)
    .values({ userId, role, ...values })
    .onConflictDoUpdate({ target: [schema.academyRole.userId, schema.academyRole.role], set: values });
  await notifyUsers([userId], `Deine ${LABEL[role]}-Ansicht ist freigeschaltet`);
  await audit(v.id, "academy.role_unlocked", userId, role);
}

export async function setLock(v: Viewer, on: boolean) {
  must(isAdmin(v.roles));
  await db
    .insert(schema.appSetting)
    .values({ key: LOCK_KEY, value: String(on) })
    .onConflictDoUpdate({ target: schema.appSetting.key, set: { value: String(on), updatedAt: new Date() } });
  await audit(v.id, on ? "academy.lock_on" : "academy.lock_off", null);
}

export async function setVideo(v: Viewer, moduleId: string, url: string) {
  must(isAdmin(v.roles));
  must(!!moduleById(moduleId), "Modul nicht gefunden");
  const u = url.trim();
  if (!u) {
    await db.delete(schema.academyVideo).where(eq(schema.academyVideo.moduleId, moduleId));
  } else {
    must(!!youtubeEmbed(u), "Bitte einen YouTube-Link einfügen");
    await db
      .insert(schema.academyVideo)
      .values({ moduleId, url: u.slice(0, 300) })
      .onConflictDoUpdate({ target: schema.academyVideo.moduleId, set: { url: u.slice(0, 300), updatedAt: new Date() } });
  }
  await audit(v.id, "academy.video", null, moduleId);
}

/* ---------- Hilfen ---------- */

const LABEL: Record<MaRole, string> = { setter: "Setter", presetter: "Presetter", closer: "Closer" };
const audit = (actorId: string | null, action: string, targetUserId: string | null, detail?: string) =>
  db.insert(schema.auditLog).values({ actorId, action, targetUserId, detail });

async function userName(id: string) {
  const [u] = await db.select({ name: schema.user.name }).from(schema.user).where(eq(schema.user.id, id));
  return u?.name ?? "MB";
}
async function notifyUsers(ids: string[], text: string) {
  if (ids.length) await db.insert(schema.notification).values(ids.map((userId) => ({ userId, text: text.slice(0, 400), status: null })));
}
async function notifyAdmins(text: string) {
  const rows = await db.select({ id: schema.user.id, role: schema.user.role, banned: schema.user.banned }).from(schema.user);
  await notifyUsers(
    rows.filter((u) => !u.banned && isAdmin(parseRoles(u.role))).map((u) => u.id),
    text,
  );
}

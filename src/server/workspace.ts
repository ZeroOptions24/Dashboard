import "server-only";
import { randomUUID } from "node:crypto";
import { and, desc, eq, gte, inArray, isNull, isNotNull } from "drizzle-orm";
import { isAdmin, parseRoles } from "@/lib/roles";
import type { Appointment, Board, BoardArchiveEntry, Notification, Payout, ProvisionItem, Person, PersonKey, Role, Slot, StatusKey, TeamEvent } from "@/lib/types";
import { db, schema } from "./db";
import { loadLeadsFromPipedrive, setterKey, withAssignments } from "./pipedrive/leads";
import { getOwnLead, isOwnLeadId, syncOwnLead } from "./own-leads";
import { getTargets, type Targets } from "./targets";
import { loadPayouts, loadProvisions } from "./provisions";
import { loadSetterAssignments } from "./setter-assignment";

/* Team-Alltag aus der Datenbank: Personen, Benachrichtigungen, Events, Closer-Kalender,
   Wettbewerb, Auszahlungen. Jede Funktion bekommt die angemeldete Person (Viewer) und
   prüft selbst, was sie sehen bzw. ändern darf. Personen-Schlüssel = Nutzer-ID. */

export interface Viewer {
  id: string;
  roles: Role[];
}

const DAY = 864e5;
const TZ = "Europe/Berlin";
const pad = (n: number) => String(n).padStart(2, "0");
const berlinParts = (d: Date) =>
  Object.fromEntries(
    new Intl.DateTimeFormat("de-DE", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  );
/** „JJJJ-MM-TT“ von heute (deutsche Zeit) */
export const todayKey = (now = new Date()) => {
  const p = berlinParts(now);
  return `${p.year}-${p.month}-${p.day}`;
};
const fmtDate = (d: Date) => {
  const p = berlinParts(d);
  return `${p.day}.${p.month}.${p.year}`;
};
const fmtStamp = (d: Date) => {
  const p = berlinParts(d);
  return `${p.day}.${p.month}.${p.year}, ${p.hour}:${p.minute}`;
};
/** „gerade eben“, „vor 5 Min.“, „vor 2 Std.“, „gestern, 17:40“, „20.09.“ */
function relTime(d: Date, now = new Date()) {
  const min = Math.round((now.getTime() - d.getTime()) / 6e4);
  if (min < 1) return "gerade eben";
  if (min < 60) return `vor ${min} Min.`;
  if (min < 6 * 60) return `vor ${Math.round(min / 60)} Std.`;
  const p = berlinParts(d);
  if (todayKey(d) === todayKey(now)) return `heute, ${p.hour}:${p.minute}`;
  if (todayKey(d) === todayKey(new Date(now.getTime() - DAY))) return `gestern, ${p.hour}:${p.minute}`;
  return `${p.day}.${p.month}.`;
}
const json = <T>(s: string | null | undefined, fallback: T): T => {
  try {
    return s ? (JSON.parse(s) as T) : fallback;
  } catch {
    return fallback;
  }
};
const clean = (s: unknown, max = 300) => String(s ?? "").trim().slice(0, max);
const isDateKey = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
export const isAdminViewer = (v: Viewer) => isAdmin(v.roles);
const can = (v: Viewer, ...roles: Role[]) => isAdmin(v.roles) || roles.some((r) => v.roles.includes(r));
function must(ok: boolean, msg = "Keine Berechtigung") {
  if (!ok) throw new Error(msg);
}

/* ---------- Personen ---------- */

interface UserRow {
  id: string;
  name: string;
  role: string | null;
  banned: boolean | null;
  setterName: string | null;
}

async function users(): Promise<UserRow[]> {
  return db
    .select({ id: schema.user.id, name: schema.user.name, role: schema.user.role, banned: schema.user.banned, setterName: schema.profile.pipedriveSetterName })
    .from(schema.user)
    .leftJoin(schema.profile, eq(schema.profile.userId, schema.user.id));
}

const toPerson = (u: UserRow): Person => {
  const roles = parseRoles(u.role);
  const parts = u.name.trim().split(/\s+/);
  return {
    key: u.id,
    name: u.name,
    first: parts[0] ?? u.name,
    /* Hauptrolle für Anzeige („Setter“, „Closer“ …); Admins mit MA-Rolle zeigen die MA-Rolle */
    role: roles.find((r) => r !== "admin") ?? roles[0] ?? "setter",
    initials: (parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : (parts[0]?.[1] ?? "")),
  };
};

/** Pipedrive-Setter-Name (Schlüssel) → Nutzer-ID, für alle Personen mit Setter-Rolle */
export async function setterIdMap(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (const u of await users()) {
    if (!parseRoles(u.role).includes("setter")) continue;
    map.set(setterKey(u.setterName || u.name.split(" ")[0]), u.id);
  }
  return map;
}

async function idsWithRole(...roles: Role[]) {
  return (await users()).filter((u) => !u.banned && parseRoles(u.role).some((r) => roles.includes(r))).map((u) => u.id);
}

/** Standard-Presetter für Leads ohne Dashboard-Aktion (Server-Einstellung STANDARD_PRESETTER_EMAIL) */
export async function defaultPresetterId(): Promise<string | null> {
  const email = process.env.STANDARD_PRESETTER_EMAIL?.trim().toLowerCase();
  if (!email) return null;
  const [u] = await db.select({ id: schema.user.id }).from(schema.user).where(eq(schema.user.email, email));
  return u?.id ?? null;
}

/** Leads, bei denen die Person Closer eines Termins ist */
export async function leadIdsForCloser(userId: string) {
  /* nur fest gebuchte Termine – Vormerkungen sieht der Closer erst nach der Bestätigung */
  const rows = await db.select({ leadId: schema.appointment.leadId }).from(schema.appointment).where(and(eq(schema.appointment.closerId, userId), eq(schema.appointment.reserved, false)));
  return new Set(rows.map((r) => r.leadId));
}

/* ---------- Benachrichtigungen ---------- */

export async function notify(userIds: string[], text: string, status: StatusKey | null = null) {
  const ids = [...new Set(userIds)].filter(Boolean);
  if (ids.length) await db.insert(schema.notification).values(ids.map((userId) => ({ userId, text: clean(text, 400), status })));
}

export async function markNotificationsRead(v: Viewer) {
  await db
    .update(schema.notification)
    .set({ readAt: new Date() })
    .where(and(eq(schema.notification.userId, v.id), isNull(schema.notification.readAt)));
}

/* ---------- Laden ---------- */

export interface Workspace {
  me: PersonKey;
  people: Person[];
  /** aktive Personen mit Closer-Rolle (Auswahl beim direkten Termin) */
  closers: PersonKey[];
  /** Zielwerte (Admin-Einstellung) */
  targets: Targets;
  notifications: Notification[];
  events: TeamEvent[];
  slots: Slot[];
  appointments: (Appointment & { kunde?: string | null })[];
  board: Board & { id: string | null };
  boardArchive: BoardArchiveEntry[];
  payouts: Record<PersonKey, (Payout & { ibanLast4?: string | null })[]>;
  provisions: ProvisionItem[];
  moneyGoal: number | null;
}

const TARGET_ROLES: Record<string, Role[]> = { Alle: ["setter", "presetter", "closer", "admin"], Setter: ["setter"], Presetter: ["presetter"], Closer: ["closer"] };

const MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

/** Entwurf, solange noch kein Wettbewerb veröffentlicht ist.
 *  TODO(EnergyEngel): Prämien und Teamziel sind die Werte aus dem Prototyp – echte Regeln festlegen. */
function draftBoard(closerIds: string[], now = new Date()): Board & { id: null } {
  const p = berlinParts(now);
  const last = new Date(Number(p.year), Number(p.month), 0);
  return {
    id: null,
    title: `Wärmepumpen-Cup ${MONATE[Number(p.month) - 1]} ${p.year}`,
    unit: "Anlagen",
    goal: 65,
    ends: `${pad(last.getDate())}.${p.month}.${p.year}`,
    published: "",
    by: "",
    rows: closerIds.map((id) => [id, 0]),
    prizes: [
      ["5 Anlagen", "200 € Gutschein"],
      ["10 Anlagen", "500 € Tank-/​Reisegutschein"],
      ["Platz 1", "+200 €"],
      ["Platz 2 und 3", "je +100 €"],
    ],
    marks: [5, 10],
  };
}

export async function loadWorkspace(v: Viewer): Promise<Workspace> {
  const all = await users();
  const byId = new Map(all.map((u) => [u.id, u]));
  const people = all.map(toPerson);
  const today = todayKey();
  const since = new Date(Date.now() - 30 * DAY);
  const pastKey = todayKey(since);

  const notifs = await db
    .select()
    .from(schema.notification)
    .where(and(eq(schema.notification.userId, v.id), gte(schema.notification.createdAt, since)))
    .orderBy(desc(schema.notification.createdAt))
    .limit(40);

  /* Events der eigenen Zielgruppe (Admins sehen alle) */
  const evRows = (await db.select().from(schema.teamEvent).where(gte(schema.teamEvent.date, todayKey(new Date(Date.now() - 14 * DAY))))).filter(
    (e) => isAdmin(v.roles) || e.createdBy === v.id || (TARGET_ROLES[e.target] ?? []).some((r) => v.roles.includes(r)),
  );
  const rsvps = evRows.length
    ? await db.select().from(schema.eventRsvp).where(inArray(schema.eventRsvp.eventId, evRows.map((e) => e.id)))
    : [];
  const events: TeamEvent[] = evRows.map((e) => ({
    id: e.id,
    title: e.title,
    date: e.date,
    time: e.time,
    ort: e.ort,
    type: e.type,
    target: e.target,
    desc: e.description,
    going: rsvps.filter((r) => r.eventId === e.id).map((r) => r.userId),
    by: e.createdBy ?? "",
    isNew: Date.now() - e.createdAt.getTime() < 3 * DAY,
  }));

  /* unbestätigte Vormerkungen 24 Std. vor dem Termin freigeben (zusätzlich zum täglichen Lauf) */
  await releaseStaleReservations().catch(() => 0);
  /* Slots: alle künftigen (Setter/Presetter buchen daraus); Termine: Admin/Presetter alle, Closer eigene, sonst selbst gebuchte */
  const slots = (await db.select().from(schema.closerSlot).where(gte(schema.closerSlot.date, today))).map(
    (s): Slot => ({ id: s.id, closer: s.closerId, date: s.date, start: s.start }),
  );
  const apptRows = await db.select().from(schema.appointment).where(gte(schema.appointment.date, pastKey));
  const appointments = apptRows
    .filter((a) => can(v, "presetter") || a.closerId === v.id || a.createdBy === v.id)
    .map((a) => {
      /* Closer sehen eine Vormerkung nur als belegte Zeit – ohne Kunde */
      const hidden = a.reserved && !can(v, "presetter") && a.createdBy !== v.id;
      return { a, hidden };
    })
    .map(({ a, hidden }) => ({
      id: a.id,
      lead: hidden ? "" : a.leadId,
      closer: a.closerId,
      kind: a.kind as Appointment["kind"],
      date: a.date,
      start: a.start,
      dur: a.dur,
      ort: hidden ? "" : a.ort,
      kunde: hidden ? null : a.kunde,
      reserved: a.reserved || undefined,
      feedback: a.feedbackResult ? { result: a.feedbackResult, at: fmtStamp(a.feedbackAt ?? new Date()), note: a.feedbackNote ?? "" } : null,
    }));

  /* Wettbewerb: aktiver aus der DB, sonst Entwurf; neue Closer erscheinen mit 0 */
  const closerIds = all.filter((u) => !u.banned && parseRoles(u.role).includes("closer")).map((u) => u.id);
  const [active] = await db.select().from(schema.board).where(isNull(schema.board.archivedAt)).orderBy(desc(schema.board.publishedAt)).limit(1);
  let board: Workspace["board"] = draftBoard(closerIds);
  if (active) {
    const rows = json<[string, number][]>(active.rows, []).filter(([k]) => byId.has(k));
    for (const id of closerIds) if (!rows.some(([k]) => k === id)) rows.push([id, 0]);
    board = {
      id: active.id,
      title: active.title,
      unit: active.unit,
      goal: active.goal,
      ends: active.ends,
      published: active.publishedAt ? fmtStamp(active.publishedAt) : "",
      by: active.publishedBy ? (byId.get(active.publishedBy)?.name.split(" ")[0] ?? "Admin") : "–",
      rows,
      prizes: json(active.prizes, []),
      marks: json(active.marks, []),
    };
  }
  const archived = await db.select().from(schema.board).where(isNotNull(schema.board.archivedAt)).orderBy(desc(schema.board.archivedAt)).limit(6);
  const boardArchive: BoardArchiveEntry[] = archived.map((b) => {
    const rows = json<[string, number][]>(b.rows, []).sort((a, c) => c[1] - a[1]);
    return {
      title: b.title,
      winner: rows[0] ? (byId.get(rows[0][0])?.name.split(" ")[0] ?? "–") : "–",
      total: `${rows.reduce((s, r) => s + r[1], 0)} ${b.unit}`,
      date: fmtDate(b.archivedAt!),
    };
  });

  /* Auszahlungen und Provisionen: eigene; Admin alle (mit maskierter IBAN) */
  const payouts = await loadPayouts(v);
  const provisions = await loadProvisions(v);

  const [me] = await db.select({ goal: schema.profile.moneyGoal }).from(schema.profile).where(eq(schema.profile.userId, v.id));

  return {
    me: v.id,
    people,
    closers: closerIds,
    targets: await getTargets(),
    notifications: notifs.map((n) => ({ t: n.text, time: relTime(n.createdAt), status: (n.status as StatusKey) ?? null, unread: !n.readAt })),
    events,
    slots,
    appointments,
    board,
    boardArchive,
    payouts,
    provisions,
    moneyGoal: me?.goal ?? null,
  };
}

/* ---------- Events ---------- */

export async function toggleRsvp(v: Viewer, eventId: string): Promise<boolean> {
  const [ev] = await db.select({ id: schema.teamEvent.id }).from(schema.teamEvent).where(eq(schema.teamEvent.id, eventId));
  must(!!ev, "Event nicht gefunden");
  const where = and(eq(schema.eventRsvp.eventId, eventId), eq(schema.eventRsvp.userId, v.id));
  const [has] = await db.select().from(schema.eventRsvp).where(where);
  if (has) await db.delete(schema.eventRsvp).where(where);
  else await db.insert(schema.eventRsvp).values({ eventId, userId: v.id });
  return !has;
}

export async function postEvent(v: Viewer, input: { title: string; date: string; time: string; ort: string; type: string; target: string; desc: string }) {
  must(isAdmin(v.roles));
  const e = { title: clean(input.title, 120), date: clean(input.date, 10), time: clean(input.time, 40), ort: clean(input.ort, 160), type: clean(input.type, 40), target: clean(input.target, 20), description: clean(input.desc, 2000) };
  must(!!e.title && isDateKey(e.date) && !!e.time && !!e.ort, "Titel, Datum, Uhrzeit und Ort angeben");
  must(!!TARGET_ROLES[e.target], "Zielgruppe ungültig");
  const id = randomUUID();
  await db.insert(schema.teamEvent).values({ id, ...e, createdBy: v.id });
  const [y, m, d] = e.date.split("-");
  await notify((await idsWithRole(...TARGET_ROLES[e.target])).filter((x) => x !== v.id), `Neues Event: ${e.title} am ${d}.${m}.${y.slice(2)}`);
  return id;
}

/* ---------- Closer-Kalender ---------- */

export async function addSlots(v: Viewer, list: { date: string; start: number }[]) {
  must(v.roles.includes("closer"), "Nur Closer tragen freie Slots ein");
  const today = todayKey();
  const valid = list.filter((s) => isDateKey(s.date) && s.date >= today && Number.isInteger(s.start) && s.start >= 6 && s.start <= 22).slice(0, 200);
  if (!valid.length) return [];
  const taken = await db.select().from(schema.appointment).where(and(eq(schema.appointment.closerId, v.id), gte(schema.appointment.date, today)));
  const free = valid.filter((s) => !taken.some((a) => a.date === s.date && Math.floor(a.start) === s.start));
  if (!free.length) return [];
  const rows = await db
    .insert(schema.closerSlot)
    .values(free.map((s) => ({ id: randomUUID(), closerId: v.id, date: s.date, start: s.start })))
    .onConflictDoNothing()
    .returning();
  if (rows.length > 1) {
    const [u] = await db.select({ name: schema.user.name }).from(schema.user).where(eq(schema.user.id, v.id));
    await notify((await idsWithRole("presetter")).filter((x) => x !== v.id), `${u?.name.split(" ")[0] ?? "Ein Closer"} hat ${rows.length} neue freie Slots eingetragen`);
  }
  return rows.map((s): Slot => ({ id: s.id, closer: s.closerId, date: s.date, start: s.start }));
}

export async function removeSlot(v: Viewer, slotId: string) {
  const [s] = await db.select().from(schema.closerSlot).where(eq(schema.closerSlot.id, slotId));
  if (!s) return;
  must(s.closerId === v.id || isAdmin(v.roles));
  await db.delete(schema.closerSlot).where(eq(schema.closerSlot.id, slotId));
}

/** Setter-Nutzer-ID eines Pipedrive-Leads (für Benachrichtigungen) */
async function setterOfLead(leadId: string): Promise<string | null> {
  try {
    if (isOwnLeadId(leadId)) return (await getOwnLead(leadId))?.setter ?? null;
    const raw = (await loadLeadsFromPipedrive()).find((l) => l.id === leadId);
    if (!raw) return null;
    const [lead] = withAssignments([raw], await loadSetterAssignments());
    return (await setterIdMap()).get(lead.setter) ?? null;
  } catch {
    return null; /* ohne Pipedrive (Entwicklung) keine Setter-Benachrichtigung */
  }
}

/** Zwei-Schritte-System (Ablauf A05): Der Setter merkt an der Tür nur vor, der Presetter bestätigt nach der Qualifizierung.
 *  asRole = Rolle, in der gebucht wird (Setter → vormerken, Presetter/Admin → fest buchen). */
const reservesAs = (v: Viewer, asRole?: Role) => {
  if (asRole === "setter") must(can(v, "setter"), "Keine Berechtigung zum Buchen");
  return asRole === "setter" || (!can(v, "presetter") && v.roles.includes("setter"));
};

/** Presetter (ohne gesperrte), die über Vormerkungen informiert werden */
async function presetterIds() {
  const rows = await db.select({ id: schema.user.id, role: schema.user.role, banned: schema.user.banned }).from(schema.user);
  return rows.filter((u) => !u.banned && parseRoles(u.role).includes("presetter")).map((u) => u.id);
}

const whenText = (date: string, start: number) => {
  const [, m, d] = date.split("-");
  return `${d}.${m}. ${pad(Math.floor(start))}:${start % 1 ? "30" : "00"}`;
};

/** Nach dem Anlegen eines Termins: fest gebucht → Closer informieren; vorgemerkt → nur Presetter */
async function announceBooking(v: Viewer & { name?: string }, reserved: boolean, closerId: string, kunde: string, ort: string, date: string, start: number) {
  const when = whenText(date, start);
  if (reserved) await notify(await presetterIds(), `Termin vorgemerkt: ${kunde}, ${when}${ort ? ` (${ort})` : ""} – bitte anrufen, qualifizieren und bestätigen`, "terminierung");
  else if (closerId !== v.id) await notify([closerId], `Neuer Aufmaßtermin: ${kunde}, ${when}${ort ? ` (${ort})` : ""}`, "aufmass");
}

/** Aufmaßtermin in einem freien Slot buchen (bzw. als Setter vormerken) */
export async function bookSlot(v: Viewer, slotId: string, lead: { id: string; kunde: string; ort: string }, asRole?: Role) {
  must(can(v, "setter", "presetter"), "Keine Berechtigung zum Buchen");
  const reserved = reservesAs(v, asRole);
  const leadId = clean(lead.id, 60);
  must(!!leadId, "Lead fehlt");
  /* DELETE … RETURNING ist atomar: bei gleichzeitigen Buchungen bekommt nur eine den Slot */
  const [s] = await db.delete(schema.closerSlot).where(eq(schema.closerSlot.id, slotId)).returning();
  must(!!s, "Der Slot ist nicht mehr frei – bitte einen anderen wählen");
  const id = randomUUID();
  const kunde = clean(lead.kunde, 120),
    ort = clean(lead.ort, 120);
  await db.insert(schema.appointment).values({ id, leadId, closerId: s.closerId, kind: "erst", date: s.date, start: s.start, dur: 1.5, ort, kunde, reserved, createdBy: v.id });
  await announceBooking(v, reserved, s.closerId, kunde, ort, s.date, s.start);
  if (isOwnLeadId(leadId)) await syncOwnLead(leadId); /* Closer + Termin in Pipedrive eintragen */
  return { id, closer: s.closerId, date: s.date, start: s.start, reserved };
}

export type FeedbackResult = "checks" | "nicht_angetroffen" | "verloren" | "verkauft" | "entscheidung";
const FEEDBACK_TEXT: Record<FeedbackResult, string> = {
  checks: "Aufmaßtermin fand statt – Kunde ist in den Checks",
  nicht_angetroffen: "beim Aufmaßtermin nicht angetroffen – neuer Termin wird gelegt",
  verloren: "Termin fand statt – leider verloren",
  verkauft: "Verkauft!",
  entscheidung: "Verkaufstermin fand statt – Kunde entscheidet noch",
};

/** Lead-Status nach der Rückmeldung (den Status selbst speichert der Client über recordLeadAction) */
export function feedbackStatus(result: FeedbackResult, verkaufstermin: boolean): StatusKey {
  if (result === "verkauft" || result === "verloren") return result;
  if (result === "nicht_angetroffen") return "terminierung";
  if (result === "entscheidung") return "verkaufstermin";
  return verkaufstermin ? "verkaufstermin" : "checks";
}

/** Pflicht-Rückmeldung des Closers. apptId = Termin-ID oder „LEAD:<id>“ (Lead in den Checks ohne Termin).
 *  Optional wird der 2. Termin gleich mit angelegt. Der Lead-Status in Pipedrive wird (noch) nicht geschrieben. */
export async function saveFeedback(
  v: Viewer,
  apptId: string,
  input: { result: FeedbackResult; note?: string; reason?: string; second?: { date: string; hour: number } | null; lead?: { kunde: string; ort: string } },
) {
  must(can(v, "closer"), "Nur Closer geben Rückmeldung");
  must(input.result in FEEDBACK_TEXT, "Ergebnis ungültig");
  const note = clean([input.reason, input.note].filter(Boolean).join(" – "), 1000);
  let leadId: string,
    kunde: string,
    ort: string,
    closerId = v.id;
  if (apptId.startsWith("LEAD:")) {
    leadId = clean(apptId.slice(5), 60);
    kunde = clean(input.lead?.kunde, 120);
    ort = clean(input.lead?.ort, 120);
  } else {
    const [a] = await db.select().from(schema.appointment).where(eq(schema.appointment.id, apptId));
    must(!!a, "Termin nicht gefunden");
    must(a.closerId === v.id || isAdmin(v.roles));
    await db.update(schema.appointment).set({ feedbackResult: input.result, feedbackNote: note, feedbackAt: new Date() }).where(eq(schema.appointment.id, apptId));
    leadId = a.leadId;
    kunde = a.kunde ?? clean(input.lead?.kunde, 120);
    ort = a.ort;
    closerId = a.closerId;
  }
  let second: Appointment | null = null;
  if (input.result === "checks" && input.second && isDateKey(input.second.date)) {
    const id = randomUUID();
    const hour = Math.min(22, Math.max(6, Number(input.second.hour) || 17));
    await db.insert(schema.appointment).values({ id, leadId, closerId, kind: "closing", date: input.second.date, start: hour, dur: 1.5, ort, kunde, createdBy: v.id });
    second = { id, lead: leadId, closer: closerId, kind: "closing", date: input.second.date, start: hour, dur: 1.5, ort, feedback: null };
  }
  if (second && isOwnLeadId(leadId)) await syncOwnLead(leadId);
  const setter = await setterOfLead(leadId);
  const status = feedbackStatus(input.result, !!second);
  if (setter) await notify([setter], `${kunde}: ${FEEDBACK_TEXT[input.result]}`, status);
  return { second };
}

/** Termin direkt eintragen (ohne freien Slot): Datum, Uhrzeit, Closer frei wählbar.
 *  Abgelehnt, wenn der Closer zu der Zeit schon einen Termin hat; ein passender freier Slot wird verbraucht. */
export async function bookDirect(v: Viewer, lead: { id: string; kunde: string; ort: string }, input: { date: string; start: number; closerId: string }, asRole?: Role) {
  must(can(v, "setter", "presetter"), "Keine Berechtigung zum Buchen");
  const reserved = reservesAs(v, asRole);
  const leadId = clean(lead.id, 60);
  must(!!leadId, "Lead fehlt");
  must(isDateKey(input.date) && input.date >= todayKey(), "Bitte ein Datum ab heute wählen");
  const start = Number(input.start);
  must(Number.isFinite(start) && start >= 6 && start <= 21.5 && (start * 2) % 1 === 0, "Bitte eine gültige Uhrzeit wählen");
  const [closer] = await db.select({ id: schema.user.id, role: schema.user.role, banned: schema.user.banned }).from(schema.user).where(eq(schema.user.id, input.closerId));
  must(!!closer && !closer.banned && parseRoles(closer.role).includes("closer"), "Bitte einen Closer wählen");
  const dur = 1.5;
  const same = await db.select().from(schema.appointment).where(and(eq(schema.appointment.closerId, closer.id), eq(schema.appointment.date, input.date)));
  must(!same.some((a) => start < a.start + a.dur && a.start < start + dur), "Der Closer hat zu der Zeit schon einen Termin");
  await db.delete(schema.closerSlot).where(and(eq(schema.closerSlot.closerId, closer.id), eq(schema.closerSlot.date, input.date), eq(schema.closerSlot.start, Math.floor(start))));
  const id = randomUUID();
  const kunde = clean(lead.kunde, 120),
    ort = clean(lead.ort, 120);
  await db.insert(schema.appointment).values({ id, leadId, closerId: closer.id, kind: "erst", date: input.date, start, dur, ort, kunde, reserved, createdBy: v.id });
  await announceBooking(v, reserved, closer.id, kunde, ort, input.date, start);
  if (isOwnLeadId(leadId)) await syncOwnLead(leadId);
  return { id, closer: closer.id, date: input.date, start, reserved };
}

/** Vorgemerkten Termin bestätigen (Presetter nach der Qualifizierung): jetzt fest, Closer und Setter werden informiert.
 *  Den Lead-Status („Aufmaßtermin“) speichert der Client wie beim normalen Buchen. */
export async function confirmReservation(v: Viewer, apptId: string) {
  must(can(v, "presetter"), "Nur Presetter bestätigen vorgemerkte Termine");
  const [a] = await db.update(schema.appointment).set({ reserved: false }).where(and(eq(schema.appointment.id, apptId), eq(schema.appointment.reserved, true))).returning();
  must(!!a, "Die Vormerkung gibt es nicht mehr – bitte einen neuen Termin legen");
  const when = whenText(a.date, a.start);
  if (a.closerId) await notify([a.closerId], `Neuer Aufmaßtermin: ${a.kunde ?? "Kunde"}, ${when}${a.ort ? ` (${a.ort})` : ""}`, "aufmass");
  if (a.createdBy && a.createdBy !== v.id) await notify([a.createdBy], `${a.kunde ?? "Kunde"}: vorgemerkter Termin ${when} ist bestätigt`, "aufmass");
  if (isOwnLeadId(a.leadId)) await syncOwnLead(a.leadId);
  return { id: a.id };
}

/** Vormerkung lösen: Termin entfällt, der Slot wird wieder frei (Presetter, Admin oder der Setter selbst) */
export async function releaseReservation(v: Viewer, apptId: string, why = "") {
  const [a] = await db.select().from(schema.appointment).where(and(eq(schema.appointment.id, apptId), eq(schema.appointment.reserved, true)));
  must(!!a, "Die Vormerkung gibt es nicht mehr");
  must(can(v, "presetter") || a.createdBy === v.id);
  await freeReservation(a);
  if (a.createdBy && a.createdBy !== v.id) await notify([a.createdBy], `${a.kunde ?? "Kunde"}: Vormerkung ${whenText(a.date, a.start)} wurde gelöst${why ? ` – ${clean(why, 200)}` : ""}`, "terminierung");
  return { id: a.id };
}

async function freeReservation(a: typeof schema.appointment.$inferSelect) {
  await db.delete(schema.appointment).where(eq(schema.appointment.id, a.id));
  /* volle Stunde in der Zukunft → wieder als freier Slot anbieten */
  if (a.closerId && a.start % 1 === 0 && a.date >= todayKey())
    await db.insert(schema.closerSlot).values({ id: randomUUID(), closerId: a.closerId, date: a.date, start: a.start }).onConflictDoNothing();
  if (isOwnLeadId(a.leadId)) await syncOwnLead(a.leadId);
}

/** Täglicher Lauf: Vormerkungen, die 24 Std. vor dem Termin noch nicht bestätigt sind, freigeben */
export async function releaseStaleReservations(now = new Date()) {
  const rows = await db.select().from(schema.appointment).where(eq(schema.appointment.reserved, true));
  /* Termine sind in deutscher Zeit gespeichert – Vergleich als „JJJJ-MM-TT hh:mm“ in Europe/Berlin */
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date(now.getTime() + 24 * 36e5))
      .map((x) => [x.type, x.value]),
  );
  const limit = `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
  const stale = rows.filter((a) => `${a.date} ${pad(Math.floor(a.start))}:${a.start % 1 ? "30" : "00"}` <= limit);
  for (const a of stale) {
    await freeReservation(a);
    const text = `${a.kunde ?? "Kunde"}: vorgemerkter Termin ${whenText(a.date, a.start)} wurde nicht bestätigt und ist wieder frei`;
    await notify([...(a.createdBy ? [a.createdBy] : []), ...(await presetterIds())], text, "terminierung");
  }
  return stale.length;
}

/* ---------- Wettbewerb ---------- */

export async function publishBoard(v: Viewer, input: { id: string | null; title: string; goal?: number; ends: string; rows: [string, number][]; prizes?: [string, string][]; marks?: number[] }) {
  must(isAdmin(v.roles));
  const title = clean(input.title, 120),
    ends = clean(input.ends, 10);
  must(!!title && /^\d{2}\.\d{2}\.\d{4}$/.test(ends), "Titel und Ende (TT.MM.JJJJ) angeben");
  const ids = new Set((await users()).map((u) => u.id));
  const rows = input.rows.filter(([k]) => ids.has(k)).map(([k, n]): [string, number] => [k, Math.max(0, Math.floor(Number(n) || 0))]);
  const values = {
    title,
    ends,
    unit: "Anlagen",
    goal: input.goal ? Math.max(1, Math.floor(input.goal)) : null,
    rows: JSON.stringify(rows),
    publishedAt: new Date(),
    publishedBy: v.id,
  };
  let id = input.id;
  if (id) {
    const [b] = await db.update(schema.board).set(values).where(and(eq(schema.board.id, id), isNull(schema.board.archivedAt))).returning({ id: schema.board.id });
    must(!!b, "Wettbewerb nicht gefunden");
  } else {
    id = randomUUID();
    await db.insert(schema.board).values({ id, ...values, prizes: JSON.stringify(input.prizes ?? []), marks: JSON.stringify(input.marks ?? []) });
  }
  /* Alle Teilnehmenden erfahren ihren Platz */
  const sorted = rows.slice().sort((a, b) => b[1] - a[1]);
  for (const [k, n] of rows) {
    const rank = sorted.findIndex(([, x]) => x === n) + 1;
    await notify([k], `Neue Rangliste: ${title} – du bist auf Platz ${rank}`);
  }
  return id;
}

/** Laufenden Wettbewerb abschließen (ins Archiv); danach startet ein neuer Entwurf für den aktuellen Monat */
export async function archiveBoard(v: Viewer) {
  must(isAdmin(v.roles));
  const rows = await db.update(schema.board).set({ archivedAt: new Date() }).where(isNull(schema.board.archivedAt)).returning({ id: schema.board.id, title: schema.board.title });
  must(rows.length > 0, "Es läuft gerade kein veröffentlichter Wettbewerb");
  await db.insert(schema.auditLog).values({ actorId: v.id, action: "board.archived", detail: rows.map((r) => r.title).join(", ") });
  return rows[0].title;
}

/* ---------- Auszahlungen ---------- */

export { releasePayout } from "./provisions";

/* ---------- Eigene Einstellungen ---------- */

export async function setMoneyGoal(v: Viewer, euro: number) {
  const goal = Math.min(100000, Math.max(0, Math.round(Number(euro) || 0)));
  await db.insert(schema.profile).values({ userId: v.id, moneyGoal: goal }).onConflictDoUpdate({ target: schema.profile.userId, set: { moneyGoal: goal } });
}

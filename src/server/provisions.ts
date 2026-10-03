import "server-only";
import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray, isNull, lte } from "drizzle-orm";
import { PROV } from "@/lib/domain";
import { nextRun } from "@/lib/payouts";
import { isAdmin, parseRoles } from "@/lib/roles";
import type { Payout, PayoutItem, PayoutStatusKey, ProvisionItem } from "@/lib/types";
import { db, schema } from "./db";
import type { Viewer } from "./workspace";

/* Provisionen und Abrechnungen (Tims Ablauf A11/A12):
   · Presetter 250 € je gelegtem Aufmaßtermin, Setter und Closer je 1.000 € je Verkauf
   · alles wartet zunächst auf TBK; Admin setzt „TBK“ (fest) oder „Storno“ mit Grund (bis der EPP-Abgleich das übernimmt)
   · Absage/Verlust storniert offene Posten des Leads automatisch
   · Stichtag 1. → Auszahlung am 10., Stichtag 15. → Auszahlung am 25.; Admin gibt frei, am Auszahlungstag „ausgezahlt“
   Beträge sind netto; bei MAs ohne Kleinunternehmerregelung kommt die Umsatzsteuer dazu. */

export const UST_SATZ = 0.19;
type Row = typeof schema.provision.$inferSelect;

const must = (ok: boolean, msg = "Keine Berechtigung") => {
  if (!ok) throw new Error(msg);
};
const clean = (s: unknown, max = 500) => String(s ?? "").trim().slice(0, max);
const pad = (n: number) => String(n).padStart(2, "0");
const de = (d: Date) => `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;

/** Heute in deutscher Zeit als Datum (Mitternacht) */
function berlinToday(now = new Date()) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now).map((x) => [x.type, x.value]),
  );
  return new Date(+p.year, +p.month - 1, +p.day);
}

async function adminIds() {
  const rows = await db.select({ id: schema.user.id, role: schema.user.role, banned: schema.user.banned }).from(schema.user);
  return rows.filter((u) => !u.banned && isAdmin(parseRoles(u.role))).map((u) => u.id);
}
async function notify(userIds: string[], text: string) {
  const ids = [...new Set(userIds)].filter(Boolean);
  if (ids.length) await db.insert(schema.notification).values(ids.map((userId) => ({ userId, text: clean(text, 400), status: null })));
}

/* ---------- Entstehen (bei Statuswechsel) ---------- */

async function create(userId: string | null | undefined, role: "setter" | "presetter" | "closer", leadId: string, kunde: string, anlass: string, betrag: number) {
  if (!userId) return;
  await db
    .insert(schema.provision)
    .values({ id: randomUUID(), userId, role, leadId, kunde: clean(kunde, 120), anlass, betrag })
    .onConflictDoNothing(); /* je Lead, Rolle und Person nur einmal */
}

/** Nach einem Statuswechsel am Lead aufrufen. presetterId = wer den Termin gelegt hat; closerId = Closer des Aufmaßtermins. */
export async function onLeadStatus(input: { leadId: string; kunde: string; status: string; reason?: string; presetterId?: string | null; setterId?: string | null; closerId?: string | null }) {
  const { leadId, kunde, status } = input;
  if (status === "aufmass") await create(input.presetterId, "presetter", leadId, kunde, "Aufmaßtermin gelegt", PROV.presetter.termin);
  if (status === "verkauft") {
    await create(input.setterId, "setter", leadId, kunde, "Verkauf", PROV.setter.abschluss);
    await create(input.closerId, "closer", leadId, kunde, "Verkauf", PROV.closer.abschluss);
  }
  if (status === "abgesagt" || status === "verloren")
    await db
      .update(schema.provision)
      .set({ status: "storno", grund: `Kein Verkauf${input.reason ? ` – ${clean(input.reason, 120)}` : ""}`, stornoAt: new Date() })
      .where(and(eq(schema.provision.leadId, leadId), eq(schema.provision.status, "tbk")));
}

/* ---------- Admin: TBK und Storno ---------- */

/** Kunde ist TBK: alle wartenden Posten des Leads werden fest */
export async function markTbk(v: Viewer, leadId: string) {
  must(isAdmin(v.roles));
  const rows = await db
    .update(schema.provision)
    .set({ status: "fest", festAt: new Date() })
    .where(and(eq(schema.provision.leadId, leadId), eq(schema.provision.status, "tbk")))
    .returning();
  must(rows.length > 0, "Für diesen Kunden wartet keine Provision auf TBK");
  for (const r of rows) await notify([r.userId], `${r.kunde}: TBK – deine Provision ${r.betrag.toLocaleString("de-DE")} € ist fest und kommt in die nächste Abrechnung`);
  await db.insert(schema.auditLog).values({ actorId: v.id, action: "provision.tbk", detail: `${leadId}: ${rows.length} Posten fest` });
  return rows.length;
}

/** Storno (Widerruf, MVT nicht baubar …): offene und feste, noch nicht abgerechnete Posten werden storniert;
 *  bereits abgerechnete bekommen eine Gegenbuchung für die nächste Abrechnung. */
export async function storno(v: Viewer, leadId: string, grund: string) {
  must(isAdmin(v.roles));
  const g = clean(grund, 200);
  must(!!g, "Bitte einen Grund angeben");
  const rows = await db.select().from(schema.provision).where(and(eq(schema.provision.leadId, leadId), inArray(schema.provision.role, ["setter", "presetter", "closer"])));
  let n = 0;
  for (const r of rows) {
    if (r.status === "storno") continue;
    if (r.payoutId) {
      /* schon abgerechnet → Gegenbuchung */
      await db
        .insert(schema.provision)
        .values({ id: randomUUID(), userId: r.userId, role: `storno-${r.role}`, leadId, kunde: r.kunde, anlass: `Storno ${r.anlass}`, betrag: -r.betrag, status: "fest", grund: g, festAt: new Date() })
        .onConflictDoNothing();
    } else await db.update(schema.provision).set({ status: "storno", grund: g, stornoAt: new Date() }).where(eq(schema.provision.id, r.id));
    await notify([r.userId], `${r.kunde}: Storno – ${g} (${r.betrag.toLocaleString("de-DE")} €)`);
    n++;
  }
  must(n > 0, "Keine Provision zum Stornieren");
  await db.insert(schema.auditLog).values({ actorId: v.id, action: "provision.storno", detail: `${leadId}: ${n} Posten – ${g}` });
  return n;
}

/* ---------- Rückfragen (A13) ---------- */

export async function askProvision(v: Viewer, provisionId: string, text: string) {
  const frage = clean(text, 1000);
  must(!!frage, "Bitte die Frage eingeben");
  const [r] = await db.select().from(schema.provision).where(eq(schema.provision.id, provisionId));
  must(!!r && r.userId === v.id, "Position nicht gefunden");
  await db.update(schema.provision).set({ frage, frageAt: new Date(), antwort: null }).where(eq(schema.provision.id, provisionId));
  const [u] = await db.select({ name: schema.user.name }).from(schema.user).where(eq(schema.user.id, v.id));
  await notify(await adminIds(), `Rückfrage von ${u?.name.split(" ")[0] ?? "MB"} zu ${r.kunde} (${r.betrag.toLocaleString("de-DE")} €): ${frage}`);
}

export async function answerProvision(v: Viewer, provisionId: string, text: string) {
  must(isAdmin(v.roles));
  const antwort = clean(text, 1000);
  must(!!antwort, "Bitte eine Antwort eingeben");
  const [r] = await db.update(schema.provision).set({ antwort }).where(eq(schema.provision.id, provisionId)).returning();
  must(!!r, "Position nicht gefunden");
  await notify([r.userId], `Antwort zu ${r.kunde}: ${antwort}`);
}

/* ---------- Abrechnung (A12) ---------- */

export { nextRun };

/** Abrechnungen zum Stichtag erstellen: alle festen, noch nicht abgerechneten Posten je Person. Mehrfach aufrufbar. */
export async function runSettlement(stichtag = berlinToday()) {
  const ende = new Date(stichtag.getFullYear(), stichtag.getMonth(), stichtag.getDate(), 23, 59, 59);
  const zahltag = new Date(stichtag.getFullYear(), stichtag.getMonth(), stichtag.getDate() <= 1 ? 10 : 25);
  const rows = await db
    .select()
    .from(schema.provision)
    .where(and(eq(schema.provision.status, "fest"), isNull(schema.provision.payoutId), lte(schema.provision.festAt, ende)));
  const byUser = new Map<string, Row[]>();
  for (const r of rows) (byUser.get(r.userId) ?? byUser.set(r.userId, []).get(r.userId)!).push(r);
  const key = `${stichtag.getFullYear()}${pad(stichtag.getMonth() + 1)}${pad(stichtag.getDate())}`;
  const created: string[] = [];
  for (const [userId, list] of byUser) {
    const [p] = await db.select().from(schema.profile).where(eq(schema.profile.userId, userId));
    const netto = list.reduce((s, r) => s + r.betrag, 0);
    const ust = p?.kleinunternehmer ? 0 : Math.round(netto * UST_SATZ);
    const id = `AZ-${key}-${userId.slice(0, 8)}`;
    const posten: PayoutItem[] = list.map((r) => ({ datum: de(r.festAt ?? r.createdAt), kunde: r.kunde, anlass: r.anlass, betrag: r.betrag, status: "fest", grund: r.grund, provisionId: r.id }));
    const hinweis = !p?.ibanEnc ? "IBAN fehlt" : null;
    const [ins] = await db
      .insert(schema.payout)
      .values({ id, userId, periode: `Stichtag ${de(stichtag)}`, betrag: netto + ust, netto, ust, status: "pruefung", datum: de(zahltag), posten: JSON.stringify(posten), hinweis })
      .onConflictDoNothing()
      .returning();
    if (!ins) continue; /* gibt es schon */
    await db.update(schema.provision).set({ payoutId: id }).where(inArray(schema.provision.id, list.map((r) => r.id)));
    await notify([userId], `Deine Abrechnung zum ${de(stichtag)} ist erstellt: ${(netto + ust).toLocaleString("de-DE")} € – Auszahlung am ${de(zahltag)}${hinweis ? ` (${hinweis} – bitte in den Stammdaten ergänzen)` : ""}`);
    created.push(id);
  }
  if (created.length) await notify(await adminIds(), `${created.length} ${created.length === 1 ? "Abrechnung" : "Abrechnungen"} zum ${de(stichtag)} warten auf Freigabe`);
  return created;
}

/** Freigegebene Abrechnungen am Auszahlungstag als ausgezahlt markieren */
export async function markPaid(today = berlinToday()) {
  const rows = await db.select().from(schema.payout).where(eq(schema.payout.status, "freigegeben"));
  const due = rows.filter((p) => {
    const [d, m, y] = p.datum.split(".").map(Number);
    return new Date(y, m - 1, d) <= today;
  });
  for (const p of due) {
    await db.update(schema.payout).set({ status: "ausgezahlt" }).where(eq(schema.payout.id, p.id));
    await notify([p.userId], `Ausgezahlt: ${p.betrag.toLocaleString("de-DE")} € (${p.periode})`);
  }
  return due.length;
}

/** Täglicher Lauf: am 1. und 15. abrechnen, freigegebene am Auszahlungstag auszahlen */
export async function dailyPayoutRun(now = new Date()) {
  const today = berlinToday(now);
  const abrechnungen = today.getDate() === 1 || today.getDate() === 15 ? (await runSettlement(today)).length : 0;
  return { abrechnungen, ausgezahlt: await markPaid(today) };
}

/** Admin: Abrechnung freigeben – nicht bei fehlender IBAN */
export async function releasePayout(v: Viewer, payoutId: string) {
  must(isAdmin(v.roles));
  const [cur] = await db.select().from(schema.payout).where(eq(schema.payout.id, payoutId));
  must(!!cur && cur.status === "pruefung", "Abrechnung nicht gefunden oder schon freigegeben");
  const [prof] = await db.select({ iban: schema.profile.ibanEnc }).from(schema.profile).where(eq(schema.profile.userId, cur.userId));
  must(!!prof?.iban, "Freigabe nicht möglich: Die IBAN fehlt noch in den Stammdaten");
  const [p] = await db
    .update(schema.payout)
    .set({ status: "freigegeben", hinweis: null, releasedBy: v.id, releasedAt: new Date() })
    .where(and(eq(schema.payout.id, payoutId), eq(schema.payout.status, "pruefung")))
    .returning();
  await db.insert(schema.auditLog).values({ actorId: v.id, action: "payout.release", targetUserId: p.userId, detail: `${p.periode}: ${p.betrag} €` });
  await notify([p.userId], `Deine Abrechnung ${p.periode} wurde freigegeben (${p.betrag.toLocaleString("de-DE")} €) – Auszahlung am ${p.datum}`);
  return { periode: p.periode, userId: p.userId };
}

/* ---------- Laden ---------- */

export async function loadProvisions(v: Viewer): Promise<ProvisionItem[]> {
  const rows = await db
    .select()
    .from(schema.provision)
    .where(isAdmin(v.roles) ? undefined : eq(schema.provision.userId, v.id))
    .orderBy(desc(schema.provision.createdAt));
  return rows.map((r) => ({
    id: r.id,
    user: r.userId,
    role: r.role,
    lead: r.leadId,
    kunde: r.kunde,
    anlass: r.anlass,
    betrag: r.betrag,
    status: r.status as ProvisionItem["status"],
    grund: r.grund,
    payoutId: r.payoutId,
    frage: r.frage,
    antwort: r.antwort,
    datum: de(r.createdAt),
  }));
}

export async function loadPayouts(v: Viewer): Promise<Record<string, (Payout & { ibanLast4?: string | null })[]>> {
  const rows = await db
    .select({ p: schema.payout, last4: schema.profile.ibanLast4 })
    .from(schema.payout)
    .leftJoin(schema.profile, eq(schema.profile.userId, schema.payout.userId))
    .where(isAdmin(v.roles) ? undefined : eq(schema.payout.userId, v.id))
    .orderBy(desc(schema.payout.createdAt));
  const out: Record<string, (Payout & { ibanLast4?: string | null })[]> = {};
  for (const { p, last4 } of rows)
    (out[p.userId] ??= []).push({
      id: p.id,
      periode: p.periode,
      betrag: p.betrag,
      netto: p.netto,
      ust: p.ust,
      hinweis: p.hinweis,
      status: p.status as PayoutStatusKey,
      datum: p.datum,
      posten: parseItems(p.posten),
      ibanLast4: last4,
    });
  return out;
}

const parseItems = (s: string): PayoutItem[] => {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.filter((x) => x && typeof x === "object" && !Array.isArray(x)) : [];
  } catch {
    return [];
  }
};

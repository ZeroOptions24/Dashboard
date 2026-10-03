import "server-only";
import { eq } from "drizzle-orm";
import { STATUS } from "@/lib/domain";
import type { Lead } from "@/lib/types";
import { db, schema } from "./db";
import { leadContext } from "./lead-context";
import { enrichLeads, loadLeadsFromPipedrive } from "./pipedrive/leads";

/* Listen für Admins zum Aufräumen in Pipedrive (CSV, Semikolon, für Excel): Leads ohne Setter, mögliche Dubletten. */

const q = (s: unknown) => `"${String(s ?? "").replace(/"/g, '""')}"`;
const csv = (rows: unknown[][]) => "﻿" + rows.map((r) => r.map(q).join(";")).join("\r\n");
const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const digits = (s: string) => s.replace(/\D/g, "").replace(/^0049|^49/, "0");

/** Namen aus dem Team, nach denen in der Setter-Notiz gesucht wird */
async function teamFirstNames() {
  const users = await db
    .select({ name: schema.user.name, pd: schema.profile.pipedriveSetterName })
    .from(schema.user)
    .leftJoin(schema.profile, eq(schema.profile.userId, schema.user.id));
  return [...new Set(users.flatMap((u) => [u.pd, u.name.split(" ")[0]]).filter((x): x is string => !!x && x.length > 2))];
}

async function allLeads(adminId: string): Promise<Lead[]> {
  return enrichLeads(await loadLeadsFromPipedrive(), await leadContext(adminId)).filter((l) => l.id.startsWith("PD-"));
}

export async function exportWithoutSetter(adminId: string) {
  const names = await teamFirstNames();
  /* Wortgrenzen auch für Umlaute/Akzente (André, Aimée) */
  const hint = (t: string) => names.filter((n) => new RegExp(`(?<!\\p{L})${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?!\\p{L})`, "iu").test(t)).join(" / ");
  const rows = (await allLeads(adminId))
    .filter((l) => l.setter === "unbekannt")
    .map((l) => [l.id.slice(3), l.kunde, l.ort, l.datum, STATUS[l.status].label, hint(l.setNote), "", l.setNote]);
  await db.insert(schema.auditLog).values({ actorId: adminId, action: "lead.export", detail: `ohne Setter: ${rows.length}` });
  return csv([["Deal-ID", "Kunde", "Ort", "Eingang", "Stand", "Hinweis aus Notiz", "Setter (bitte eintragen)", "Setter-Notiz"], ...rows]);
}

export async function exportDuplicates(adminId: string) {
  const leads = await allLeads(adminId);
  const groups = new Map<string, { why: string; ids: Set<string> }>();
  const add = (key: string, why: string, id: string) => {
    const g = groups.get(key) ?? { why, ids: new Set<string>() };
    g.ids.add(id);
    groups.set(key, g);
  };
  for (const l of leads) {
    const t = digits(l.telFull ?? "");
    if (t.length >= 8) add(`t${t.slice(-8)}`, "gleiche Telefonnummer", l.id);
    if (l.email) add(`e${l.email.toLowerCase()}`, "gleiche E-Mail", l.id);
    const n = norm(l.kunde);
    if (n.includes(" ")) add(`n${n}`, "gleicher Name", l.id);
  }
  const byId = new Map(leads.map((l) => [l.id, l]));
  const seen = new Set<string>();
  const rows: unknown[][] = [];
  let nr = 0;
  for (const g of groups.values()) {
    if (g.ids.size < 2) continue;
    const key = [...g.ids].sort().join(",");
    if (seen.has(key)) continue;
    seen.add(key);
    nr++;
    for (const id of g.ids) {
      const l = byId.get(id)!;
      rows.push([nr, g.why, id.slice(3), l.kunde, l.adresse ?? l.ort, l.datum, STATUS[l.status].label]);
    }
  }
  await db.insert(schema.auditLog).values({ actorId: adminId, action: "lead.export", detail: `Dubletten: ${nr} Gruppen` });
  return csv([["Gruppe", "Grund", "Deal-ID", "Kunde", "Adresse", "Eingang", "Stand"], ...rows]);
}

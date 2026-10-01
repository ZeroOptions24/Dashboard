import "server-only";
import { eq, inArray } from "drizzle-orm";
import { db, schema } from "./db";
import { loadLeadsFromPipedrive, setterKey } from "./pipedrive/leads";

/* Setter-Zuweisung im Dashboard: für Deals ohne oder mit falschem Setter in Pipedrive.
   Die Zuweisung hat Vorrang vor dem Pipedrive-Feld; Pipedrive selbst bleibt unverändert. Aufrufer prüfen requireAdmin(). */

/** Lead-ID („PD-1036“) → Setter-Name */
export async function loadSetterAssignments(): Promise<Map<string, string>> {
  const rows = await db.select({ leadId: schema.setterAssignment.leadId, name: schema.setterAssignment.setterName }).from(schema.setterAssignment);
  return new Map(rows.map((r) => [r.leadId, r.name]));
}

const cleanName = (n: string) => n.trim().replace(/\s+/g, " ").slice(0, 80);

/** Einen Deal zuweisen; leerer Name entfernt die Zuweisung */
export async function assignSetter(leadId: string, name: string, adminId: string) {
  if (!/^PD-\d+$/.test(leadId)) throw new Error("Nur Deals aus Pipedrive können zugewiesen werden");
  const n = cleanName(name);
  if (!n) {
    await db.delete(schema.setterAssignment).where(eq(schema.setterAssignment.leadId, leadId));
  } else {
    await db
      .insert(schema.setterAssignment)
      .values({ leadId, setterName: n, assignedBy: adminId })
      .onConflictDoUpdate({ target: schema.setterAssignment.leadId, set: { setterName: n, assignedBy: adminId, assignedAt: new Date() } });
  }
  await db.insert(schema.auditLog).values({ actorId: adminId, action: "lead.setter_assigned", detail: `${leadId}: ${n || "–"}` });
}

export interface AssignmentLine {
  line: string;
  leadId: string;
  kunde: string;
  setter: string;
  /** Setter hat (noch) kein Dashboard-Konto mit diesem Pipedrive-Namen */
  ohneKonto: boolean;
  /** In Pipedrive steht ein anderer Setter – die Zuweisung ersetzt ihn im Dashboard */
  pipedriveSetter: string | null;
  error?: string;
}

/** Liste lesen: je Zeile „Deal-ID – Setter“ (auch Pipedrive-Link oder „#1036“); Trenner –, -, ;, Tab, : oder | */
export async function parseAssignments(text: string, knownSetterKeys: Set<string>): Promise<AssignmentLine[]> {
  const leads = new Map((await loadLeadsFromPipedrive()).map((l) => [l.id, l]));
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 500)
    .map((line) => {
      const id = line.match(/deal\/(\d+)/i)?.[1] ?? line.match(/^#?\s*(\d{1,9})\b/)?.[1] ?? "";
      const rest = line.replace(/https?:\/\/\S+/i, "").replace(/^#?\s*\d{1,9}/, "").replace(/^[\s–\-;:|\t,]+/, "");
      const setter = cleanName(rest);
      const leadId = id ? `PD-${id}` : "";
      const lead = leadId ? leads.get(leadId) : undefined;
      const error = !id ? "Deal-ID fehlt" : !setter ? "Setter fehlt" : !lead ? "Deal nicht gefunden (nur Wärmepumpen-Deals der Pipeline)" : undefined;
      return {
        line,
        leadId,
        kunde: lead?.kunde ?? "",
        setter,
        ohneKonto: !!setter && !knownSetterKeys.has(setterKey(setter)),
        pipedriveSetter: lead && lead.setter !== "unbekannt" && lead.setter !== setterKey(setter) ? lead.setter : null,
        error,
      };
    });
}

export async function importAssignments(text: string, knownSetterKeys: Set<string>, adminId: string) {
  const lines = await parseAssignments(text, knownSetterKeys);
  let ok = 0;
  for (const l of lines) {
    if (l.error) continue;
    await assignSetter(l.leadId, l.setter, adminId);
    ok++;
  }
  return { ok, skipped: lines.length - ok };
}

/** Zuweisungen einzelner Leads (für die Anzeige) */
export async function assignmentsFor(leadIds: string[]) {
  if (!leadIds.length) return new Map<string, string>();
  const rows = await db.select().from(schema.setterAssignment).where(inArray(schema.setterAssignment.leadId, leadIds));
  return new Map(rows.map((r) => [r.leadId, r.setterName]));
}

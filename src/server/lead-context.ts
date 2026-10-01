import "server-only";
import { loadActivities } from "./lead-activity";
import { loadOwnLeads } from "./own-leads";
import type { LeadContext } from "./pipedrive/leads";
import { loadSetterAssignments } from "./setter-assignment";
import { defaultPresetterId, leadIdsForCloser, setterIdMap } from "./workspace";

/** Alles aus der Dashboard-Datenbank, was in die Pipedrive-Leads einer Person einfließt */
export async function leadContext(userId: string): Promise<LeadContext> {
  const [setterIds, assignments, closerLeadIds, activities, defaultPresetter, ownLeads] = await Promise.all([
    setterIdMap(),
    loadSetterAssignments(),
    leadIdsForCloser(userId),
    loadActivities(),
    defaultPresetterId(),
    loadOwnLeads(),
  ]);
  return { setterIds, assignments, closerLeadIds, activities, defaultPresetter, ownLeads };
}

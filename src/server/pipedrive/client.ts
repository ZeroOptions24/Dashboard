import "server-only";

/* Minimaler Pipedrive-Client (API v2). Läuft ausschließlich auf dem Server –
   der API-Token darf nie im Browser landen. */

const BASE = "https://api.pipedrive.com/api/v2";

export class PipedriveNotConfigured extends Error {
  constructor() {
    super("PIPEDRIVE_API_TOKEN ist nicht gesetzt (siehe .env.example).");
  }
}

export interface PdDeal {
  id: number;
  title: string;
  person_id: number | null;
  stage_id: number;
  pipeline_id: number;
  status: "open" | "won" | "lost" | "deleted";
  lost_reason: string | null;
  add_time: string;
  update_time: string;
  stage_change_time: string | null;
  won_time: string | null;
  lost_time: string | null;
  owner_id: number;
  custom_fields?: Record<string, unknown>;
}

export interface PdPerson {
  id: number;
  name: string;
  phones?: { value: string; primary?: boolean; label?: string }[];
  postal_address?: { value?: string; locality?: string } | null;
}

interface PdList<T> {
  success: boolean;
  data: T[] | null;
  additional_data?: { next_cursor?: string | null };
}

async function pdGet<T>(path: string, params: Record<string, string | number | undefined>): Promise<PdList<T>> {
  const token = process.env.PIPEDRIVE_API_TOKEN;
  if (!token) throw new PipedriveNotConfigured();
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) if (v !== undefined) url.searchParams.set(k, String(v));
  const res = await fetch(url, { headers: { "x-api-token": token, accept: "application/json" }, cache: "no-store" });
  if (!res.ok) throw new Error(`Pipedrive ${path}: HTTP ${res.status}`);
  return res.json();
}

/** Alle Einträge einer Liste, seitenweise über den Cursor. */
async function pdGetAll<T>(path: string, params: Record<string, string | number | undefined>): Promise<T[]> {
  const out: T[] = [];
  let cursor: string | undefined;
  do {
    const page = await pdGet<T>(path, { ...params, limit: 500, cursor });
    out.push(...(page.data ?? []));
    cursor = page.additional_data?.next_cursor ?? undefined;
  } while (cursor);
  return out;
}

export function getDeals(pipelineId: number, customFields: string[]) {
  return pdGetAll<PdDeal>("/deals", {
    pipeline_id: pipelineId,
    status: "open,won,lost",
    custom_fields: customFields.join(","),
  });
}

/** Personen zu den IDs, in Blöcken zu je 100 (API-Limit). */
export async function getPersons(ids: number[]): Promise<PdPerson[]> {
  const out: PdPerson[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const page = await pdGet<PdPerson>("/persons", { ids: ids.slice(i, i + 100).join(",") });
    out.push(...(page.data ?? []));
  }
  return out;
}

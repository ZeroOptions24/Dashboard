import "server-only";

/* Minimaler Pipedrive-Client (API v2). Läuft ausschließlich auf dem Server –
   der API-Token darf nie im Browser landen. */

/* PIPEDRIVE_API_BASE nur für Tests gegen einen nachgebauten Pipedrive-Server */
const BASE = process.env.PIPEDRIVE_API_BASE || "https://api.pipedrive.com/api/v2";

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

/* ---------- Schreiben (nur mit PIPEDRIVE_WRITE=true) ---------- */

/** Zurückschreiben nach Pipedrive (PIPEDRIVE_WRITE):
 *  aus (Standard) · „notizen“ = nur Notizen am Deal, Stufe/Status bleiben · „true“ = Notizen + Stufe/Status */
export const pipedriveWriteMode = (): "aus" | "notizen" | "alles" => {
  const v = (process.env.PIPEDRIVE_WRITE ?? "").trim().toLowerCase();
  return v === "true" ? "alles" : v === "notizen" ? "notizen" : "aus";
};
export const pipedriveWriteEnabled = () => pipedriveWriteMode() !== "aus";

async function pdSend(method: "PATCH" | "POST", url: string, body: unknown) {
  const token = process.env.PIPEDRIVE_API_TOKEN;
  if (!token) throw new PipedriveNotConfigured();
  const res = await fetch(url, {
    method,
    headers: { "x-api-token": token, accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Pipedrive ${method} ${new URL(url).pathname}: HTTP ${res.status}`);
  return res.json();
}

export interface DealUpdate {
  stage_id?: number;
  status?: "open" | "won" | "lost";
  lost_reason?: string;
}

/** Deal ändern (API v2) */
export const updateDeal = (id: number, patch: DealUpdate) => pdSend("PATCH", `${BASE}/deals/${id}`, patch);

/** Notiz am Deal (Notizen gibt es nur in API v1) */
export const addDealNote = (dealId: number, content: string) => pdSend("POST", `${BASE.replace(/\/v2$/, "/v1")}/notes`, { deal_id: dealId, content });

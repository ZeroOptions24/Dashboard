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
  emails?: { value: string; primary?: boolean; label?: string }[];
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

/** Deals einer Pipeline mit allen eigenen Feldern (Setter, Vorqualifizierung …) */
export function getDeals(pipelineId: number) {
  return pdGetAll<PdDeal>("/deals", {
    pipeline_id: pipelineId,
    status: "open,won,lost",
  });
}

export interface PdNote {
  id: number;
  deal_id: number | null;
  content: string;
  add_time: string;
}

/** Notizen der letzten `days` Tage (API v1, seitenweise) – daraus liest das Dashboard die Lead-Notiz von n8n. */
export async function getRecentNotes(days = 200): Promise<PdNote[]> {
  const token = process.env.PIPEDRIVE_API_TOKEN;
  if (!token) throw new PipedriveNotConfigured();
  const since = new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
  const out: PdNote[] = [];
  for (let start = 0, page = 0; page < 40; page++) {
    const url = new URL(`${BASE.replace(/\/v2$/, "/v1")}/notes`);
    url.searchParams.set("start", String(start));
    url.searchParams.set("limit", "500");
    url.searchParams.set("start_date", since);
    url.searchParams.set("sort", "add_time ASC");
    const res = await fetch(url, { headers: { "x-api-token": token, accept: "application/json" }, cache: "no-store" });
    if (!res.ok) throw new Error(`Pipedrive /notes: HTTP ${res.status}`);
    const body = (await res.json()) as { data: PdNote[] | null; additional_data?: { pagination?: { more_items_in_collection?: boolean; next_start?: number } } };
    out.push(...(body.data ?? []));
    const pg = body.additional_data?.pagination;
    if (!pg?.more_items_in_collection || pg.next_start == null) break;
    start = pg.next_start;
  }
  return out;
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

/* ---------- Dashboard-Pipeline: anlegen und Leads schreiben (Dashboard = Quelle der Wahrheit) ---------- */

const V1 = () => BASE.replace(/\/v2$/, "/v1");

async function pdCall<T>(method: "GET" | "POST" | "PATCH" | "DELETE", url: string, body?: unknown): Promise<T> {
  const token = process.env.PIPEDRIVE_API_TOKEN;
  if (!token) throw new PipedriveNotConfigured();
  const res = await fetch(url, {
    method,
    headers: { "x-api-token": token, accept: "application/json", ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Pipedrive ${method} ${new URL(url).pathname}: HTTP ${res.status} ${text.slice(0, 200)}`);
  return (text ? JSON.parse(text) : {}) as T;
}

export const listPipelines = async () => (await pdCall<{ data: { id: number; name: string }[] | null }>("GET", `${V1()}/pipelines`)).data ?? [];
export const createPipeline = async (name: string) => (await pdCall<{ data: { id: number } }>("POST", `${V1()}/pipelines`, { name })).data.id;
export const listStages = async (pipelineId: number) =>
  (await pdCall<{ data: { id: number; name: string; order_nr: number }[] | null }>("GET", `${V1()}/stages?pipeline_id=${pipelineId}`)).data ?? [];
export const createStage = async (pipelineId: number, name: string) => (await pdCall<{ data: { id: number } }>("POST", `${V1()}/stages`, { name, pipeline_id: pipelineId })).data.id;
export const listDealFields = async () =>
  (await pdCall<{ data: { key: string; name: string; field_type: string }[] | null }>("GET", `${V1()}/dealFields?limit=500`)).data ?? [];
export const createDealField = async (name: string, fieldType: "varchar" | "text" | "double") =>
  (await pdCall<{ data: { key: string } }>("POST", `${V1()}/dealFields`, { name, field_type: fieldType })).data.key;

export interface NewPerson {
  name: string;
  phone: string;
  email?: string | null;
  address?: { value: string; route: string; street_number: string; postal_code: string; locality: string } | null;
}

/** Person anlegen (API v2) – mit echter Adresse; lehnt Pipedrive die Adresse ab, ohne Adresse erneut */
export async function createPerson(p: NewPerson): Promise<number> {
  const body = {
    name: p.name,
    phones: [{ value: p.phone, primary: true, label: "mobile" }],
    ...(p.email ? { emails: [{ value: p.email, primary: true, label: "work" }] } : {}),
  };
  if (p.address) {
    try {
      return (await pdCall<{ data: { id: number } }>("POST", `${BASE}/persons`, { ...body, postal_address: { ...p.address, country: "Deutschland" } })).data.id;
    } catch (e) {
      if (!/HTTP 400/.test(String(e))) throw e;
    }
  }
  return (await pdCall<{ data: { id: number } }>("POST", `${BASE}/persons`, body)).data.id;
}

/** Deal anlegen (API v2) mit eigenen Feldern */
export async function createDeal(d: { title: string; personId: number; pipelineId: number; stageId: number; customFields: Record<string, unknown> }) {
  return (
    await pdCall<{ data: { id: number } }>("POST", `${BASE}/deals`, {
      title: d.title,
      person_id: d.personId,
      pipeline_id: d.pipelineId,
      stage_id: d.stageId,
      custom_fields: d.customFields,
    })
  ).data.id;
}

/** Deal ändern inkl. eigener Felder (API v2) */
export const patchDeal = (id: number, patch: DealUpdate & { custom_fields?: Record<string, unknown> }) => pdCall("PATCH", `${BASE}/deals/${id}`, patch);

/** Deal löschen (landet in Pipedrive 30 Tage im Papierkorb) */
export const deleteDeal = (id: number) => pdCall("DELETE", `${V1()}/deals/${id}`);

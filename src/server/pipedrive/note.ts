/* Die Lead-Notiz, die n8n (wp-lead) beim Anlegen an den Deal hängt, in Felder zerlegen.
   Format: Zeilen mit <br>, „<b>Feld:</b> Wert“, Abschnitte „<b>── KONTAKT ──</b>“ usw.; leere Werte „—“. */

export interface LeadNote {
  anrede?: string;
  name?: string;
  telefon?: string;
  email?: string;
  /** „Straße Nr, PLZ Ort“ */
  adresse?: string;
  strasse?: string;
  plz?: string;
  ort?: string;
  thema?: string;
  entscheider?: string;
  /** Rückruf-/Terminwunsch als Text, z. B. „Mo. 21.09.2026, 10:15 Uhr“ */
  rueckruf?: string;
  /** Freitext des Setters */
  setterNotiz?: string;
  gps?: { lat: number; lon: number };
  eingegangen?: string;
}

const decode = (s: string) =>
  s
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();
const val = (s: string | undefined) => {
  const v = decode(s ?? "");
  return v && v !== "—" && v !== "-" ? v : undefined;
};

/** Ist das die Lead-Notiz aus dem Türgeschäft? */
export const isLeadNote = (html: string) => /NEUER LEAD/i.test(html) && /──\s*KONTAKT\s*──/.test(html);

export function parseLeadNote(html: string): LeadNote {
  const out: LeadNote = {};
  const lines = html.split(/<br\s*\/?>|\r?\n/i);
  let section = "";
  const freitext: string[] = [];
  const rueckruf: string[] = [];
  for (const raw of lines) {
    const sec = raw.match(/──\s*([^─]+?)\s*──/);
    if (sec) {
      section = sec[1].toUpperCase();
      continue;
    }
    const gps = raw.match(/maps\.google\.com\/\?q=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
    if (gps) {
      out.gps = { lat: Number(gps[1]), lon: Number(gps[2]) };
      continue;
    }
    const kv = raw.match(/^\s*<b>([^<:]+):<\/b>\s*(.*)$/i);
    const text = decode(raw);
    if (section.startsWith("NOTIZEN")) {
      if (text && !/^🔗|Leitfaden öffnen|Vorqualifizierung (per Telefon|öffnen)/.test(text) && !/keine Notizen eingetragen/i.test(text)) freitext.push(text);
      continue;
    }
    if (!kv) continue;
    const key = decode(kv[1]).toLowerCase();
    const v = val(kv[2]);
    if (!v) continue;
    if (section.startsWith("RÜCKRUF") || section.startsWith("RUECKRUF")) {
      rueckruf.push(key === "wunsch" ? v : `${decode(kv[1])}: ${v}`);
      continue;
    }
    switch (key) {
      case "eingegangen": out.eingegangen = v; break;
      case "anrede": out.anrede = v; break;
      case "name": out.name = v; break;
      case "telefon": out.telefon = v; break;
      case "e-mail": out.email = v; break;
      case "adresse": {
        out.adresse = v;
        const m = v.match(/^(.*?),\s*(\d{5})\s+(.+)$/);
        if (m) [out.strasse, out.plz, out.ort] = [m[1].trim(), m[2], m[3].trim()];
        break;
      }
      case "thema": out.thema = v; break;
      case "alle entscheider dabei": out.entscheider = v; break;
    }
  }
  if (freitext.length) out.setterNotiz = freitext.join("\n");
  if (rueckruf.length) out.rueckruf = rueckruf.join(" · ");
  return out;
}

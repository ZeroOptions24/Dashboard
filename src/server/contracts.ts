import "server-only";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { AuthRole } from "./auth";

/* Vertragserzeugung aus Vorlage + Stammdaten.

   TODO (EnergyEngel): Vertragsvorlagen liefern (Handelsvertretervertrag § 84 HGB,
   Provisionsvereinbarung je Rolle), vom Anwalt freigegeben. Bis dahin erzeugt
   generateContract() einen deutlich gekennzeichneten PLATZHALTER, damit der
   Ablauf Einladung → Daten → Vertrag → Unterschrift → Zugang testbar ist. */

export interface ContractInput {
  role: AuthRole;
  name: string;
  email: string;
  strasse: string;
  plz: string;
  ort: string;
  geburtsdatum: string;
  steuernummer: string;
  kleinunternehmer: boolean;
}

export interface ContractDocument {
  fileName: string;
  title: string;
  pdf: Uint8Array;
}

/** Welche Verträge je Rolle unterschrieben werden. */
export const CONTRACTS_BY_ROLE: Record<Exclude<AuthRole, "admin">, string[]> = {
  setter: ["Handelsvertretervertrag (§ 84 HGB)", "Provisionsvereinbarung Setting"],
  presetter: ["Handelsvertretervertrag (§ 84 HGB)", "Provisionsvereinbarung Presetting"],
  closer: ["Handelsvertretervertrag (§ 84 HGB)", "Provisionsvereinbarung Closing"],
};

export async function generateContract(input: ContractInput): Promise<ContractDocument> {
  const titles = input.role === "admin" ? [] : CONTRACTS_BY_ROLE[input.role];
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([595, 842]); // A4
  let y = 780;
  const line = (text: string, opts: { size?: number; b?: boolean; color?: [number, number, number] } = {}) => {
    page.drawText(text, { x: 60, y, size: opts.size ?? 11, font: opts.b ? bold : font, color: rgb(...(opts.color ?? [0.07, 0.13, 0.1])) });
    y -= (opts.size ?? 11) + 9;
  };
  line("PLATZHALTER – KEIN GÜLTIGER VERTRAG", { size: 16, b: true, color: [0.69, 0.25, 0.17] });
  line("Die echte Vertragsvorlage wird von EnergyEngel noch geliefert.", { color: [0.69, 0.25, 0.17] });
  y -= 10;
  line("Vertragsunterlagen EnergyEngel", { size: 14, b: true });
  for (const t of titles) line(`• ${t}`);
  y -= 10;
  line("Vertragspartner/in", { b: true });
  line(input.name);
  line(`${input.strasse}, ${input.plz} ${input.ort}`);
  line(`Geboren am ${input.geburtsdatum} · ${input.email}`);
  line(`Steuernummer: ${input.steuernummer || "—"} · Kleinunternehmer: ${input.kleinunternehmer ? "ja" : "nein"}`);
  y -= 30;
  line("Unterschrift Vertragspartner/in:", { b: true });
  /* Position des Unterschriftsfelds – das Signing-Tool setzt hier die Signatur */
  page.drawRectangle({ x: 60, y: SIGNATURE_FIELD.y, width: SIGNATURE_FIELD.width, height: SIGNATURE_FIELD.height, borderColor: rgb(0.7, 0.75, 0.72), borderWidth: 1 });
  const pdf = await doc.save();
  return { fileName: "vertrag.pdf", title: `Vertrag ${input.name}`, pdf };
}

/** Unterschriftsfeld auf Seite 1 (PDF-Koordinaten, Ursprung unten links). */
export const SIGNATURE_FIELD = { page: 1, x: 60, y: 300, width: 220, height: 70 };

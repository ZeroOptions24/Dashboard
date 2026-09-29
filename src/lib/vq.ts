/* Vorqualifizierung (Wärmepumpe): grobe Heizlast-Schätzung – ersetzt keine Heizlastberechnung. */

export function heatEstimate(vq: Record<string, string | undefined>): number | null {
  const a = +(vq.wohnflaeche ?? 0),
    bj = +(vq.baujahr_haus ?? 0);
  if (!a || !bj) return null;
  let wpm2 = bj < 1978 ? 120 : bj < 1995 ? 90 : bj < 2002 ? 70 : bj < 2016 ? 50 : 35;
  if (vq.fassade_gedaemmt === "Ja") wpm2 *= 0.85;
  if (vq.dach_gedaemmt === "Ja") wpm2 *= 0.9;
  if (String(vq.fenster || "").startsWith("3")) wpm2 *= 0.9;
  if (vq.fenster === "Einfachverglasung") wpm2 *= 1.15;
  return Math.round((a * wpm2) / 100) / 10;
}

export const heatText = (vq: Record<string, string | undefined>) => {
  const h = heatEstimate(vq);
  return h ? `≈ ${h.toLocaleString("de-DE")} kW` : "–";
};

/* ---------- Formularfelder (Lead erfassen, Vorqualifizierung, Telefonleitfaden) ---------- */

export interface FieldDef {
  /** Feldname = Payload-Feld der bestehenden n8n-Formulare */
  n: string;
  l: string;
  t: "radio" | "check" | "select" | "text" | "textarea" | "number" | "tel" | "email" | "time";
  o?: string[];
  /** Optionen zweispaltig */
  cols?: boolean;
  /** halbe Breite */
  half?: boolean;
  req?: boolean;
  /** fließt in die Heizlast-Schätzung ein */
  heat?: boolean;
  /** K.-o.-Kriterium */
  ko?: boolean;
  sensitive?: boolean;
  hint?: string;
  ph?: string;
  step?: string;
  im?: "tel" | "numeric";
  max?: number;
  ac?: string;
  /** nur anzeigen, wenn Feld [0] den Wert [1] hat */
  showIf?: [string, string];
}

export interface VqSection {
  key: string;
  title: string;
  fields: FieldDef[];
}

export type FormValues = Record<string, string | string[] | undefined>;

export const ZEITFENSTER = ["Vormittag (8–12 Uhr)", "Mittag (12–15 Uhr)", "Nachmittag (15–18 Uhr)", "Abend (18–20 Uhr)"];
const J_N = ["Ja", "Nein"];
const N15 = ["1", "2", "3", "4", "5+"];

/* Vorqualifizierung Wärmepumpe – Abschnitte und Fragen wie in waermepumpe-vorqualifizierung.html */
export const VQ_SECTIONS: VqSection[] = [
  { key:'gebaeude', title:'Gebäude', fields:[
    { n:'haustyp', l:'Ist Ihr Haus ein Ein- oder Mehrfamilienhaus?', t:'radio', o:['EFH','MFH'], cols:true },
    { n:'gebaeudeart', l:'Um welche Gebäudeart handelt es sich?', t:'select', o:['Freistehend','Doppelhaushälfte','Reihenendhaus','Reihenmittelhaus'] },
    { n:'geschosse', l:'Bewohnbare Geschosse', t:'select', o:N15 },
    { n:'wohneinheiten', l:'Anzahl der Wohneinheiten', t:'select', o:N15 },
    { n:'personen_haus', l:'Personen im Haus', t:'number', ph:'z. B. 3' },
    { n:'personen_u18', l:'Davon unter 18 Jahren', t:'select', o:['0','1','2','3','4+'] },
    { n:'baumassnahmen', l:'Baumaßnahmen geplant/laufend?', t:'radio', o:J_N, cols:true },
    { n:'wohnflaeche', l:'Beheizbare Wohnfläche (m²)', t:'number', ph:'z. B. 140', heat:true },
    { n:'baujahr_haus', l:'Baujahr des Hauses', t:'number', ph:'z. B. 1994', heat:true },
  ]},
  { key:'daemmung', title:'Dämmung', fields:[
    { n:'fassade_gedaemmt', l:'Ist die Fassade nachträglich gedämmt worden?', t:'radio', o:J_N, cols:true, heat:true },
    { n:'fassade_daemmung_art', l:'Art und Dicke der Dämmung', t:'text', ph:'z. B. 4cm Styropor', showIf:['fassade_gedaemmt','Ja'] },
    { n:'fassade_daemmung_jahr', l:'Wann aufgebracht (Jahr)', t:'number', ph:'z. B. 1979', showIf:['fassade_gedaemmt','Ja'] },
    { n:'dach_gedaemmt', l:'Ist das Dach oder der Dachboden nachträglich gedämmt?', t:'radio', o:J_N, cols:true, heat:true },
    { n:'dach_daemmung_ort', l:'Wo ist die Dämmung am Dach aufgebracht?', t:'select', o:['Auf der obersten Geschossdecke','Zwischen den Sparren','Unter den Sparren','Aufsparrendämmung'], showIf:['dach_gedaemmt','Ja'] },
    { n:'dach_daemmung_art', l:'Art und Dicke der Dämmung', t:'text', ph:'z. B. 4cm Styropor', showIf:['dach_gedaemmt','Ja'] },
    { n:'dach_daemmung_jahr', l:'Wann aufgebracht (Jahr)', t:'number', ph:'z. B. 1979', showIf:['dach_gedaemmt','Ja'] },
    { n:'fenster', l:'Sind die Fenster isolierverglast?', t:'radio', o:['Einfachverglasung','2 Scheibenglas','2 Scheiben Wärmeschutzglas','3 Scheibenglas oder 3 Scheiben Wärmeschutzglas'], heat:true },
  ]},
  { key:'heizung', title:'Heizung', fields:[
    { n:'heizungsart', l:'Art der Heizung', t:'select', o:['Öl','Gas','Fernwärme','Strom (Nachtspeicher)','Holz/Pellets','Wärmepumpe','Sonstige'] },
    { n:'heizungsart_2', l:'Art der 2. Heizung', t:'select', o:['Keine','Öl','Gas','Fernwärme','Strom (Nachtspeicher)','Holz/Pellets','Sonstige'], hint:'nur Wärmequellen, die die WP ersetzen soll' },
    { n:'oelverbrauch', l:'Ölverbrauch (Liter/Jahr)', t:'number', ph:'z. B. 1800', hint:'1 l = 10 kWh', showIf:['heizungsart','Öl'] },
    { n:'heizung_baujahr', l:'Baujahr der Heizung', t:'number', ph:'z. B. 2020' },
    { n:'heizung_funktionstuechtig', l:'Heizung noch funktionstüchtig?', t:'radio', o:J_N, cols:true },
    { n:'heizraum', l:'Wo befindet sich der Heizraum?', t:'select', o:['Keller','Erdgeschoss','Dachboden','Sonstige'] },
    { n:'heizverteilung', l:'Womit heizen Sie (Verteilung)?', t:'radio', o:['Heizkörper','Fußbodenheizung','Beides','Weder Noch'], cols:true },
    { n:'warmwasser', l:'Wird das Warmwasser auch über die Heizung erwärmt?', t:'radio', o:['Ja','Nein','Nein, aber künftig über die Wärmepumpe'] },
    { n:'solarthermie', l:'Solarthermieanlage vorhanden?', t:'radio', o:J_N, cols:true },
    { n:'wasserg_kamin', l:'Wassergeführter Kamin vorhanden?', t:'radio', o:J_N, cols:true },
    { n:'energiekosten_heizung', l:'Energiekosten für die Heizung (ct/kWh)', t:'number', ph:'z. B. 10', step:'0.1' },
  ]},
  { key:'strom_pv', title:'Strom & PV', fields:[
    { n:'stromkosten', l:'Stromkosten (ct/kWh)', t:'number', ph:'z. B. 25', step:'0.1' },
    { n:'pv_anlage', l:'PV-Anlage auf dem Dach?', t:'radio', o:['Ja, von Enpal','Ja, von einem Drittanbieter','Nein'] },
  ]},
  { key:'eigentum', title:'Eigentum & Haushalt', fields:[
    { n:'eigentuemer', l:'Sind Sie als Privatperson (oder GbR) im Grundbuch eingetragener Eigentümer?', t:'radio', o:['Ja','Nein','Nein, aber verwandt'], hint:'Wichtig: Eigentümer muss im SC1 sein', ko:true },
    { n:'zweiter_eigentuemer', l:'Zweiter Eigentümer vorhanden?', t:'radio', o:J_N, cols:true },
    { n:'selbst_bewohnt', l:'Selbst bewohnt oder Einzug geplant?', t:'radio', o:J_N, cols:true, ko:true },
    { n:'haushaltseinkommen', l:'Jährliches Brutto-Haushaltseinkommen', t:'radio', o:['Unter 30.000 €','30.000–40.000 €','40.000–50.000 €','50.000–60.000 €','Über 60.000 €'], sensitive:true },
    { n:'smartphone', l:'Besitzt Kunde ein Smartphone?', t:'radio', o:J_N, cols:true },
  ]},
];

/* Lead erfassen, Schritt 1 – Felder wie im bestehenden Setting-Formular */
export const STEP1 = {
  notizen:{ n:'notizen', l:'Alles, was der Innendienst zum Termin wissen sollte', t:'textarea', ph:'z. B. Gastherme 20 Jahre alt, Ehefrau entscheidet mit, Hund im Garten' },
  alle_entscheider:{ n:'alle_entscheider', l:'Sind alle Entscheider beim Termin dabei?', t:'radio', o:['Ja, alle Entscheider sind dabei','Nein, nicht alle dabei'] },
  rueckruf_datum:{ n:'rueckruf_datum', l:'Wann soll der Kunde angerufen werden?', t:'radio', o:['Heute','Morgen','wann anders'], cols:true },
  rueckruf_uhrzeit:{ n:'rueckruf_uhrzeit', l:'Genaue Uhrzeit falls vereinbart', t:'time', half:true },
  zeitfenster:{ n:'zeitfenster', l:'Erreichbarkeit', t:'check', o:ZEITFENSTER, cols:true },
  anrede:{ n:'anrede', l:'Anrede', t:'radio', o:['Frau','Herr'], cols:true },
  vorname:{ n:'vorname', l:'Vorname', t:'text', half:true, ac:'off' },
  nachname:{ n:'nachname', l:'Nachname', t:'text', req:true, half:true, ac:'off' },
  telefon:{ n:'telefon', l:'Telefon', t:'tel', req:true, half:true, im:'tel', ph:'0170 1234567' },
  email:{ n:'email', l:'E-Mail', t:'email', half:true, ph:'name@beispiel.de' },
  strasse:{ n:'strasse', l:'Straße', t:'text', req:true, half:true },
  hausnummer:{ n:'hausnummer', l:'Hausnummer', t:'text', req:true, half:true },
  plz:{ n:'plz', l:'Postleitzahl', t:'text', req:true, half:true, im:'numeric', max:5, ph:'5 Ziffern' },
  stadt:{ n:'stadt', l:'Stadt', t:'text', req:true, half:true },
} satisfies Record<string, FieldDef>;

/** Feld sichtbar? (bedingte Felder) */
export const fieldVisible = (f: FieldDef, v: FormValues) => !f.showIf || v[f.showIf[0]] === f.showIf[1];

/** Beantwortete / sichtbare Fragen der Vorqualifizierung */
export function vqProgress(vq: FormValues) {
  let total = 0,
    done = 0;
  for (const s of VQ_SECTIONS)
    for (const f of s.fields) {
      if (!fieldVisible(f, vq)) continue;
      total++;
      if (vq[f.n] !== undefined && vq[f.n] !== "") done++;
    }
  return { total, done };
}

/** Zusammenfassung für die Notiz an Presetter/Closer */
export function vqSummary(vq: FormValues) {
  const s = (k: string) => vq[k] as string | undefined;
  const h = heatEstimate(vq as Record<string, string>);
  return [
    s("wohnflaeche") && `${s("wohnflaeche")} m²`,
    s("baujahr_haus") && `Bj. ${s("baujahr_haus")}`,
    s("gebaeudeart"),
    s("heizungsart") && `${s("heizungsart")}${s("heizung_baujahr") ? " (Bj. " + s("heizung_baujahr") + ")" : ""}`,
    s("oelverbrauch") && `${s("oelverbrauch")} l Öl/Jahr`,
    s("heizverteilung"),
    s("pv_anlage") && `PV: ${s("pv_anlage")}`,
    s("eigentuemer") && `Eigentümer: ${s("eigentuemer")}`,
    h && `Heizlast ≈ ${h.toLocaleString("de-DE")} kW`,
  ]
    .filter(Boolean)
    .join(" · ");
}

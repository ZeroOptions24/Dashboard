/* Vorqualifizierung (Wärmepumpe): grobe Heizlast-Schätzung – ersetzt keine Heizlastberechnung. */

export function heatEstimate(vq: Record<string, string | undefined>): number | null {
  const a = +(vq.wohnflaeche ?? 0),
    bj = +(vq.baujahr_haus ?? 0);
  if (!a || !bj) return null;
  let wpm2 = bj < 1978 ? 120 : bj < 1995 ? 90 : bj < 2002 ? 70 : bj < 2016 ? 50 : 35;
  if (vq.fassade_gedaemmt === "Ja") wpm2 *= 0.85;
  if (vq.dach_gedaemmt === "Ja") wpm2 *= 0.9;
  const fenster = normalizeVq({ fenster: vq.fenster }).fenster;
  if (fenster === "3-fach") wpm2 *= 0.9;
  if (fenster === "Einfach") wpm2 *= 1.15;
  return Math.round((a * wpm2) / 100) / 10;
}

export const heatText = (vq: Record<string, string | undefined>) => {
  const h = heatEstimate(vq);
  return h ? `≈ ${h.toLocaleString("de-DE")} kW` : "–";
};

/* ---------- Formularfelder (Lead erfassen, Vorqualifizierung, Telefonleitfaden) ---------- */

export type FormValues = Record<string, string | string[] | undefined>;

export interface FieldDef {
  /** Feldname = Payload-Feld der bestehenden n8n-Formulare bzw. Pipedrive-Feld „VQ …“ */
  n: string;
  l: string;
  t: "radio" | "check" | "select" | "text" | "textarea" | "number" | "tel" | "email" | "time" | "date";
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
  /** Satz für das Gespräch (Telefonleitfaden) */
  say?: string;
  ph?: string;
  step?: string;
  im?: "tel" | "numeric";
  /** Zahl: Höchstwert (Grenze wie in TMVT) · Text: maximale Länge */
  max?: number;
  /** Zahl: Mindestwert */
  min?: number;
  ac?: string;
  /** Folgefrage: nur anzeigen, wenn die Bedingung erfüllt ist */
  when?: (q: FormValues) => boolean;
  /** Prüfung wie in TMVT – liefert Fehlertext oder "" */
  check?: (v: string, q: FormValues) => string;
}

export interface VqSection {
  key: string;
  title: string;
  fields: FieldDef[];
}

export const ZEITFENSTER = ["Vormittag (8–12 Uhr)", "Mittag (12–15 Uhr)", "Nachmittag (15–18 Uhr)", "Abend (18–20 Uhr)"];
const J_N = ["Ja", "Nein"];

/* =====================================================================
   Vorqualifizierung Wärmepumpe – Logik nach Enpal-TMVT (Tims Vorlage, Stand 03.10.2026)
   · Folgefragen nur, wenn der Auslöser gewählt ist (when)
   · Grenzen wie im Tool (check / min / max) – sonst blockiert TMVT die Übergabe
   · Feldnamen, die es in Pipedrive schon gibt („VQ …“), bleiben gleich; neue sind vorläufig,
     das Mapping auf die Enpal-Feldnamen (heating_type, self_use …) folgt, sobald Lara die Liste schickt
   ===================================================================== */

/** Text eines Werts (Mehrfachauswahl als „a, b“) */
const str = (v: unknown) => (Array.isArray(v) ? v.join(", ") : v == null ? "" : String(v));
/** Mehrfachauswahl als Liste (im Wizard Array, am Lead „a, b“) */
const list = (v: unknown) => (Array.isArray(v) ? v.map(String) : str(v) ? str(v).split(", ") : []);
export const isAnswered = (v: unknown) => (Array.isArray(v) ? v.length > 0 : v !== undefined && v !== null && String(v).trim() !== "");

export const HEIZARTEN = ["Öl", "Gas", "Gas-Etagenheizung", "Fernwärme", "Pellet", "Biomasse", "Wärmepumpe", "Direktstrom", "Nachtspeicher", "Kamin Holz", "Kamin Kohle", "Sonstige"];
const isNo = (v: unknown) => v === "Nein" || v === "Nein, aber verwandt";
const bjAlt = (q: FormValues) => +str(q.baujahr_haus) >= 1900 && +str(q.baujahr_haus) <= 1980;
/** Norddeutschland (PLZ 0…–52…): dort ist zweischaliges Mauerwerk mit Luftschicht häufig */
const plzNord = (q: FormValues) => {
  const p = str(q.plz).slice(0, 2);
  return /^\d\d$/.test(p) && +p <= 52;
};
const bmHas = (q: FormValues, ...xs: string[]) => q.baumassnahmen === "Ja" && list(q.bm_welche).some((x) => xs.includes(x));
const yr = (lo: number, hi: number) => (v: string) => (v && (+v < lo || +v > hi) ? `Nur ${lo}–${hi} möglich` : "");
const afterBj = (v: string, q: FormValues) => (v && q.baujahr_haus && +v <= +str(q.baujahr_haus) ? "Muss nach dem Baujahr des Hauses liegen" : "");
const fernwaerme = (q: FormValues) => q.heizungsart === "Fernwärme" || q.heizungsart_2 === "Fernwärme";

/* Jahresverbrauch je Heizungsart – gilt für 1. und 2. Heizung */
const VERBRAUCH: { types: string[]; f: { k: string; l: string; max?: number; ph?: string; step?: string; half?: boolean }[] }[] = [
  { types: ["Öl"], f: [{ k: "oel_l", l: "Ölverbrauch (Liter/Jahr)", max: 7500, ph: "z. B. 2.200" }] },
  { types: ["Gas", "Gas-Etagenheizung", "Fernwärme"], f: [{ k: "kwh", l: "Verbrauch (kWh/Jahr)", max: 75000, ph: "z. B. 21.000" }] },
  { types: ["Pellet", "Biomasse"], f: [{ k: "t", l: "Verbrauch (Tonnen/Jahr)", max: 15, step: "0.1", ph: "z. B. 4,5" }] },
  {
    types: ["Wärmepumpe"],
    f: [
      { k: "wp_kwh", l: "Stromverbrauch Wärmepumpe (kWh/Jahr)", ph: "z. B. 4.500", half: true },
      { k: "jaz", l: "Jahresarbeitszahl (JAZ)", step: "0.1", ph: "z. B. 3,2", half: true },
    ],
  },
  { types: ["Direktstrom", "Nachtspeicher"], f: [{ k: "strom_kwh", l: "Stromverbrauch Heizung (kWh/Jahr)", ph: "z. B. 14.000" }] },
  { types: ["Kamin Holz"], f: [{ k: "rm", l: "Holz (Raummeter/Jahr)", max: 50, ph: "z. B. 6" }] },
  {
    types: ["Kamin Kohle"],
    f: [
      { k: "steinkohle_kg", l: "Steinkohle (kg/Jahr)", half: true },
      { k: "braunkohle_kg", l: "Braunkohle (kg/Jahr)", half: true },
    ],
  },
];
/** Feldname je Heizung; der Ölverbrauch der 1. Heizung heißt wie das bestehende Pipedrive-Feld „oelverbrauch“ */
export const verbrauchName = (p: "h1" | "h2", k: string) => (p === "h1" && k === "oel_l" ? "oelverbrauch" : `${p}_${k}`);
const verbrauchFields = (src: string, p: "h1" | "h2", label: string): FieldDef[] =>
  VERBRAUCH.flatMap((g) =>
    g.f.map(
      (x): FieldDef => ({
        n: verbrauchName(p, x.k),
        l: `${label}${x.l}`,
        t: "number",
        ph: x.ph,
        step: x.step,
        half: x.half,
        max: x.max,
        min: 0,
        hint: x.max ? `Aus der Jahresabrechnung · max. ${x.max.toLocaleString("de-DE")}` : "Aus der Jahresabrechnung",
        when: (q) => g.types.includes(str(q[src])),
      }),
    ),
  );

export const VQ_SECTIONS: VqSection[] = [
  { key:'eigentum', title:'Adresse & Eigentum', fields:[
    { n:'strasse', l:'Straße', t:'text', half:true }, { n:'hausnummer', l:'Hausnummer', t:'text', half:true },
    { n:'plz', l:'PLZ', t:'text', half:true, im:'numeric', max:5, check:(v) => (v && !/^\d{5}$/.test(v) ? '5 Ziffern' : '') }, { n:'ort', l:'Ort', t:'text', half:true },
    { n:'eigentuemer', l:'Im Grundbuch als Eigentümer eingetragen?', t:'radio', o:['Ja','Nein','Nein, aber verwandt'], ko:true },
    { n:'notar', l:'Notariell beglaubigte Urkunde oder Notartermin?', t:'radio', o:['Urkunde','Termin geplant','Nein'], when:(q) => isNo(q.eigentuemer) },
    { n:'zugriff_bilder', l:'Schon Zugriff aufs Haus für Bilder?', t:'radio', o:J_N, cols:true, when:(q) => isNo(q.eigentuemer) && ['Urkunde','Termin geplant'].includes(str(q.notar)) },
    { n:'zugriff_ab', l:'Ab wann Zugriff?', t:'date', half:true, when:(q) => isNo(q.eigentuemer) && q.zugriff_bilder === 'Nein' },
    { n:'zweiter_eigentuemer', l:'Zweiter Eigentümer?', t:'radio', o:J_N, cols:true },
    { n:'ze_anrede', l:'2. Eigentümer: Anrede', t:'radio', o:['Frau','Herr'], cols:true, when:(q) => q.zweiter_eigentuemer === 'Ja' },
    { n:'ze_vorname', l:'Vorname', t:'text', half:true, when:(q) => q.zweiter_eigentuemer === 'Ja' },
    { n:'ze_nachname', l:'Nachname', t:'text', half:true, when:(q) => q.zweiter_eigentuemer === 'Ja' },
    { n:'selbst_bewohnt', l:'Selbst bewohnt oder bald Einzug?', t:'radio', o:J_N, cols:true, ko:true },
  ]},
  { key:'gebaeude', title:'Gebäude', fields:[
    { n:'haustyp', l:'EFH oder MFH?', t:'radio', o:['EFH','MFH'], cols:true },
    { n:'gebaeudeart', l:'Gebäudeart', t:'radio', o:['Freistehend','Reihenendhaus','Reihenmittelhaus'], cols:true },
    { n:'geschosse', l:'Bewohnbare Geschosse', t:'radio', o:['1','2','3','4','4+'], cols:true },
    { n:'wohneinheiten', l:'Wohneinheiten', t:'radio', o:['1','2','3','4','5+'], cols:true },
    { n:'einheit2_separat', l:'Hat die 2. Einheit eigenen Eingang, Küche und Bad?', t:'radio', o:J_N, cols:true, when:(q) => !!q.wohneinheiten && q.wohneinheiten !== '1' },
    { n:'personen_haus', l:'Personen im Haus', t:'number', half:true, min:1, max:20, ph:'1–20' },
    { n:'personen_u18', l:'Davon unter 18', t:'radio', o:['0','1','2','3','4','5+'], cols:true },
    { n:'wohnflaeche', l:'Beheizbare Wohnfläche (m²)', t:'number', half:true, ph:'z. B. 140', heat:true, min:20, max:1000 },
    { n:'baujahr_haus', l:'Baujahr Haus', t:'number', half:true, ph:'1900–2027', heat:true, check:yr(1900, 2027) },
  ]},
  { key:'bau', title:'Baumaßnahmen', fields:[
    { n:'baumassnahmen', l:'Baumaßnahmen geplant?', t:'radio', o:J_N, cols:true },
    { n:'bm_welche', l:'Welche?', t:'check', o:['Anbau','Heizkörper bzw. Heizkreis','Fußbodenheizung','Dachdämmung','Fassadendämmung','Fenster','Andere'], when:(q) => q.baumassnahmen === 'Ja' },
    { n:'bm_anbau_m2', l:'Anbau: Wie viel m² kommen dazu?', t:'number', half:true, min:1, when:(q) => bmHas(q,'Anbau') },
    { n:'bm_heiz_geplant', l:'Anbau / Heizkörper / FBH: fertig geplant?', t:'radio', o:J_N, cols:true, when:(q) => bmHas(q,'Anbau','Heizkörper bzw. Heizkreis','Fußbodenheizung') },
    { n:'bm_heiz_datum', l:'Wann abgeschlossen?', t:'date', half:true, when:(q) => bmHas(q,'Anbau','Heizkörper bzw. Heizkreis','Fußbodenheizung') && q.bm_heiz_geplant === 'Ja' },
    { n:'bm_huelle_geplant', l:'Dämmung / Fenster: fertig geplant?', t:'radio', o:J_N, cols:true, when:(q) => bmHas(q,'Dachdämmung','Fassadendämmung','Fenster') },
    { n:'bm_huelle_datum', l:'Wann abgeschlossen?', t:'date', half:true, when:(q) => bmHas(q,'Dachdämmung','Fassadendämmung','Fenster') && q.bm_huelle_geplant === 'Ja' },
    { n:'bm_andere', l:'Andere: Welche?', t:'text', when:(q) => bmHas(q,'Andere') },
    { n:'bm_andere_heizraum', l:'Betrifft es den Heizraum oder den Zugang?', t:'radio', o:J_N, cols:true, when:(q) => bmHas(q,'Andere') },
  ]},
  { key:'daemmung', title:'Dämmung & Fenster', fields:[
    { n:'dach_gedaemmt', l:'Dach/Dachboden nachträglich gedämmt?', t:'radio', o:J_N, cols:true, heat:true },
    { n:'dach_daemmung_ort', l:'Wo?', t:'radio', o:['Oberste Geschossdecke','Dachschrägen','Beides','Weiß nicht'], cols:true, when:(q) => q.dach_gedaemmt === 'Ja' },
    { n:'dach_daemmung_art', l:'Art und Dicke der Dämmung', t:'text', half:true, ph:'z. B. 16 cm Mineralwolle', when:(q) => q.dach_gedaemmt === 'Ja' },
    { n:'dach_daemmung_jahr', l:'Jahr der Dämmung', t:'number', half:true, ph:'z. B. 2012', check:(v, q) => yr(1900, 2027)(v) || afterBj(v, q), when:(q) => q.dach_gedaemmt === 'Ja' },
    { n:'dachboden_wohnraum', l:'Dachboden als Wohnraum genutzt?', t:'radio', o:['Ja','Nein','Flachdach'], cols:true, when:(q) => q.dach_gedaemmt === 'Nein' && bjAlt(q) },
    { n:'dachboden_m2', l:'Wie viel m² hat der Dachboden?', t:'number', half:true, when:(q) => q.dach_gedaemmt === 'Nein' && bjAlt(q) && q.dachboden_wohnraum === 'Nein' },
    { n:'fassade_gedaemmt', l:'Fassade nachträglich gedämmt?', t:'radio', o:J_N, cols:true, heat:true },
    { n:'fassade_daemmung_art', l:'Art und Dicke der Dämmung', t:'text', half:true, ph:'z. B. 12 cm WDVS', when:(q) => q.fassade_gedaemmt === 'Ja' },
    { n:'fassade_daemmung_jahr', l:'Jahr der Dämmung', t:'number', half:true, ph:'z. B. 2015', check:(v, q) => yr(1900, 2027)(v) || afterBj(v, q), when:(q) => q.fassade_gedaemmt === 'Ja' },
    { n:'luftschicht', l:'Luftschicht zwischen Innen- und Außenwand?', t:'radio', o:['Ja','Nein','Weiß nicht'], cols:true, when:(q) => q.fassade_gedaemmt === 'Nein' && bjAlt(q) && plzNord(q) },
    { n:'haus_breite', l:'Ungefähre Breite des Hauses (m)', t:'number', half:true, when:(q) => q.fassade_gedaemmt === 'Nein' && bjAlt(q) && plzNord(q) && ['Ja','Weiß nicht'].includes(str(q.luftschicht)) },
    { n:'haus_laenge', l:'Ungefähre Länge des Hauses (m)', t:'number', half:true, when:(q) => q.fassade_gedaemmt === 'Nein' && bjAlt(q) && plzNord(q) && ['Ja','Weiß nicht'].includes(str(q.luftschicht)) },
    { n:'fenster', l:'Fenster', t:'radio', o:['Einfach','2-fach','2-fach Wärmeschutz','3-fach'], cols:true, heat:true },
  ]},
  { key:'heizung', title:'Heizung & Verbrauch', fields:[
    { n:'heizungsart', l:'Art der Heizung', t:'select', o:HEIZARTEN },
    ...verbrauchFields('heizungsart', 'h1', ''),
    { n:'heizungsart_2', l:'2. Heizung', t:'select', o:['Nicht vorhanden', ...HEIZARTEN], hint:'nur Wärmequellen, die die WP ersetzen soll' },
    ...verbrauchFields('heizungsart_2', 'h2', '2. Heizung: '),
    { n:'fw_gekuendigt', l:'Fernwärme: Vertrag schon gekündigt?', t:'radio', o:J_N, cols:true, when:fernwaerme },
    { n:'fw_ende', l:'Wann endet der Vertrag?', t:'date', half:true, when:fernwaerme },
    { n:'fw_versorger', l:'Welcher Versorger?', t:'text', half:true, when:fernwaerme },
    { n:'fw_station', l:'Wem gehört die Übergabestation?', t:'radio', o:['Kunde','Versorger'], cols:true, when:fernwaerme },
    { n:'heizraum', l:'Heizraum', t:'radio', o:['Keller','EG','1. OG','2. OG oder Dachboden'], cols:true },
    { n:'heizung_baujahr', l:'Baujahr Heizung', t:'number', half:true, ph:'z. B. 2001', check:yr(1950, 2027) },
    /* Grenze vorläufig 20 Jahre – in TMVT prüfen */
    { n:'heizung_inbetrieb', l:'Genaues Inbetriebnahmedatum', t:'date', half:true, hint:'Sonst gilt der 1. des Monats', when:(q) => !!+str(q.heizung_baujahr) && +str(q.heizung_baujahr) <= 2006 },
    { n:'heizung_funktionstuechtig', l:'Heizung funktionstüchtig?', t:'radio', o:J_N, cols:true },
    { n:'heizverteilung', l:'Wärmeverteilung', t:'radio', o:['Heizkörper','Fußbodenheizung','Beides','Weder noch'], cols:true },
    { n:'warmwasser', l:'Warmwasser über die Heizung?', t:'radio', o:['Ja','Nein','Nein, künftig über WP'], cols:true },
    { n:'dle', l:'Durchlauferhitzer?', t:'radio', o:['Nein','Ja, soll durch Speicher ersetzt werden','Ja, soll bleiben'], when:(q) => !!q.warmwasser && q.warmwasser !== 'Ja' },
    { n:'dle_ort', l:'Wo steht der Durchlauferhitzer?', t:'radio', o:['Im oder neben dem Heizraum','Mind. ein Zimmer entfernt'], when:(q) => !!q.warmwasser && q.warmwasser !== 'Ja' && q.dle === 'Ja, soll durch Speicher ersetzt werden' },
    { n:'solarthermie', l:'Solarthermie?', t:'radio', o:['Nein','Ja, nur Warmwasser','Ja, Warmwasser + Heizung','Ja, defekt','Weiß nicht'], cols:true },
    { n:'solar_groesse', l:'Größe der Solarthermie', t:'radio', o:['Bis 8 m²','Größer, Kunde reduziert','Größer, Kunde reduziert nicht'], when:(q) => /^Ja/.test(str(q.solarthermie)) },
    { n:'wasserg_kamin', l:'Wassergeführter Kamin?', t:'radio', o:J_N, cols:true },
  ]},
  { key:'energie', title:'Energiekosten & PV', fields:[
    { n:'energiekosten_heizung', l:'Energiekosten Heizung (ct/kWh)', t:'number', half:true, step:'0.1', ph:'5–25', check:(v) => (v !== '' && (+v < 5 || +v > 25) ? 'TMVT erlaubt nur 5–25 ct' : '') },
    { n:'stromkosten', l:'Stromkosten (ct/kWh)', t:'number', half:true, step:'0.1', ph:'20–50', check:(v) => (v !== '' && (+v < 20 || +v > 50) ? 'TMVT erlaubt nur 20–50 ct' : '') },
    { n:'pv_anlage', l:'PV-Anlage?', t:'radio', o:['Ja, Enpal','Ja, Drittanbieter','Nein'], cols:true },
    { n:'pv_nutzung', l:'Strom selbst genutzt oder voll eingespeist?', t:'radio', o:['Selbst genutzt','Voll eingespeist'], cols:true, when:(q) => q.pv_anlage === 'Ja, Drittanbieter' },
  ]},
  /* Einkommen bewusst zuletzt – erst wenn Vertrauen da ist */
  { key:'abschluss', title:'Zum Schluss', fields:[
    { n:'smartphone', l:'Smartphone vorhanden?', t:'radio', o:J_N, cols:true },
    { n:'haushaltseinkommen', l:'Brutto-Haushaltseinkommen pro Jahr', t:'radio', o:['unter 30.000 €','30.000–40.000 €','40.000–50.000 €','50.000–60.000 €','über 60.000 €'], cols:true, sensitive:true,
      say:'„Für die staatliche Förderung fragt der Hersteller grob das Haushaltseinkommen ab. Welche Spanne passt bei Ihnen?“', when:(q) => q.selbst_bewohnt === 'Ja' },
  ]},
];

export const VQ_FIELDS: Record<string, FieldDef> = Object.fromEntries(VQ_SECTIONS.flatMap((s) => s.fields.map((f) => [f.n, f])));

/** Antworten aus der Zeit vor TMVT (bisheriges Formular, Pipedrive „VQ …“) auf die heutigen Optionen übersetzen */
const LEGACY: Record<string, Record<string, string>> = {
  fenster: { Einfachverglasung: "Einfach", "2 Scheibenglas": "2-fach", "2 Scheiben Wärmeschutzglas": "2-fach Wärmeschutz", "3 Scheibenglas oder 3 Scheiben Wärmeschutzglas": "3-fach" },
  heizungsart: { "Strom (Nachtspeicher)": "Nachtspeicher", "Holz/Pellets": "Pellet" },
  heizungsart_2: { Keine: "Nicht vorhanden", "Strom (Nachtspeicher)": "Nachtspeicher", "Holz/Pellets": "Pellet" },
  heizraum: { Erdgeschoss: "EG", Dachboden: "2. OG oder Dachboden" },
  heizverteilung: { "Weder Noch": "Weder noch" },
  warmwasser: { "Nein, aber künftig über die Wärmepumpe": "Nein, künftig über WP" },
  pv_anlage: { "Ja, von Enpal": "Ja, Enpal", "Ja, von einem Drittanbieter": "Ja, Drittanbieter" },
  gebaeudeart: { Doppelhaushälfte: "Reihenendhaus" },
  geschosse: { "5+": "4+" },
  haushaltseinkommen: { "Unter 30.000 €": "unter 30.000 €", "Über 60.000 €": "über 60.000 €" },
};
export function normalizeVq<T extends FormValues>(vq: T): T {
  const out: FormValues = { ...vq };
  for (const [k, m] of Object.entries(LEGACY)) {
    const v = out[k];
    if (typeof v === "string" && m[v]) out[k] = m[v];
  }
  return out as T;
}

/** Alte Antwort (vor TMVT), die zu keiner heutigen Option passt – sonst "" */
export const legacyValue = (f: FieldDef, v: unknown) => ((f.t === "radio" || f.t === "select") && typeof v === "string" && v && !f.o!.includes(v) ? v : "");

/** Feld sichtbar? (Folgefragen) */
export const fieldVisible = (f: FieldDef, v: FormValues) => !f.when || f.when(v);

/** Prüfung wie TMVT: min/max/check – liefert Fehlertext oder "" */
export function vqCheck(f: FieldDef, q: FormValues): string {
  const v = q[f.n];
  if (!isAnswered(v) || Array.isArray(v)) return "";
  const s = String(v).trim();
  if (f.check) {
    const m = f.check(s, q);
    if (m) return m;
  }
  if (f.t === "number" && f.max !== undefined && +s > f.max) return `Maximal ${f.max.toLocaleString("de-DE")}`;
  if (f.t === "number" && f.min !== undefined && +s < f.min) return `Mindestens ${f.min}`;
  return "";
}
/** Sichtbare Felder mit Werten außerhalb der TMVT-Grenzen */
export const vqErrors = (q: FormValues) => VQ_SECTIONS.flatMap((s) => s.fields).filter((f) => fieldVisible(f, q) && vqCheck(f, q));
/** K.-o.: kein Eigentümer und auch keine notarielle Urkunde/Termin – oder nicht selbst bewohnt */
export const vqKo = (q: FormValues) => (isNo(q.eigentuemer) && q.notar === "Nein") || q.selbst_bewohnt === "Nein";

/** Verbrauch in Klartext, z. B. „2.200 l Öl“ (p = h1 oder h2) */
export function verbrauchText(q: FormValues, p: "h1" | "h2" = "h1") {
  const v = (k: string) => str(q[verbrauchName(p, k)]);
  const n = (x: string) => (+x).toLocaleString("de-DE");
  if (v("oel_l")) return `${n(v("oel_l"))} l Öl`;
  if (v("kwh")) return `${n(v("kwh"))} kWh`;
  if (v("t")) return `${n(v("t"))} t`;
  if (v("wp_kwh")) return `${n(v("wp_kwh"))} kWh Strom${v("jaz") ? ` · JAZ ${v("jaz")}` : ""}`;
  if (v("strom_kwh")) return `${n(v("strom_kwh"))} kWh Strom`;
  if (v("rm")) return `${n(v("rm"))} rm Holz`;
  if (v("steinkohle_kg") || v("braunkohle_kg")) return `${n(String(+v("steinkohle_kg") + +v("braunkohle_kg")))} kg Kohle`;
  return "";
}

/* Lead erfassen, Schritt 1 – Felder wie im bestehenden Setting-Formular */
export const STEP1 = {
  notizen:{ n:'notizen', l:'Alles, was der Innendienst zum Termin wissen sollte', t:'textarea', ph:'z. B. Gastherme 20 Jahre alt, Ehefrau entscheidet mit, Hund im Garten' },
  alle_entscheider:{ n:'alle_entscheider', l:'Sind alle Entscheider beim Termin dabei?', t:'radio', o:['Ja, alle Entscheider sind dabei','Nein, nicht alle dabei'] },
  rueckruf_datum:{ n:'rueckruf_datum', l:'Wann soll der Kunde angerufen werden?', t:'radio', o:['Heute','Morgen','wann anders'], cols:true },
  rueckruf_uhrzeit:{ n:'rueckruf_uhrzeit', l:'Genaue Uhrzeit falls vereinbart', t:'time', half:true },
  zeitfenster:{ n:'zeitfenster', l:'Erreichbarkeit', t:'check', o:ZEITFENSTER, cols:true },
  anrede:{ n:'anrede', l:'Anrede', t:'radio', o:['Frau','Herr'], cols:true },
  vorname:{ n:'vorname', l:'Vorname', t:'text', req:true, half:true, ac:'off' },
  nachname:{ n:'nachname', l:'Nachname', t:'text', req:true, half:true, ac:'off' },
  telefon:{ n:'telefon', l:'Telefon', t:'tel', req:true, half:true, im:'tel', ph:'0170 1234567' },
  email:{ n:'email', l:'E-Mail', t:'email', req:true, half:true, ph:'name@beispiel.de' },
  strasse:{ n:'strasse', l:'Straße', t:'text', req:true, half:true },
  hausnummer:{ n:'hausnummer', l:'Hausnummer', t:'text', req:true, half:true },
  plz:{ n:'plz', l:'Postleitzahl', t:'text', req:true, half:true, im:'numeric', max:5, ph:'5 Ziffern' },
  stadt:{ n:'stadt', l:'Stadt', t:'text', req:true, half:true },
} satisfies Record<string, FieldDef>;

/** Beantwortete / sichtbare Fragen der Vorqualifizierung */
export function vqProgress(vq: FormValues) {
  let total = 0,
    done = 0;
  for (const s of VQ_SECTIONS)
    for (const f of s.fields) {
      if (!fieldVisible(f, vq)) continue;
      total++;
      if (isAnswered(vq[f.n])) done++;
    }
  return { total, done, errors: vqErrors(vq).length };
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
    verbrauchText(vq) && `${verbrauchText(vq)}/Jahr`,
    s("heizverteilung"),
    s("pv_anlage") && `PV: ${s("pv_anlage")}`,
    s("eigentuemer") && `Eigentümer: ${s("eigentuemer")}`,
    h && `Heizlast ≈ ${h.toLocaleString("de-DE")} kW`,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Alle beantworteten, sichtbaren Fragen als Text („Abschnitt / Frage: Antwort“ je Zeile) – für Pipedrive und Notizen */
export function vqText(vq: FormValues) {
  const lines: string[] = [];
  for (const s of VQ_SECTIONS) {
    const rows = s.fields.filter((f) => fieldVisible(f, vq) && isAnswered(vq[f.n])).map((f) => `${f.l}: ${str(vq[f.n])}`);
    if (rows.length) lines.push(`— ${s.title} —`, ...rows);
  }
  return lines.join("\n");
}

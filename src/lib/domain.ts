/* Geschäftsregeln des MB-Dashboards: Pipeline-Status, Provisionssätze, Gründe,
   Leitfäden. Diese Werte bleiben, wenn die Beispieldaten durch echte Daten ersetzt werden.
   Alle Beträge und Sätze sind noch Beispielwerte und müssen fachlich bestätigt werden. */

import type { CallGuide, PayoutStatusKey, ProductKey, Role, StatusDef, StatusKey, Tone } from "./types";

/* Das Tool ist vorerst nur auf Wärmepumpen ausgelegt */
export const PRODUCTS: Record<ProductKey, { label: string; short: string }> = {
  wp: { label:'Wärmepumpe', short:'WP' },
};

/* Pipeline (5 Stufen): Lead eingereicht → Termin gelegt → In den Checks → Verkauf → Ausgezahlt
   „Lead eingereicht“ umfasst auch die Bearbeitung durch den Presetter (Anrufversuche, vereinbarte Rückrufe)
   Ausstieg mit Pflichtgrund: Abgesagt (vor dem Termin) bzw. Verloren (nach dem Termin) */
export const STATUS: Record<StatusKey, StatusDef> = {
  eingereicht:    { label:'Lead eingereicht',     stage:1, tone:'set',     step:1 }, /* neu oder in Bearbeitung beim Presetter */
  termin:         { label:'Termin gelegt',        stage:2, tone:'term',    step:3 },
  checks:         { label:'In den Checks',        stage:3, tone:'closing', step:4 },
  ausgezahlt:     { label:'Ausgezahlt',           stage:5, tone:'paid',    step:6 }, /* Provision ist beim MB angekommen */
  verkauft:       { label:'Verkauf',             stage:4, tone:'done',    step:5 },
  abgesagt:       { label:'Abgesagt',             stage:1, tone:'bad',     fail:true, phase:'vor dem Termin' },
  verloren:       { label:'Verloren',             stage:3, tone:'bad',     fail:true, phase:'nach dem Termin' },
};
export const PIPELINE: StatusKey[] = ['eingereicht','termin','checks','verkauft','ausgezahlt'];

/* Pflicht-Rückmeldung des Closers nach jedem Termin */
export const FEEDBACK_FRIST_H: number = 24; /* Stunden nach Terminende; danach werden die Slots des Closers für neue Leads pausiert */
export const FEEDBACK_OPTIONS: Record<"erst" | "closing", [string, string][]> = {
  erst:    [['checks','Ersttermin fand statt – Kunde in den Checks'],['nicht_angetroffen','Kunde nicht angetroffen'],['verloren','Verloren']],
  closing: [['verkauft','Verkauft'],['entscheidung','Kunde entscheidet noch'],['verloren','Verloren']],
};

export const PAYOUT_STATUS: Record<PayoutStatusKey, { label: string; tone: Tone }> = { pruefung:{label:'In Prüfung',tone:'warn'}, freigegeben:{label:'Freigegeben',tone:'info'}, ausgezahlt:{label:'Ausgezahlt',tone:'ok'} };

export const CONTRACT_TEMPLATES: string[] = ['Handelsvertretervertrag (§ 84 HGB)','Provisionsvereinbarung 2026','Vertraulichkeits- & Datenschutzvereinbarung','Teilnahmebedingungen Wärmepumpen-Cup'];

/* Telefonleitfaden je Produkt */
export const GUIDES: Record<ProductKey, CallGuide> = {
  wp:{ intro:'Guten Tag {anrede}, hier ist {me} von EnergyEngel. Sie hatten mit {setter} an der Tür über eine Wärmepumpe gesprochen – passt es gerade für fünf Minuten?',
    questions:['Baujahr des Hauses','Aktuelle Heizung und deren Alter','Wohnfläche (m²)','Jahresverbrauch (kWh Gas bzw. Liter Öl)','Heizkörper oder Fußbodenheizung?','Sind Sie Eigentümer/in?','Interesse an der KfW-Förderung (Heizungsförderung)?'],
    objections:[['„Das ist mir zu teuer.“','Die Heizungsförderung der KfW übernimmt je nach Situation einen großen Teil der Kosten. Beim Vor-Ort-Termin rechnen wir Ihre konkrete Förderhöhe und die Einsparung gegenüber Gas/Öl durch.'],['„Funktioniert das in meinem Altbau?“','Entscheidend ist die nötige Vorlauftemperatur. Genau das prüft unser Energieberater vor Ort – oft reicht es, einzelne Heizkörper zu tauschen.'],['„Ich habe gerade keine Zeit.“','Verstehe ich. Der Termin dauert etwa 45 Minuten bei Ihnen zu Hause. Wann passt es Ihnen besser – unter der Woche oder am Samstag?']],
    close:'Dann schlage ich vor, dass unser Energieberater {closer} einmal bei Ihnen vorbeikommt. Passt Ihnen eher {slot1} oder {slot2}?' },
};

/* Gründe (Pflichtfeld bei Abgesagt / Verloren) */
export const LOSS_REASONS: Record<"abgesagt" | "verloren", string[]> = {
  abgesagt:['Kein Eigentümer','Kein Interesse mehr','Technisch nicht machbar','Hat schon einen Anbieter','Nicht förderfähig','Falsche Kontaktdaten','Sonstiges'],
  verloren:['Zu teuer','Bedenkzeit, kein Rückruf','Anderer Anbieter','Finanzierung abgelehnt','Technisch nicht machbar','Kunde nicht erschienen','Sonstiges'],
};

/* Provisionssätze (Beispiel) je Rolle und Produkt */
export const PROV: { setter: { abschluss: number }; presetter: { termin: number }; closer: { abschluss: number } } = {
  setter:   { abschluss:1000 }, /* je verkauftem Lead */
  presetter:{ termin:250 },   /* je Termin, den der Presetter für den Closer legt */
  closer:   { abschluss:1000 }, /* je verkauftem Lead */
};
/** Widerrufsfrist der Kunden in Tagen – so lange ist eine Provision vorläufig */
export const WIDERRUF_TAGE: number = 14;

/** Rollen, die sich im Dashboard anmelden können */
export const ROLES: Role[] = ["setter", "presetter", "closer", "admin"];

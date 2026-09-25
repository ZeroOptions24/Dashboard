/* =====================================================================
   BEISPIELDATEN – alle Namen, Adressen, Beträge und IDs sind erfunden.
   Im echten Betrieb kommen Leads/Status aus Pipedrive, Verträge aus
   DocuSign, Stammdaten aus der eigenen Datenbank; Automatisierungen
   (Benachrichtigungen, WhatsApp) laufen über n8n.
   createDemoData() liefert bei jedem Aufruf einen frischen, veränderbaren
   Satz Daten – dieselbe Form, die später die echte Datenquelle liefert.
   ===================================================================== */

import type {
  Appointment, Board, BoardArchiveEntry, Contract, Lead, MbStats, Notification,
  Payout, Person, PersonKey, Profile, Role, Slot, TeamEvent, TeamMember,
} from "./types";

/** Lead, wie er erfasst wird – Bearbeitungsfelder werden beim Laden ergänzt. */
type LeadSeed = Omit<Lead, "attempts" | "nextTry" | "reason" | "reasonNote" | "eigenlead">;

export function createDemoData() {
  const NOW: Date = new Date(2026, 8, 23, 14, 5); // Mi, 23.09.2026 14:05 (fixe Prototyp-Zeit)

  const PEOPLE: Record<PersonKey, Person> = {
    romy:    { key:'romy',    name:'Romy Krause',     first:'Romy',    role:'setter',    initials:'RK' },
    inan:    { key:'inan',    name:'Inan Yıldız',     first:'Inan',    role:'presetter', initials:'IY' },
    leo:     { key:'leo',     name:'Leo Hartmann',    first:'Leo',     role:'closer',    initials:'LH' },
    tim:     { key:'tim',     name:'Tim Jochmann',    first:'Tim',     role:'admin',     initials:'TJ' },
    lara:    { key:'lara',    name:'Lara Möbius',     first:'Lara',    role:'setter',    initials:'LM' },
    eric:    { key:'eric',    name:'Eric Sommer',     first:'Eric',    role:'setter',    initials:'ES' },
    ugur:    { key:'ugur',    name:'Uğur Demir',      first:'Ugur',    role:'setter',    initials:'UD' },
    florian: { key:'florian', name:'Florian Reichel', first:'Florian', role:'setter',    initials:'FR' },
    daniel:  { key:'daniel',  name:'Daniel Fuchs',    first:'Daniel',  role:'presetter', initials:'DF' },
  };

  /* Wer ist in welcher Rolle eingeloggt (Prototyp) */
  const ROLE_USER: Record<Role, PersonKey> = { setter:'romy', presetter:'inan', closer:'leo', admin:'tim' };

  const LEADS_RAW: LeadSeed[] = [
    { id:'L-2418', pd:48213, kunde:'Familie Brandt', anrede:'Frau Brandt', tel:'0176 •••• 4412', ort:'Leipzig-Gohlis', produkt:'wp', status:'termin', setter:'romy', presetter:'inan', closer:'leo', datum:'15.09.2026',
      setNote:'EFH Bj. 1994, Gasheizung 18 Jahre alt, beide Eigentümer zuhause angetroffen.',
      preNote:'145 m² Wohnfläche, ca. 21.000 kWh Gas/Jahr, Heizkörper (Vorlauf ~55 °C), Interesse an KfW-Förderung.',
      hist:[['Termin gelegt','23.09. 11:40'],['Lead eingereicht','15.09. 18:47']] },
    { id:'L-2422', pd:48230, kunde:'Sabine Weigel', anrede:'Frau Weigel', tel:'0157 •••• 0983', ort:'Markkleeberg', produkt:'wp', status:'eingereicht', setter:'romy', presetter:'inan', datum:'16.09.2026',
      setNote:'Reihenendhaus, Gastherme Bj. 2003, will weg vom Gas.', preNote:'110 m², 14.000 kWh Gas, Heizkörper, Eigentümerin.',
      hist:[['Lead eingereicht','16.09. 17:30']] },
    { id:'L-2425', pd:48241, kunde:'Jörg & Anke Lindner', anrede:'Herr Lindner', tel:'0172 •••• 7730', ort:'Taucha', produkt:'wp', status:'verkauft', setter:'romy', presetter:'inan', closer:'leo', datum:'05.09.2026',
      setNote:'Ölheizung, Tank muss 2027 raus.', preNote:'160 m², 2.600 l Heizöl/Jahr, Fußbodenheizung EG.',
      hist:[['Verkauf','20.09. 13:15'],['Termin gelegt','12.09. 09:40'],['Lead eingereicht','05.09. 19:05']] },
    { id:'L-2431', pd:48266, kunde:'Heike Pohl', anrede:'Frau Pohl', tel:'0341 •••• 8821', ort:'Schkeuditz', produkt:'wp', status:'eingereicht', setter:'romy', presetter:'inan', datum:'18.09.2026',
      setNote:'Hat seit 2014 PV (7,2 kWp), Ölheizung 22 Jahre alt.', preNote:'Rückruf gewünscht, Ehemann soll dabei sein.',
      hist:[['Lead eingereicht','18.09. 16:22']] },
    { id:'L-2433', pd:48271, kunde:'Familie Nguyen', anrede:'Herr Nguyen', tel:'0176 •••• 2291', ort:'Leipzig-Paunsdorf', produkt:'wp', status:'eingereicht', setter:'romy', presetter:'inan', datum:'19.09.2026',
      setNote:'Doppelhaushälfte, Gasheizung, abends ab 18 Uhr erreichbar.', preNote:'2 Versuche (Mo 10:15, Di 17:40) – nächster Versuch Do ab 18 Uhr.',
      hist:[['Nicht erreicht','22.09. 17:40'],['Lead eingereicht','19.09. 18:55']] },
    { id:'L-2437', pd:48288, kunde:'Ralf Seidel', anrede:'Herr Seidel', tel:'0160 •••• 5178', ort:'Markranstädt', produkt:'wp', status:'eingereicht', setter:'romy', presetter:'inan', datum:'22.09.2026',
      setNote:'Gastherme defekt, sucht schnell Lösung.', preNote:'',
      hist:[['Lead eingereicht','22.09. 19:12']] },
    { id:'L-2440', pd:null, kunde:'Monika Franke', anrede:'Frau Franke', tel:'0152 •••• 6604', ort:'Borsdorf', produkt:'wp', status:'eingereicht', setter:'romy', datum:'23.09.2026',
      setNote:'Nachtspeicheröfen, hohe Stromkosten.', preNote:'', hist:[['Lead eingereicht','23.09. 10:31']] },
    { id:'L-2441', pd:48297, kunde:'Uwe Köhler', anrede:'Herr Köhler', tel:'0171 •••• 3319', ort:'Leipzig-Connewitz', produkt:'wp', status:'abgesagt', setter:'romy', presetter:'inan', datum:'10.09.2026',
      setNote:'Mehrfamilienhaus, 3 Parteien.', preNote:'Kein Eigentümer – Vermieter nicht interessiert.',
      hist:[['Abgesagt','12.09. 11:05'],['Lead eingereicht','10.09. 17:15']] },
    { id:'L-2444', pd:48305, kunde:'Familie Richter', anrede:'Frau Richter', tel:'0151 •••• 9045', ort:'Zwenkau', produkt:'wp', status:'termin', setter:'romy', presetter:'inan', closer:'leo', datum:'17.09.2026',
      setNote:'Neubau 2004, Gasbrennwert, hohe Abschläge.', preNote:'180 m², 24.000 kWh Gas, Fußbodenheizung komplett – sehr gute Voraussetzungen.',
      hist:[['Termin gelegt','22.09. 09:30'],['Lead eingereicht','17.09. 18:02']] },
    { id:'L-2446', pd:48311, kunde:'Dana Schubert', anrede:'Frau Schubert', tel:'0177 •••• 1180', ort:'Grimma', produkt:'wp', status:'verloren', setter:'romy', presetter:'inan', closer:'leo', datum:'02.09.2026',
      setNote:'EFH mit Anbau, Gasheizung 25 Jahre alt.', preNote:'125 m², 19.000 kWh Gas, Budget knapp.',
      hist:[['Verloren','16.09. 15:00'],['Termin gelegt','08.09. 12:00'],['Lead eingereicht','02.09. 16:40']] },
    { id:'L-2449', pd:null, kunde:'Thomas Krüger', anrede:'Herr Krüger', tel:'0163 •••• 7452', ort:'Leipzig-Plagwitz', produkt:'wp', status:'eingereicht', setter:'romy', datum:'23.09.2026',
      setNote:'Gasheizung Bj. 1999, Balkonkraftwerk vorhanden.', preNote:'', hist:[['Lead eingereicht','23.09. 12:48']] },
    { id:'L-2410', pd:48170, kunde:'Familie Keller', anrede:'Frau Keller', tel:'0341 •••• 2290', ort:'Leipzig-Holzhausen', produkt:'wp', status:'verkauft', setter:'romy', presetter:'inan', closer:'leo', datum:'25.08.2026',
      setNote:'EFH 1979, Ölheizung 30 Jahre alt.', preNote:'150 m², 2.400 l Öl/Jahr.', hist:[['Verkauf','04.09. 16:20'],['Termin gelegt','28.08. 11:00'],['Lead eingereicht','25.08. 17:40']] },
    { id:'L-2398', pd:48102, kunde:'Familie Schröder', anrede:'Herr Schröder', tel:'0177 •••• 5521', ort:'Leipzig-Stötteritz', produkt:'wp', status:'ausgezahlt', setter:'romy', presetter:'inan', closer:'leo', datum:'04.08.2026',
      setNote:'DHH, Gasheizung Bj. 1998.', preNote:'120 m², 16.000 kWh Gas.', hist:[['Ausgezahlt','15.09. 09:00'],['Verkauf','14.08. 15:10'],['Termin gelegt','08.08. 10:00'],['Lead eingereicht','04.08. 18:20']] },
    /* Leads anderer Setter (für Admin/Closer/Presetter) */
    { id:'L-2419', pd:48220, kunde:'Familie Wagner', anrede:'Herr Wagner', tel:'0174 •••• 3056', ort:'Delitzsch', produkt:'wp', status:'checks', setter:'lara', presetter:'daniel', closer:'leo', datum:'14.09.2026',
      setNote:'Altbau saniert 2018.', preNote:'130 m², 17.500 kWh Gas.', hist:[['Ersttermin fand statt – in den Checks, 2. Termin am 22.09.','19.09. 12:00'],['Termin gelegt','17.09. 11:10'],['Lead eingereicht','14.09. 17:20']] },
    { id:'L-2420', pd:48224, kunde:'Petra Hoffmann', anrede:'Frau Hoffmann', tel:'0341 •••• 4410', ort:'Leipzig-Schönefeld', produkt:'wp', status:'verkauft', setter:'lara', presetter:'daniel', closer:'leo', datum:'08.09.2026',
      setNote:'', preNote:'', hist:[['Verkauf','19.09. 17:00'],['Lead eingereicht','08.09. 18:00']] },
    { id:'L-2427', pd:48250, kunde:'Familie Zimmermann', anrede:'Herr Zimmermann', tel:'0176 •••• 8830', ort:'Naunhof', produkt:'wp', status:'termin', setter:'lara', presetter:'inan', closer:'leo', datum:'16.09.2026',
      setNote:'EFH 1988, Nachtspeicheröfen.', preNote:'120 m², Stromheizung ~14.000 kWh, großes Einsparpotenzial.', hist:[['Termin gelegt','21.09. 10:00'],['Lead eingereicht','16.09. 19:00']] },
    { id:'L-2435', pd:48275, kunde:'Klaus Werner', anrede:'Herr Werner', tel:'0162 •••• 2217', ort:'Eilenburg', produkt:'wp', status:'eingereicht', setter:'lara', presetter:'daniel', datum:'18.09.2026',
      setNote:'', preNote:'140 m², 2.000 l Öl/Jahr.', hist:[['Lead eingereicht','18.09. 18:30']] },
    { id:'L-2429', pd:48258, kunde:'Marion Schulze', anrede:'Frau Schulze', tel:'0157 •••• 6612', ort:'Leipzig-Lindenau', produkt:'wp', status:'eingereicht', setter:'eric', presetter:'inan', datum:'21.09.2026',
      setNote:'Gasheizung, Abschlag 240 €/Monat, will wechseln.', preNote:'', hist:[['Lead eingereicht','21.09. 17:45']] },
    { id:'L-2448', pd:48320, kunde:'Familie Becker', anrede:'Herr Becker', tel:'0173 •••• 9921', ort:'Machern', produkt:'wp', status:'termin', setter:'eric', presetter:'inan', closer:'leo', datum:'19.09.2026',
      setNote:'Holz-/Ölkombi, will weg vom Öl.', preNote:'170 m², 2.100 l Öl + Kamin.', hist:[['Termin gelegt','23.09. 09:15'],['Lead eingereicht','19.09. 16:10']] },
    { id:'L-2439', pd:48292, kunde:'Steffen Lorenz', anrede:'Herr Lorenz', tel:'0170 •••• 1348', ort:'Wurzen', produkt:'wp', status:'eingereicht', setter:'ugur', presetter:'inan', datum:'20.09.2026',
      setNote:'', preNote:'Möchte Unterlagen per Mail.', hist:[['Lead eingereicht','20.09. 18:15']] },
    { id:'L-2447', pd:null, kunde:'Andrea Kaiser', anrede:'Frau Kaiser', tel:'0152 •••• 7781', ort:'Leipzig-Möckern', produkt:'wp', status:'eingereicht', setter:'florian', datum:'18.09.2026',
      setNote:'', preNote:'', hist:[['Lead eingereicht','18.09. 09:02']] },
  ];

  /* ---------- Erweiterungen Runde 2 ---------- */
  /* Anrufversuche, nächster Versuch, Verlustgrund */
  const LEAD_EXTRA: Record<string, Partial<Lead>> = {
    'L-2433':{ attempts:2, nextTry:'Do 24.09. ab 18:00' },
    'L-2431':{ attempts:1, nextTry:'Rückruf heute 18:00' }, 'L-2439':{ attempts:1, nextTry:'Rückruf Fr 25.09. vormittags' },
    'L-2422':{ attempts:1, nextTry:'Rückruf heute 12:30' }, 'L-2435':{ attempts:1, nextTry:'Rückruf Do 24.09. 17:00' },
    'L-2441':{ reason:'Kein Eigentümer', reasonNote:'Vermieter nicht interessiert.' },
    'L-2446':{ reason:'Zu teuer', reasonNote:'Budget reicht auch mit Förderung nicht.' },
  };
  /* Kundeninfos aus Setting/Vorqualifizierung (Feldnamen wie im Formular wp-vorqual) */
  const LEAD_VQ: Record<string, Partial<Lead>> = {
    'L-2418':{ entscheider:'Ja, alle Entscheider sind dabei', vq:{ wohnflaeche:'145', baujahr_haus:'1994', heizungsart:'Gas', heizung_baujahr:'2006', heizverteilung:'Heizkörper', eigentuemer:'Ja', dach_gedaemmt:'Ja', fenster:'2 Scheiben Wärmeschutzglas' } },
    'L-2444':{ entscheider:'Ja, alle Entscheider sind dabei', vq:{ wohnflaeche:'180', baujahr_haus:'2004', heizungsart:'Gas', heizung_baujahr:'2004', heizverteilung:'Fußbodenheizung', eigentuemer:'Ja', fenster:'3 Scheibenglas oder 3 Scheiben Wärmeschutzglas' } },
    'L-2448':{ entscheider:'Nein, nicht alle dabei', vq:{ wohnflaeche:'170', baujahr_haus:'1978', heizungsart:'Öl', heizung_baujahr:'1998', heizungsart_2:'Holz/Pellets', heizverteilung:'Beides', eigentuemer:'Ja' } },
    'L-2427':{ entscheider:'Ja, alle Entscheider sind dabei', vq:{ wohnflaeche:'120', baujahr_haus:'1988', heizungsart:'Strom (Nachtspeicher)', heizung_baujahr:'1988', heizverteilung:'Heizkörper', eigentuemer:'Ja' } },
    'L-2419':{ entscheider:'Ja, alle Entscheider sind dabei', vq:{ wohnflaeche:'130', baujahr_haus:'1965', heizungsart:'Gas', heizung_baujahr:'2001', heizverteilung:'Heizkörper', eigentuemer:'Ja', fassade_gedaemmt:'Ja' } },
  };
  const LEADS: Lead[] = LEADS_RAW.map(l => ({ attempts:0, nextTry:null, reason:null, reasonNote:'', eigenlead:true, ...l, ...(LEAD_EXTRA[l.id] || {}), ...(LEAD_VQ[l.id] || {}) }));

  /* Closer-Kalender: Termine (fest) und freie Slots (vom Closer eingetragen) */
  /* kind: 'erst' = Ersttermin (vom Presetter gelegt), 'closing' = 2. Termin (Verkauf). feedback: Rückmeldung des Closers (Pflicht nach jedem Termin) */
  const APPTS: Appointment[] = [
    { id:'T-500', lead:'L-2419', closer:'leo', kind:'erst',    date:'2026-09-18', start:10, dur:1.5, adr:'Eilenburger Str. 14, 04509 Delitzsch', ort:'Delitzsch', feedback:{ result:'checks', at:'18.09. 12:05' } },
    { id:'T-501', lead:'L-2419', closer:'leo', kind:'closing', date:'2026-09-22', start:14, dur:1.5, adr:'Eilenburger Str. 14, 04509 Delitzsch', ort:'Delitzsch', feedback:null },
    { id:'T-502', lead:'L-2427', closer:'leo', kind:'erst',    date:'2026-09-23', start:10, dur:1.5, adr:'Lindenstr. 7, 04683 Naunhof', ort:'Naunhof', feedback:null },
    { id:'T-503', lead:'L-2418', closer:'leo', kind:'erst',    date:'2026-09-24', start:10, dur:1.5, adr:'Landsberger Str. 52, 04157 Leipzig', ort:'Leipzig-Gohlis', feedback:null },
    { id:'T-504', lead:'L-2444', closer:'leo', kind:'erst',    date:'2026-09-25', start:15, dur:1.5, adr:'Seestr. 3, 04442 Zwenkau', ort:'Zwenkau', feedback:null },
    { id:'T-505', lead:'L-2448', closer:'leo', kind:'erst',    date:'2026-09-26', start:11, dur:1.5, adr:'Brandiser Str. 21, 04827 Machern', ort:'Machern', feedback:null },
  ];
  const SLOTS: Slot[] = [
    { id:'S-1', closer:'leo', date:'2026-09-24', start:14 }, { id:'S-2', closer:'leo', date:'2026-09-24', start:16 },
    { id:'S-3', closer:'leo', date:'2026-09-25', start:10 }, { id:'S-4', closer:'leo', date:'2026-09-25', start:11 },
    { id:'S-5', closer:'leo', date:'2026-09-26', start:14 }, { id:'S-6', closer:'leo', date:'2026-09-28', start:9 },
    { id:'S-7', closer:'leo', date:'2026-09-28', start:17 },
  ];

  /* Auszahlungen je Person (Abrechnung monatlich, Auszahlung zum 15. des Folgemonats) */
  const PAYOUTS: Record<PersonKey, Payout[]> = {
    romy:[
      { id:'AZ-2609-RK', periode:'September 2026', betrag:1000, status:'pruefung', datum:'15.10.2026', posten:[
        ['20.09.','Jörg & Anke Lindner','Verkauf Wärmepumpe',1000,'vorlaeufig:04.10.'],['04.09.','Familie Keller','Verkauf Wärmepumpe',1000,'fest'],['14.09.','Familie Meier (Abschluss August)','Kunde hat innerhalb der Frist widerrufen',-1000,'storno']] },
      { id:'AZ-2608-RK', periode:'August 2026', betrag:2000, status:'ausgezahlt', datum:'15.09.2026', posten:[] },
      { id:'AZ-2607-RK', periode:'Juli 2026', betrag:1000, status:'ausgezahlt', datum:'14.08.2026', posten:[] },
      { id:'AZ-2606-RK', periode:'Juni 2026', betrag:1000, status:'ausgezahlt', datum:'15.07.2026', posten:[] },
    ],
    inan:[
      { id:'AZ-2609-IY', periode:'September 2026', betrag:1750, status:'pruefung', datum:'15.10.2026', posten:[
        ['23.09.','Familie Becker','Termin für Leo gelegt',250,'fest'],['21.09.','Familie Richter','Termin für Leo gelegt',250,'fest'],['20.09.','Familie Zimmermann','Termin für Leo gelegt',250,'fest'],['19.09.','Familie Brandt','Termin für Leo gelegt',250,'fest'],['…','3 weitere Termine','Termin für Leo gelegt',750,'fest']] },
      { id:'AZ-2608-IY', periode:'August 2026', betrag:2000, status:'ausgezahlt', datum:'15.09.2026', posten:[] },
      { id:'AZ-2607-IY', periode:'Juli 2026', betrag:1500, status:'ausgezahlt', datum:'14.08.2026', posten:[] },
    ],
    leo:[
      { id:'AZ-2609-LH', periode:'September 2026', betrag:7400, status:'freigegeben', datum:'15.10.2026', posten:[
        ['20.09.','Jörg & Anke Lindner','Abschluss Wärmepumpe',1000,'vorlaeufig:04.10.'],['19.09.','Petra Hoffmann','Abschluss Wärmepumpe',1000,'vorlaeufig:03.10.'],['…','5 weitere Abschlüsse','Widerrufsfrist abgelaufen',5000,'fest'],['30.09.','Wärmepumpen-Cup','200 € Gutschein + Platz 1 (vorläufig)',400,'offen']] },
      { id:'AZ-2608-LH', periode:'August 2026', betrag:6000, status:'ausgezahlt', datum:'15.09.2026', posten:[] },
    ],
  };

  /* Verträge (DocuSign-Status) */
  const CONTRACTS: Contract[] = [
    { id:'V-101', who:'romy', doc:'Handelsvertretervertrag (§ 84 HGB)', status:'signed', sent:'01.03.2026', signed:'03.03.2026' },
    { id:'V-102', who:'romy', doc:'Provisionsvereinbarung 2026', status:'signed', sent:'01.03.2026', signed:'03.03.2026' },
    { id:'V-103', who:'romy', doc:'Vertraulichkeits- & Datenschutzvereinbarung', status:'open', sent:'19.09.2026', signed:null },
    { id:'V-104', who:'romy', doc:'Teilnahmebedingungen Wärmepumpen-Cup', status:'signed', sent:'29.08.2026', signed:'30.08.2026' },
    { id:'V-201', who:'inan', doc:'Handelsvertretervertrag (§ 84 HGB)', status:'signed', sent:'15.01.2026', signed:'16.01.2026' },
    { id:'V-202', who:'inan', doc:'Provisionsvereinbarung Presetting 2026', status:'signed', sent:'15.01.2026', signed:'16.01.2026' },
    { id:'V-203', who:'inan', doc:'Vertraulichkeits- & Datenschutzvereinbarung', status:'open', sent:'19.09.2026', signed:null },
    { id:'V-301', who:'leo', doc:'Handelsvertretervertrag (§ 84 HGB)', status:'signed', sent:'10.11.2025', signed:'10.11.2025' },
    { id:'V-302', who:'leo', doc:'Provisionsvereinbarung Closing 2026', status:'signed', sent:'02.01.2026', signed:'04.01.2026' },
    { id:'V-303', who:'leo', doc:'Vertraulichkeits- & Datenschutzvereinbarung', status:'signed', sent:'19.09.2026', signed:'20.09.2026' },
    { id:'V-401', who:'lara', doc:'Vertraulichkeits- & Datenschutzvereinbarung', status:'signed', sent:'19.09.2026', signed:'19.09.2026' },
    { id:'V-501', who:'florian', doc:'Provisionsvereinbarung 2026', status:'open', sent:'08.09.2026', signed:null, question:'Rückfrage zur Staffel ab 10 Anlagen – gilt die rückwirkend?' },
    { id:'V-502', who:'florian', doc:'Handelsvertretervertrag (§ 84 HGB)', status:'open', sent:'08.09.2026', signed:null },
    { id:'V-601', who:'ugur', doc:'Vertraulichkeits- & Datenschutzvereinbarung', status:'open', sent:'19.09.2026', signed:null },
    { id:'V-701', who:'daniel', doc:'Teilnahmebedingungen Wärmepumpen-Cup', status:'signed', sent:'29.08.2026', signed:'01.09.2026' },
  ];

  /* Events */
  const EVENTS: TeamEvent[] = [
    { id:'E-31', title:'Vertriebstraining: Einwände an der Haustür', date:'2026-09-29', time:'18:00–20:00', ort:'Büro Leipzig, Fabrikstraße 21', type:'Training', target:'Setter', desc:'Die fünf häufigsten Einwände im Door-to-Door und wie wir sie drehen. Mit Rollenspielen.', going:['lara','eric','romy'], by:'tim' },
    { id:'E-32', title:'Siegerehrung Wärmepumpen-Cup', date:'2026-10-02', time:'19:00', ort:'Büro Leipzig, Fabrikstraße 21', type:'Team', target:'Alle', desc:'Wir küren die Top 3 des September-Cups und stoßen auf das Team an.', going:['leo','lara','tim','inan'], by:'tim' },
    { id:'E-33', title:'Schulung: Heizungsförderung 2026 (online)', date:'2026-10-07', time:'17:30–18:30', ort:'Online (Link folgt per WhatsApp)', type:'Schulung', target:'Alle', desc:'KfW-Heizungsförderung: Boni, Einkommensgrenzen, typische Kundenfragen.', going:['inan'], by:'tim' },
    { id:'E-34', title:'Onboarding neue MBs', date:'2026-10-01', time:'10:00–13:00', ort:'Büro Leipzig, Fabrikstraße 21', type:'Onboarding', target:'Setter', desc:'Pflichttermin für alle neuen Setter: Ablauf, Setting-Link, Pipedrive-Status, Auszahlung.', going:[], by:'tim' },
  ];

  /* Rangliste: Wärmepumpen-Cup = Wettbewerb der Closer (verkaufte Anlagen) */
  const BOARD: Board = {
    title:'Wärmepumpen-Cup September 2026', unit:'Anlagen', goal:65, ends:'30.09.2026',
    published:'22.09.2026, 18:30', by:'Tim',
    rows:[['leo',7],['tim',6],['lara',6],['romy',3],['eric',2],['inan',2],['ugur',1],['florian',0],['daniel',0]],
    prizes:[['5 Anlagen','200 € Gutschein'],['10 Anlagen','500 € Tank-/\u200BReisegutschein'],['Platz 1','+200 €'],['Platz 2 und 3','je +100 €']],
    marks:[5,10],
};
  const BOARD_ARCHIVE: BoardArchiveEntry[] = [
    { title:'Wärmepumpen-Sprint August 2026', winner:'Lara', total:'31 Anlagen', date:'01.09.2026' },
    { title:'Wärmepumpen-Woche KW 30', winner:'Eric', total:'12 Anlagen', date:'27.07.2026' },
  ];

  /* Stammdaten (sensibel – nur eigene Ansicht bzw. Admin) */
  const PROFILES: Record<PersonKey, Profile> = {
    romy:{ name:'Romy Krause', geb:'12.04.1998', tel:'0176 23458812', mail:'romy.krause@beispiel.de', str:'Georg-Schwarz-Straße 88', plz:'04179', ort:'Leipzig', iban:'DE89370400440532013000', inhaber:'Romy Krause', bank:'Beispielbank Leipzig', steuer:'231/456/78901', klein:true, gewerbe:'liegt vor (03/2026)', start:'01.03.2026' },
    inan:{ name:'Inan Yıldız', geb:'03.11.1995', tel:'0157 88123040', mail:'inan.yildiz@beispiel.de', str:'Karl-Heine-Straße 41', plz:'04229', ort:'Leipzig', iban:'DE12500105170648489890', inhaber:'Inan Yıldız', bank:'Beispielbank', steuer:'232/118/40022', klein:false, gewerbe:'liegt vor (01/2026)', start:'15.01.2026' },
    leo:{ name:'Leo Hartmann', geb:'27.06.1993', tel:'0172 55001923', mail:'leo.hartmann@beispiel.de', str:'Hauptstraße 12', plz:'04416', ort:'Markkleeberg', iban:'DE44100100100123456789', inhaber:'Leo Hartmann', bank:'Beispielbank', steuer:'239/220/19930', klein:false, gewerbe:'liegt vor (11/2025)', start:'10.11.2025' },
    tim:{ name:'Tim Jochmann', geb:'—', tel:'—', mail:'—', str:'Fabrikstraße 21', plz:'04178', ort:'Leipzig', iban:'DE00000000000000000000', inhaber:'—', bank:'—', steuer:'—', klein:false, gewerbe:'—', start:'—' },
    lara:{ name:'Lara Möbius', geb:'19.08.1999', tel:'0151 44090211', mail:'lara.moebius@beispiel.de', str:'Eisenbahnstraße 101', plz:'04315', ort:'Leipzig', iban:'DE75512108001245126199', inhaber:'Lara Möbius', bank:'Beispielbank', steuer:'231/771/00312', klein:true, gewerbe:'liegt vor', start:'01.02.2026' },
    eric:{ name:'Eric Sommer', geb:'02.02.2000', tel:'0160 99231877', mail:'eric.sommer@beispiel.de', str:'Brandvorwerkstraße 7', plz:'04275', ort:'Leipzig', iban:'DE27100777770209299700', inhaber:'Eric Sommer', bank:'Beispielbank', steuer:'231/882/10002', klein:true, gewerbe:'liegt vor', start:'01.04.2026' },
    ugur:{ name:'Uğur Demir', geb:'14.05.1997', tel:'0170 33218840', mail:'ugur.demir@beispiel.de', str:'Torgauer Straße 55', plz:'04318', ort:'Leipzig', iban:'DE02120300000000202051', inhaber:'Uğur Demir', bank:'Beispielbank', steuer:'—', klein:true, gewerbe:'fehlt', start:'01.06.2026' },
    florian:{ name:'Florian Reichel', geb:'30.09.2001', tel:'0152 71002233', mail:'florian.reichel@beispiel.de', str:'Kolonnadenstraße 3', plz:'04109', ort:'Leipzig', iban:'DE02500105170137075030', inhaber:'Florian Reichel', bank:'Beispielbank', steuer:'—', klein:true, gewerbe:'fehlt', start:'08.09.2026' },
    daniel:{ name:'Daniel Fuchs', geb:'11.12.1996', tel:'0163 55120980', mail:'daniel.fuchs@beispiel.de', str:'Riebeckstraße 20', plz:'04317', ort:'Leipzig', iban:'DE88100900001234567892', inhaber:'Daniel Fuchs', bank:'Beispielbank', steuer:'231/650/88810', klein:false, gewerbe:'liegt vor', start:'01.05.2026' },
  };

  /* Teamübersicht (Admin) */
  const TEAM: TeamMember[] = ['romy','lara','eric','ugur','florian','inan','daniel','leo'].map(k => ({ key:k, status: k==='florian' ? 'onboarding' : 'aktiv' }));

  /* Benachrichtigungen je Person (bei Statusänderung eines Leads via Pipedrive-Webhook → n8n) */
  const NOTIFS: Record<PersonKey, Notification[]> = {
    romy:[
      { t:'Familie Brandt: Termin gelegt (Do 24.09., 10:00 mit Leo)', time:'vor 2 Std.', status:'termin', unread:true },
      { t:'Sabine Weigel: Rückruf vereinbart (Do 10:00)', time:'gestern, 15:20', status:'eingereicht', unread:true },
      { t:'Familie Nguyen: Nicht erreicht – nächster Versuch Do ab 18 Uhr', time:'gestern, 17:40', status:'eingereicht', unread:true },
      { t:'Jörg & Anke Lindner: Verkauft. +1.000 € Provision vorgemerkt', time:'So, 20.09.', status:'verkauft', unread:false },
      { t:'Neues Event: Vertriebstraining am 29.09.', time:'Sa, 19.09.', status:null, unread:false },
    ],
    inan:[
      { t:'Neuer Lead von Romy: Thomas Krüger', time:'vor 1 Std.', status:'eingereicht', unread:true },
      { t:'Neuer Lead von Romy: Ralf Seidel (Wärmepumpe) – bitte presetten', time:'gestern, 19:12', status:'eingereicht', unread:true },
      { t:'Leo hat 3 neue freie Slots eingetragen', time:'gestern, 20:05', status:null, unread:false },
    ],
    leo:[
      { t:'Rückmeldung fällig: Familie Zimmermann (Ersttermin heute 10:00)', time:'vor 2 Std.', status:null, unread:true },
      { t:'Neuer Termin: Familie Becker, Sa 26.09., 11:00 (Machern)', time:'vor 5 Std.', status:'termin', unread:true },
      { t:'Neuer Termin: Familie Brandt, Do 24.09., 10:00 (Gohlis)', time:'vor 2 Std.', status:'termin', unread:true },
    ],
    tim:[
      { t:'Leo hat den Vertrag „Datenschutzvereinbarung“ unterschrieben', time:'So, 20.09.', status:null, unread:true },
      { t:'Florian hat eine Rückfrage zur Provisionsvereinbarung', time:'Mo, 21.09.', status:null, unread:true },
      { t:'4 Leads heute eingereicht', time:'heute, 12:48', status:'eingereicht', unread:false },
    ],
  };

  /* Einreichungen (Leads) je Kalenderwoche – Team gesamt */
  const WEEKLY: [string, number][] = [['KW 32',24],['KW 33',31],['KW 34',27],['KW 35',35],['KW 36',38],['KW 37',33],['KW 38',41],['KW 39',19]];

  /* Verlustgründe im September (Admin-Auswertung) */
  const LOSS_STATS: [string, number][] = [['Kein Eigentümer',9],['Zu teuer',7],['Kein Interesse mehr',6],['Anderer Anbieter',4],['Technisch nicht machbar',3],['Sonstiges',2]];

  /* Tagesziel Setter */
  const CALL_DAY: { goal: number; done: number } = { goal:30, done:14 }; /* Presetter: Anrufe heute */
  const DAY_GOAL: { goal: number; streak: number; week: [string, number | null][] } = { goal:5, streak:4, week:[['Mo',6],['Di',5],['Mi',null],['Do',null],['Fr',null],['Sa',null]] };

  /* Setter-Rangliste (nur für Setter sichtbar): gelegte Termine aus eigenen Leads */
  const SETTER_BOARD: Board = {
    title:'Setter-Rangliste September 2026', unit:'gelegte Termine', goal:null, ends:'30.09.2026',
    published:'22.09.2026, 18:30', by:'Tim', marks:[], prizes:[],
    rows:[['lara',12],['eric',7],['romy',5],['ugur',4],['florian',1]],
  };

  /* Quoten je MB (Admin, September, Beispiel) */
  const MB_STATS: MbStats[] = [
    { key:'lara',    leads:38, termin:14, checks:10, verkauft:6, last:'23.09.2026', days:0 },
    { key:'romy',    leads:29, termin:11, checks:6,  verkauft:3, last:'23.09.2026', days:0 },
    { key:'eric',    leads:24, termin:7,  checks:4,  verkauft:2, last:'22.09.2026', days:1 },
    { key:'ugur',    leads:17, termin:4,  checks:2,  verkauft:1, last:'20.09.2026', days:3 },
    { key:'florian', leads:6,  termin:1,  checks:0,  verkauft:0, last:'18.09.2026', days:5 },
  ];

  /* Vergleichswerte für die Einfärbung von Zahlen (grün = deutlich besser, rot = deutlich schlechter als der Vergleich) */
  const BENCH: Record<string, number> = { setterLeads:23, setterTermin:32, presetterTermin:35, presetterTerminMe:41, closerQuote:45, closerQuoteMe:54, closerAbschluesse:3, firstCallH:2, firstCallMe:3.4 };

  /* Monatsziel Verdienst je Person (vom MB selbst einstellbar) */
  const MONEY_GOAL: Record<PersonKey, number> = { romy:3000, inan:2500, leo:8000 };

  return { NOW, PEOPLE, ROLE_USER, LEADS, APPTS, SLOTS, PAYOUTS, CONTRACTS, EVENTS, BOARD, BOARD_ARCHIVE, PROFILES, TEAM, NOTIFS, WEEKLY, LOSS_STATS, CALL_DAY, DAY_GOAL, SETTER_BOARD, MB_STATS, BENCH, MONEY_GOAL };
}

export type DemoData = ReturnType<typeof createDemoData>;

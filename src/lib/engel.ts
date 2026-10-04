/* „Frag den Engel“: Rundgang (Tour) und häufige Fragen je Rolle – Texte aus Tims Vorlage (03.10.2026).
   sel = CSS-Auswahl des Bereichs, der beim Schritt hervorgehoben wird (data-component der Ansicht). */

import type { Role } from "./types";

export interface TourStep {
  view: string;
  sel: string;
  t: string;
  x: string;
}
export type Faq = [question: string, answer: string];

const AKADEMIE_STEP: TourStep = {
  view: "akademie",
  sel: '[data-component="AcademyUnlockCard"], [data-component="AcademyAdminTeam"]',
  t: "Akademie",
  x: "Hier lernst du Schritt für Schritt, was du für deine Rolle brauchst. Nach dem Rollentest ist deine Ansicht freigeschaltet. Videos und Wissenschecks stehen in jedem Modul.",
};

export const TOURS: Record<Role, TourStep[]> = {
  setter: [
    { view: "uebersicht", sel: '[data-component="TodayHero"]', t: "Dein Tag", x: "Hier siehst du, wie viele Leads du heute schon eingereicht hast – im Vergleich zu deinem Tagesziel. Darunter deine Woche und deine Serie." },
    { view: "uebersicht", sel: '[data-component="MonthCard"]', t: "Dein Geld", x: "Was du diesen Monat verdient hast, was in Aussicht ist und wann ausgezahlt wird. Dein Ziel kannst du selbst ändern." },
    { view: "uebersicht", sel: '[data-component="TodoCard"]', t: "Zu erledigen", x: "Die wichtigsten Aufgaben für heute. Alle Aufgaben findest du unter „To-Dos“." },
    { view: "uebersicht", sel: '[data-component="RankCard"]', t: "Rangliste", x: "Dein Platz in der Setter-Rangliste und wie viel bis zum nächsten Platz fehlt." },
    { view: "erfassen", sel: '[data-component="LeadForm"]', t: "Lead erfassen", x: "Direkt an der Tür: Notizen, Kontaktdaten, Terminabsprache. Pflichtfelder sind orange markiert." },
    { view: "erfassen", sel: '[data-component="Stepper"]', t: "Vorqualifizieren & Termin", x: "Optional kannst du gleich vorqualifizieren und sogar einen Termin legen. Alles, was du hier beantwortest, muss der Presetter nicht mehr fragen." },
    { view: "leads", sel: '[data-component="PipelineBoard"], [data-component="PipelineBar"]', t: "Deine Pipeline", x: "Jede Spalte ist eine Stufe – von „Lead eingereicht“ bis „Ausgezahlt“. Darunter liegen deine Leads. Oben rechts kannst du auf die Liste umschalten." },
    { view: "todos", sel: ".ee-content", t: "To-Dos", x: "Alles, was offen ist – überfällig, heute, demnächst – und was du heute schon erledigt hast." },
    { view: "auszahlungen", sel: '[data-component="PayoutTable"]', t: "Auszahlungen", x: "Jede Provision einzeln mit Status. Fest wird sie, sobald der Kunde TBK ist. Gutschrift als PDF und Rückfragen direkt an der Position." },
    AKADEMIE_STEP,
  ],
  presetter: [
    { view: "uebersicht", sel: '[data-component="TodayHero"]', t: "Dein Tag", x: "Anrufe heute im Vergleich zum Tagesziel, deine Woche und gelegte Termine." },
    { view: "uebersicht", sel: '[data-component="TodoCard"]', t: "Anrufliste", x: "Die dringendsten Anrufe stehen oben: überfällige Rückrufe, dann neue Leads. Ein Tipp öffnet den Leitfaden." },
    { view: "leitfaden", sel: '[data-component="CallBar"]', t: "Leitfaden", x: "Oben immer der aktuelle Kunde mit Anruf-Button und den Ergebnissen: nicht erreicht, Rückruf, abgesagt." },
    { view: "leitfaden", sel: '[data-component="DoorFilter"], [data-component="VqForm"]', t: "Vorqualifizierung", x: "Die Fragen wie in TMVT. Was der Setter an der Tür schon aufgenommen hat, ist ausgeblendet – du fragst nur, was fehlt." },
    { view: "leitfaden", sel: '[data-component="ObjectionPanel"], [data-component="ObjectionButton"]', t: "Einwände", x: "Sagt der Kunde „zu teuer“ oder „keine Zeit“? Hier findest du sofort die passende Antwort." },
    { view: "leitfaden", sel: '[data-component="SlotPicker"]', t: "Termin legen", x: "Freie Termine des Closers. Termin wählen, bestätigen – Setter und Closer werden automatisch informiert." },
    { view: "leads", sel: '[data-component="PipelineBoard"], [data-component="PipelineBar"]', t: "Pipeline", x: "Alle deine Leads nach Stufe – von „Lead eingereicht“ über „Terminierung“ bis „Ausgezahlt“. Auf dem Handy seitlich wischen." },
    { view: "todos", sel: ".ee-content", t: "To-Dos", x: "Alle offenen Anrufe und Aufgaben – und was du heute schon geschafft hast." },
    AKADEMIE_STEP,
  ],
  closer: [
    { view: "uebersicht", sel: '[data-component="TodayHero"]', t: "Dein Tag", x: "Wie viele Aufgaben du heute erledigt hast, deine Woche und dein nächster Termin." },
    { view: "uebersicht", sel: '[data-component="MonthCard"]', t: "Dein Geld", x: "Verdient, in Aussicht und wie viele Verkäufe bis zu deinem Monatsziel fehlen." },
    { view: "uebersicht", sel: '[data-component="TodoCard"]', t: "Rückmeldungen", x: "Nach jedem Termin gibst du innerhalb von 24 Stunden eine Rückmeldung. Sonst werden deine Slots für neue Leads pausiert." },
    { view: "kalender", sel: '[data-component="SlotForm"]', t: "Freie Slots", x: "Trag hier ein, wann du Zeit hast. Nur in diese Slots legen Setter und Presetter Termine." },
    { view: "kalender", sel: '[data-component="CalendarWeek"], [data-component="CalendarDay"]', t: "Kalender", x: "Deine Woche mit Terminen und freien Slots. Auf eine leere Stunde tippen trägt sofort einen Slot ein." },
    { view: "termine", sel: '[data-component="AppointmentCard"]', t: "Termine & Steckbrief", x: "Jeder Termin mit Adresse, Route, Anruf-Button und Steckbrief aus Setting und Presetting." },
    { view: "termine", sel: '[data-component="EppList"]', t: "Weiter im EPP", x: "Nach dem Aufmaß arbeitest du nur noch im Enpal-Partnerportal. Checks, Verkaufstermin und Verkauf kommen automatisch hierher – Setter und Presetter sehen den Stand." },
    { view: "rangliste", sel: '[data-component="Leaderboard"]', t: "Wärmepumpen-Cup", x: "Der aktuelle Stand im Cup und die Prämienstufen." },
    AKADEMIE_STEP,
  ],
  admin: [
    { view: "uebersicht", sel: '[data-component="TodayHero"]', t: "Heute zu tun", x: "Wie viele Aufgaben offen sind, wie viele davon überfällig, und wann die nächste Auszahlung fällig ist." },
    { view: "uebersicht", sel: '[data-component="TeamMonth"]', t: "Team-Monat", x: "Verkaufte Anlagen gegen das Monatsziel. Der schwarze Strich ist das Soll bis heute." },
    { view: "uebersicht", sel: '[data-component="TodoCard"]', t: "Zu erledigen", x: "Alles, wo du eingreifen musst: überfällige Anrufe, offene Rückmeldungen, fehlende EPP-Anlagen, Freigaben. Alle Aufgaben mit Filtern unter „To-Dos“." },
    { view: "uebersicht", sel: '[data-component="Funnel"]', t: "Pipeline gesamt", x: "Wie viele Leads in welcher Stufe sind – mit Umwandlungsquoten gegen eure Ziele." },
    { view: "uebersicht", sel: '[data-component="QuoteTable"]', t: "Quoten je Rolle", x: "Setter, Presetter und Closer im Vergleich – rot heißt deutlich unter dem Teamschnitt." },
    { view: "todos", sel: '[data-component="TodoFilter"]', t: "To-Dos filtern", x: "Nach Bereich oder nach einzelnen Mitarbeitenden filtern – die Zahlen zeigen, wie viel offen ist." },
    { view: "team", sel: '[data-component="TeamList"]', t: "Team", x: "Jede Person mit Rolle und Stand im Onboarding. Neue MBs lädst du über das Formular ein." },
    { view: "auszahlungen", sel: '[data-component="PayoutTable"]', t: "Auszahlungslauf", x: "Zweimal im Monat: Stichtag 1. → Auszahlung am 10., Stichtag 15. → Auszahlung am 25. Prüfen, freigeben, Überweisungsliste exportieren." },
    { view: "rangliste", sel: '[data-component="BoardEditor"]', t: "Ranglisten posten", x: "Stand eintragen und veröffentlichen – optional direkt in die WhatsApp-Gruppe." },
    { view: "events", sel: '[data-component="EventForm"]', t: "Events posten", x: "Neue Events landen bei allen MBs im Dashboard." },
    AKADEMIE_STEP,
  ],
};

/** Gesperrte Rolle (Akademie-Test noch nicht bestanden): kurze Tour durch die vier offenen Bereiche */
export const LOCKED_TOUR: TourStep[] = [
  { view: "akademie", sel: '[data-component="AcademyUnlockCard"]', t: "Deine Freischaltung", x: "Hier siehst du, wie weit du bist. Sind alle Module erledigt, startest du den Rollentest. Ab 80 % ist deine Ansicht freigeschaltet." },
  { view: "akademie", sel: '[data-component="ModuleList"]', t: "Deine Module", x: "Jedes Modul hat ein Video, Text und einen kurzen Wissenscheck. Das nächste Modul wird frei, wenn das vorherige geschafft ist." },
  { view: "vertraege", sel: ".ee-content", t: "Verträge", x: "Dein Vertrag und seine Unterschrift. Bei Fragen kannst du direkt eine Rückfrage an den Admin stellen." },
  { view: "stammdaten", sel: ".ee-content", t: "Stammdaten", x: "Deine Adresse und deine Bankverbindung für die Auszahlung, dazu die Sicherheit deines Kontos." },
];

const FAQ_AKADEMIE: Faq[] = [
  ["Warum ist meine Ansicht gesperrt?", "Jede Rolle wird erst nach der Akademie freigeschaltet: Module durcharbeiten, dann den Rollentest bestehen (mindestens 80 %). Danach schaltet sich alles automatisch frei."],
  ["Was passiert, wenn ich den Test nicht bestehe?", "Du siehst, welche Fragen falsch waren. Der Admin bekommt eine Nachricht und kann eine Wiederholung freigeben. Über „Freigabe anfragen“ in der Akademie kannst du ihn bitten."],
];

export const FAQS: Record<Role, Faq[]> = {
  setter: [
    ["Wann bekomme ich mein Geld?", "Für jeden verkauften Lead gibt es 1.000 €. Fest wird die Provision, sobald der Kunde nach der Montagevorbereitung TBK ist – ausgezahlt wird zweimal im Monat: Was bis zum 1. fest ist, kommt am 10.; was bis zum 15. fest ist, kommt am 25."],
    ["Muss ich an der Tür vorqualifizieren?", "Nein, das ist optional. Alles, was du aufnimmst, spart dem Presetter Zeit – und erhöht die Chance auf einen Termin."],
    ["Was heißt „Terminierung“?", "Der Presetter ist mit deinem Kunden in Kontakt – Anrufversuche oder ein vereinbarter Rückruf."],
    ["Woher kommt der Stand nach dem Aufmaß?", "Aus dem Enpal-Partnerportal (EPP). Alles mit dem Zeichen „EPP“ wird automatisch übertragen."],
    ["Wo sehe ich, was mit meinem Lead passiert?", "In der Pipeline. Bei jeder Statusänderung bekommst du außerdem eine Nachricht über die Glocke oben."],
    ...FAQ_AKADEMIE,
  ],
  presetter: [
    ["Welche Fragen muss ich noch stellen?", "Nur die, die im Leitfaden eingeblendet sind. Was der Setter schon an der Tür aufgenommen hat, ist ausgeblendet („Alle anzeigen“ holt es zurück)."],
    ["Warum kann ich den Termin nicht buchen?", "Mindestens eine Angabe liegt außerhalb der TMVT-Grenzen, z. B. Heizkosten außerhalb 5–25 ct. Rot markierte Felder korrigieren."],
    ["Wie frage ich nach dem Einkommen?", "Ganz am Ende, mit dem Satz im Leitfaden: Für die Förderung fragt der Hersteller grob die Spanne ab."],
    ["Was bekomme ich pro Termin?", "250 € für jeden Termin, den du für den Closer legst. Ausgezahlt wird, sobald der Kunde TBK ist."],
    ...FAQ_AKADEMIE,
  ],
  closer: [
    ["Bis wann muss ich Rückmeldung geben?", "Innerhalb von 24 Stunden nach jedem Aufmaßtermin. Danach werden deine Slots für neue Leads pausiert."],
    ["Wo bearbeite ich Kunden nach dem Aufmaß?", "Nur noch im Enpal-Partnerportal (EPP). Der Stand wird automatisch ins Dashboard übertragen – du musst hier nichts nachtragen."],
    ["Was sind die grauen EPP-Termine im Kalender?", "Termine, die du direkt über das EPP bekommen hast. Sie blockieren die Zeit, damit keine Eigenleads darauf gelegt werden."],
    ["Wie bekomme ich neue Termine?", "Trag im Kalender freie Slots ein – nur dort legen Setter und Presetter Termine."],
    ["Was ist der Unterschied zwischen Aufmaß- und Verkaufstermin?", "Beim Aufmaßtermin wird das Haus aufgenommen, danach laufen die Checks. Beim Verkaufstermin wird abgeschlossen."],
    ...FAQ_AKADEMIE,
  ],
  admin: [
    ["Wie lege ich einen neuen Setter an?", "Unter „Team“ im Formular „Neuen MA einladen“: Name und E-Mail eintragen – der Zugang wird per E-Mail verschickt."],
    ["Wer sieht welche Rangliste?", "Setter sehen die Setter-Rangliste, Presetter die Presetter-Rangliste, Closer den Wärmepumpen-Cup."],
    ["Wann wird ausgezahlt?", "Zweimal im Monat: Was bis zum 1. fest (TBK) ist, wird am 10. ausgezahlt; was bis zum 15. fest ist, am 25. Vorher gibst du die Abrechnungen unter „Auszahlungen“ frei."],
    ["Wie gebe ich eine Akademie-Wiederholung frei?", "Unter „Akademie“ › „Team & Freischaltung“ bei der Person auf „Test freigeben“ klicken. Dort kannst du auch eine Rolle von Hand freischalten oder die Sperre ausschalten."],
  ],
};

/** Schritte und Fragen für die aktuelle Ansicht; gesperrte Rolle bekommt die kurze Tour */
export const stepsFor = (role: Role, locked: readonly Role[] = []) => (locked.includes(role) ? LOCKED_TOUR : TOURS[role]);
export const faqFor = (role: Role, locked: readonly Role[] = []): Faq[] => (locked.includes(role) ? FAQ_AKADEMIE : FAQS[role]);

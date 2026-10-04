import "server-only";

/* Richtige Antworten der Akademie – bleiben auf dem Server, damit sie niemand im Browser auslesen kann.
   Index = Position der richtigen Antwortoption. */

export const MODULE_ANSWERS: Record<string, { a: number; why: string }> = {
  "g1": {
    "a": 2,
    "why": "Erst mit TBK zahlt Enpal an EnergyEngel – und erst dann fließt die Provision."
  },
  "g2": {
    "a": 1,
    "why": "Die JAZ beschreibt, wie viel Wärme pro kWh Strom übers Jahr herauskommt."
  },
  "g3": {
    "a": 2,
    "why": "Nur selbst bewohnte Einfamilienhäuser im Eigentum, ohne Fernwärme, Nachtspeicher oder Sonderlösungen."
  },
  "g4": {
    "a": 1,
    "why": "Echte Dringlichkeit beruht auf dem Risiko und den Kosten des Kunden – nicht auf erfundenem Zeitdruck."
  },
  "g5": {
    "a": 1,
    "why": "Die meisten Abbrüche zwischen Verkauf und TBK entstehen durch Vertragsanpassungen oder Sonderkriterien vor Ort."
  },
  "s1": {
    "a": 1,
    "why": "Ohne Einwilligung darf niemand anrufen, und ohne Kundenfit verschwendet der Lead alle Zeit."
  },
  "s2": {
    "a": 1,
    "why": "Zustimmen und das Ausfallrisiko als Grund zum Planen nutzen – ohne Angst zu machen."
  },
  "p1": {
    "a": 1,
    "why": "Das Einkommen bestimmt, ob der Kunde den Einkommensbonus bekommt."
  },
  "p2": {
    "a": 1,
    "why": "Fehlt ein Entscheider, wird vertagt – und vertagte Entscheidungen werden oft zu Absagen."
  },
  "p3": {
    "a": 1,
    "why": "Wunsch anerkennen, Grenzen eines Prospekts erklären und zum Termin zurückführen."
  },
  "c1": {
    "a": 1,
    "why": "Je kleiner der Temperaturhub, desto weniger Strom braucht die Wärmepumpe."
  },
  "c2": {
    "a": 2,
    "why": "Der Kunde zahlt erst nach Fertigstellung – ein starkes Argument im Verkaufstermin."
  },
  "c3": {
    "a": 2,
    "why": "Antragsteller ist der Kunde, die Arbeit übernimmt der Closer mit ihm zusammen."
  },
  "c4": {
    "a": 1,
    "why": "Der Preis allein schreckt ab – im Zusammenhang mit Förderung und Ersparnis wird er greifbar."
  },
  "c5": {
    "a": 1,
    "why": "Unterschriften ohne alle Entscheider führen oft zu Widerrufen."
  },
  "c6": {
    "a": 1,
    "why": "Ohne Rückmeldung keine neuen Leads – Setter und Presetter brauchen den Stand."
  }
};

export const TEST_ANSWERS: Record<"setter" | "presetter" | "closer", number[]> = {
  "setter": [
    1,
    2,
    1,
    1,
    1,
    1,
    1,
    1
  ],
  "presetter": [
    1,
    1,
    1,
    1,
    1,
    2,
    1,
    1
  ],
  "closer": [
    1,
    1,
    2,
    1,
    1,
    1,
    1,
    1,
    1,
    1
  ]
};

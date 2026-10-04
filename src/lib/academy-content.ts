/* Inhalte der Akademie (Module, Wissenschecks, Rollentests) – Stand Tims Vorlage vom 03.10.2026.
   Die richtigen Antworten stehen NICHT hier, sondern nur auf dem Server (src/server/academy-answers.ts).
   Block `todo` = Platzhalter, Inhalte liefert Tim nach. **fett** wird beim Anzeigen ausgezeichnet. */

import type { Role } from "./types";

export type MaRole = Exclude<Role, "admin">;
export const MA_ROLES_ALL: MaRole[] = ["setter", "presetter", "closer"];
/** Bestehensgrenze der Rollentests */
export const PASS_RATIO = 0.8;

export type Block =
  | { h: string }
  | { p: string }
  | { ul: string[] }
  | { steps: string[] }
  | { tip: string }
  | { todo: string }
  | { cols: { title: string; tone: "ok" | "bad"; items: string[] }[] };

export interface AcademyModule {
  id: string;
  group: string;
  roles: MaRole[];
  min: number;
  title: string;
  video: { title: string; src: string };
  body: Block[];
  articles: { t: string; url: string }[];
  check: { q: string; o: string[] };
}
export interface TestQuestion {
  q: string;
  o: string[];
}

export const MODULES: AcademyModule[] = [
  {
    "id": "g1",
    "group": "Grundlagen",
    "roles": [
      "setter",
      "presetter",
      "closer"
    ],
    "min": 6,
    "title": "Willkommen & das System",
    "video": {
      "title": "Willkommen bei EnergyEngel – der Weg eines Leads",
      "src": ""
    },
    "body": [
      {
        "p": "EnergyEngel vermittelt Wärmepumpen an Besitzer von Einfamilienhäusern. Installiert wird von unserem Partner Enpal. Unser Job: die richtigen Kunden finden, sauber vorqualifizieren und zum Abschluss bringen."
      },
      {
        "h": "Drei Rollen, ein Team"
      },
      {
        "ul": [
          "**Setter** – spricht Hausbesitzer an (meist an der Haustür), erfasst den Lead im Dashboard und nimmt die ersten Fragen auf.",
          "**Presetter** – ruft an, klärt die offenen Vorqualifizierungsfragen (TMVT) und legt den Ersttermin beim Closer.",
          "**Closer** – Energieberater beim Kunden: Aufmaßtermin, Verkaufstermin, Förderantrag und Pflege im Enpal-Partnerportal (EPP)."
        ]
      },
      {
        "h": "Der Weg eines Leads"
      },
      {
        "steps": [
          "Eingereicht",
          "Terminierung",
          "Aufmaßtermin",
          "In den Checks",
          "Verkaufstermin",
          "Verkauft",
          "Montagevorbereitung",
          "TBK",
          "Auszahlung"
        ]
      },
      {
        "h": "Wann gibt es Geld?"
      },
      {
        "ul": [
          "**Setter:** 1.000 € je Lead, der nach dem Termin verkauft wird",
          "**Presetter:** 250 € je gelegtem Termin",
          "**Closer:** 1.000 € je Abschluss"
        ]
      },
      {
        "tip": "Ausgezahlt wird erst, wenn der Kunde TBK ist und EnergyEngel von Enpal bezahlt wurde. Ein Verkauf ist also noch kein verdientes Geld – Qualität geht vor Menge."
      },
      {
        "h": "Wo passiert was?"
      },
      {
        "ul": [
          "**MB-Dashboard:** Leads, Status, Termine, Auszahlungen und Verträge für unsere Eigenleads.",
          "**Pipedrive:** unser CRM – hier stehen alle Kunden.",
          "**Enpal-Partnerportal (EPP):** Nach dem Ersttermin pflegt der Closer den Kunden dort. Leads, die direkt von Enpal kommen, laufen nur im EPP."
        ]
      }
    ],
    "articles": [],
    "check": {
      "q": "Wann wird die Provision für einen verkauften Lead ausgezahlt?",
      "o": [
        "Direkt nach der Unterschrift des Kunden",
        "Sobald der Montagevorbereitungstermin stattgefunden hat",
        "Wenn der Kunde TBK ist und EnergyEngel von Enpal bezahlt wurde",
        "Am Monatsende, in dem der Lead eingereicht wurde"
      ]
    }
  },
  {
    "id": "g2",
    "group": "Grundlagen",
    "roles": [
      "setter",
      "presetter",
      "closer"
    ],
    "min": 7,
    "title": "Wärmepumpe in einfachen Worten",
    "video": {
      "title": "Wärmepumpe in 3 Minuten",
      "src": ""
    },
    "body": [
      {
        "p": "Eine Wärmepumpe funktioniert wie ein umgedrehter Kühlschrank: Sie holt Wärme aus der Außenluft – auch im Winter – und bringt sie auf Heiztemperatur."
      },
      {
        "h": "So funktioniert’s"
      },
      {
        "steps": [
          "Außengerät nimmt Wärme aus der Luft auf",
          "Kältemittel + Verdichter heben die Temperatur",
          "Wärme geht ins Heizungswasser",
          "Heizkörper, Fußbodenheizung, Warmwasser"
        ]
      },
      {
        "h": "Warum das spart"
      },
      {
        "p": "Aus 1 kWh Strom macht eine gute Wärmepumpe im Jahresschnitt etwa 3 bis 4 kWh Wärme. Den Rest liefert die Umgebung kostenlos. Dieses Verhältnis heißt **Jahresarbeitszahl (JAZ)**."
      },
      {
        "h": "Drei Sätze, die jeder MB sagen kann"
      },
      {
        "ul": [
          "„Die Wärmepumpe holt den größten Teil der Heizenergie kostenlos aus der Luft.“",
          "„Sie funktioniert auch bei Minusgraden.“",
          "„Ob sie bei Ihnen passt, rechnet unser Energieberater beim Termin für Ihr Haus aus.“"
        ]
      },
      {
        "tip": "Setter müssen Vorlauftemperatur oder Heizlast nicht erklären können – dafür ist der Closer da. Wichtig ist, Neugier zu wecken und den Termin zu bekommen."
      }
    ],
    "articles": [],
    "check": {
      "q": "Was bedeutet eine Jahresarbeitszahl (JAZ) von 3,5?",
      "o": [
        "Die Wärmepumpe läuft 3,5 Stunden am Tag",
        "Aus 1 kWh Strom werden im Jahresschnitt etwa 3,5 kWh Wärme",
        "Die Anlage hat 3,5 kW Leistung",
        "Der Strompreis steigt um 3,5 %"
      ]
    }
  },
  {
    "id": "g3",
    "group": "Grundlagen",
    "roles": [
      "setter",
      "presetter",
      "closer"
    ],
    "min": 5,
    "title": "Wer passt zu uns?",
    "video": {
      "title": "Guter Kunde, schlechter Kunde",
      "src": ""
    },
    "body": [
      {
        "p": "Ein Lead, der später rausfliegt, kostet alle Zeit – Setter, Presetter und Closer. Darum gilt: lieber früh ehrlich aussortieren."
      },
      {
        "cols": [
          {
            "title": "Passt",
            "tone": "ok",
            "items": [
              "Einfamilienhaus",
              "Im Grundbuch eingetragener Eigentümer (oder Notartermin/Urkunde)",
              "Wohnt selbst im Haus oder zieht bald ein",
              "Öl- oder Gasheizung, die ersetzt werden soll",
              "Förderung über die Grundförderung hinaus (Boni)"
            ]
          },
          {
            "title": "Passt nicht",
            "tone": "bad",
            "items": [
              "Mehrfamilienhaus",
              "Mieter oder Eigentümer, der nicht selbst wohnt",
              "Fernwärme",
              "Nachtspeicher",
              "Sonderlösungen, Eigenleistung oder alte Heizung behalten",
              "Nur Grundförderung (meist uninteressant)"
            ]
          }
        ]
      },
      {
        "tip": "Unsicher? Lead trotzdem einreichen und im Notizfeld vermerken, was unklar ist. Der Presetter klärt es im Telefonat."
      }
    ],
    "articles": [],
    "check": {
      "q": "Welcher Kunde passt zu uns?",
      "o": [
        "Mehrfamilienhaus mit Gasheizung, Eigentümer wohnt selbst",
        "Einfamilienhaus mit Fernwärme",
        "Einfamilienhaus mit 20 Jahre alter Gasheizung, Eigentümer wohnt selbst",
        "Einfamilienhaus, Kunde will die Ölheizung als Backup behalten"
      ]
    }
  },
  {
    "id": "g4",
    "group": "Grundlagen",
    "roles": [
      "setter",
      "presetter",
      "closer"
    ],
    "min": 8,
    "title": "Kundeninteressen & Dringlichkeit",
    "video": {
      "title": "Was Kunden wirklich wollen – und warum jetzt",
      "src": ""
    },
    "body": [
      {
        "p": "Niemand kauft eine Wärmepumpe wegen der Technik. Kunden kaufen eine Lösung für ein Problem. Wer das Problem findet, findet auch den Grund, jetzt zu handeln."
      },
      {
        "h": "Die häufigsten Kundeninteressen"
      },
      {
        "ul": [
          "**Kosten senken** – Heizkosten runter, planbare Ausgaben",
          "**Sicherheit** – keine Angst vor dem Heizungsausfall im Winter",
          "**Unabhängigkeit** – weg von Öl- und Gaspreisen",
          "**Wert der Immobilie** – modernes Heizsystem statt Sanierungsstau",
          "**Bequemlichkeit** – kein Tank, keine Öllieferung",
          "**Zukunftssicherheit** – Vorgaben zum Heizungstausch werden strenger"
        ]
      },
      {
        "h": "Gute Fragen, um das Interesse zu finden"
      },
      {
        "ul": [
          "„Wie alt ist Ihre Heizung – und was passiert, wenn sie im Januar ausfällt?“",
          "„Was zahlen Sie im Jahr fürs Heizen?“",
          "„Was wäre Ihnen bei einer neuen Heizung am wichtigsten?“",
          "„Wer entscheidet bei Ihnen mit?“"
        ]
      },
      {
        "h": "Dringlichkeit – ehrlich, nicht mit Druck"
      },
      {
        "ul": [
          "**Ausfallrisiko:** Fällt die alte Heizung aus, entscheidet man unter Zeitdruck und ohne Vergleich.",
          "**Laufende Kosten:** Jeder Winter mit der alten Heizung kostet Geld, das man sparen könnte.",
          "**CO₂-Preis:** Heizen mit Öl und Gas wird über den CO₂-Preis schrittweise teurer.",
          "**Förderung:** Fördersätze und Boni können sich ändern; der Geschwindigkeitsbonus ist befristet.",
          "**Vorlaufzeit:** Planung, Förderung und Montage brauchen Zeit – wer jetzt startet, heizt vor dem nächsten Winter neu."
        ]
      },
      {
        "todo": "Fördersätze, Fristen und die Entwicklung des CO₂-Preises werden vor Livegang mit offiziellen Quellen abgeglichen und hier als Zahlen ergänzt."
      },
      {
        "tip": "Kein künstlicher Druck („Angebot nur heute“). Das zerstört Vertrauen und führt zu Widerrufen – und ein Widerruf heißt: keine Provision."
      }
    ],
    "articles": [],
    "check": {
      "q": "Welche Aussage ist ein seriöser Dringlichkeitspunkt?",
      "o": [
        "„Das Angebot gilt nur noch heute.“",
        "„Fällt Ihre alte Heizung im Winter aus, müssen Sie unter Zeitdruck entscheiden – jetzt können Sie in Ruhe planen.“",
        "„Ihr Nachbar hat auch schon unterschrieben.“",
        "„Wenn Sie heute nicht unterschreiben, gibt es keine Förderung mehr.“"
      ]
    }
  },
  {
    "id": "g5",
    "group": "Grundlagen",
    "roles": [
      "setter",
      "presetter",
      "closer"
    ],
    "min": 5,
    "title": "Nach dem Verkauf: bis zur Auszahlung",
    "video": {
      "title": "Vom Verkauf bis zur Auszahlung",
      "src": ""
    },
    "body": [
      {
        "steps": [
          "Aufmaßtermin: Closer nimmt das Haus auf",
          "In den Checks: Enpal prüft, ob gebaut werden kann",
          "Verkaufstermin: Abschluss + Förderantrag",
          "Montagevorbereitungstermin (ca. 80–90 % gehen durch)",
          "TBK: Enpal zahlt an EnergyEngel",
          "Provision wird ausgezahlt"
        ]
      },
      {
        "h": "Woran es am häufigsten scheitert"
      },
      {
        "ul": [
          "**Vertragsanpassung:** Enpal passt nach dem Verkauf den Vertrag an – der Kunde springt ab.",
          "**Sonderkriterien beim Montagevorbereitungstermin:** Vor Ort zeigt sich etwas, das Enpal nicht abdecken kann.",
          "**Widerruf** innerhalb der 14-Tage-Frist."
        ]
      },
      {
        "h": "Was jeder dagegen tun kann"
      },
      {
        "ul": [
          "**Setter & Presetter:** ehrliche, vollständige Angaben – nichts schönreden.",
          "**Closer:** beim Aufmaß alles aufnehmen, was später zur Vertragsanpassung führen könnte; Kunden auf den Montagevorbereitungstermin vorbereiten.",
          "**Alle:** keine Versprechen machen, die Enpal nicht halten kann."
        ]
      }
    ],
    "articles": [],
    "check": {
      "q": "Woran scheitert es nach dem Verkauf am häufigsten?",
      "o": [
        "Der Kunde findet keinen Montagetermin",
        "Vertragsanpassung durch Enpal oder Sonderkriterien beim Montagevorbereitungstermin",
        "Die Förderung wird grundsätzlich abgelehnt",
        "Der Setter hat den Lead zu spät eingereicht"
      ]
    }
  },
  {
    "id": "s1",
    "group": "Setter",
    "roles": [
      "setter"
    ],
    "min": 6,
    "title": "An der Tür: Einstieg & Lead erfassen",
    "video": {
      "title": "Die ersten 30 Sekunden an der Tür",
      "src": ""
    },
    "body": [
      {
        "p": "An der Tür entscheidet sich in Sekunden, ob ein Gespräch entsteht."
      },
      {
        "steps": [
          "Öffnen: wer du bist und warum du da bist",
          "Frage statt Pitch: „Wie heizen Sie aktuell?“",
          "Interesse finden: Alter, Kosten, Sorgen",
          "Kurz-Check: EFH, Eigentümer, selbst bewohnt",
          "Nächster Schritt: Einwilligung, Anrufzeit, alle Entscheider"
        ]
      },
      {
        "h": "Im Dashboard erfassen"
      },
      {
        "ul": [
          "Unter **Lead erfassen**: Kontaktdaten und Wunsch-Anrufzeit",
          "**Vorqualifizierung an der Tür:** so viele Fragen wie möglich direkt aufnehmen – je mehr, desto schneller legt der Presetter den Termin",
          "Wenn möglich direkt einen freien Slot beim Closer vormerken"
        ]
      },
      {
        "todo": "Gesprächsleitfaden für die Tür (Wortlaut) und Video von Tim folgen."
      }
    ],
    "articles": [],
    "check": {
      "q": "Was muss an der Tür geklärt sein, bevor du den Lead einreichst?",
      "o": [
        "Das genaue Haushaltseinkommen",
        "Einwilligung zur Kontaktaufnahme und ob es ein selbst bewohntes Einfamilienhaus im Eigentum ist",
        "Welches Wärmepumpenmodell der Kunde will",
        "Der Preis der Anlage"
      ]
    }
  },
  {
    "id": "s2",
    "group": "Setter",
    "roles": [
      "setter"
    ],
    "min": 6,
    "title": "Einwände an der Tür",
    "video": {
      "title": "Die 5 häufigsten Einwände an der Tür",
      "src": ""
    },
    "body": [
      {
        "p": "Ein Einwand ist kein Nein – meistens eine Frage oder eine Sorge. Erst verstehen, dann antworten."
      },
      {
        "steps": [
          "Zustimmen: „Verstehe ich.“",
          "Nachfragen: „Was genau meinen Sie?“",
          "Umdrehen: Argument zum Interesse des Kunden",
          "Weiterführen: zurück zum Termin"
        ]
      },
      {
        "h": "Typische Einwände"
      },
      {
        "ul": [
          "**„Zu teuer.“** – Förderung und Ersparnis rechnet der Energieberater beim Termin konkret für Ihr Haus durch.",
          "**„Meine Heizung läuft noch.“** – Dann können Sie jetzt in Ruhe planen statt im Winter unter Druck.",
          "**„Klappt im Altbau nicht.“** – Genau das prüft der Energieberater vor Ort, oft reicht der Tausch einzelner Heizkörper.",
          "**„Muss ich mit meinem Partner besprechen.“** – Dann legen wir den Termin so, dass Sie beide dabei sind.",
          "**„Keine Zeit.“** – Wann passt es besser, unter der Woche oder am Samstag?"
        ]
      },
      {
        "tip": "Die vollständigen Antworten mit Wortlaut stehen im Telefonleitfaden unter „Einwände“."
      },
      {
        "todo": "Einwände aus der FAQ-Gruppe werden ergänzt."
      }
    ],
    "articles": [],
    "check": {
      "q": "Kunde: „Meine Heizung läuft doch noch.“ Was ist die beste Antwort?",
      "o": [
        "„Dann melde ich mich in ein paar Jahren wieder.“",
        "„Super – dann können Sie jetzt in Ruhe planen, statt im Winter unter Zeitdruck, wenn sie ausfällt.“",
        "„Die geht bestimmt bald kaputt.“",
        "„Das ist egal, die muss sowieso raus.“"
      ]
    }
  },
  {
    "id": "p1",
    "group": "Presetter",
    "roles": [
      "presetter",
      "closer"
    ],
    "min": 10,
    "title": "TMVT Frage für Frage",
    "video": {
      "title": "TMVT Frage für Frage",
      "src": ""
    },
    "body": [
      {
        "p": "Das TMVT ist Enpals Vorqualifizierungs-Tool. Jede Frage hat einen Grund – wer ihn kennt, fragt sicherer und bekommt ehrlichere Antworten."
      },
      {
        "h": "Die Blöcke und warum sie gefragt werden"
      },
      {
        "ul": [
          "**Adresse & Eigentum** – Nur Eigentümer, die selbst wohnen, können den Vertrag schließen und Förderung bekommen. K.-o., wenn nicht im Grundbuch (ohne Notartermin/Urkunde) oder nicht selbst bewohnt.",
          "**Gebäude** – Haustyp, Geschosse, Wohnfläche und Baujahr bestimmen die Heizlast. Interessant sind nur Einfamilienhäuser.",
          "**Baumaßnahmen** – Geplante Umbauten ändern Heizlast und Zeitplan.",
          "**Dämmung & Fenster** – entscheiden, wie viel Wärme das Haus braucht.",
          "**Heizung & Verbrauch** – Art, Alter und Verbrauch zeigen Ersparnis und mögliche Boni. Fernwärme und Nachtspeicher fallen raus.",
          "**Energiekosten & PV** – Grundlage der Wirtschaftlichkeitsrechnung.",
          "**Einkommen** – entscheidet über den Einkommensbonus. Darum zuletzt fragen, wenn Vertrauen da ist."
        ]
      },
      {
        "h": "Grenzen, an denen das TMVT blockiert"
      },
      {
        "ul": [
          "Energiekosten Heizung: 5–25 ct/kWh",
          "Strom: 20–50 ct/kWh",
          "Ölverbrauch: max. 7.500 Liter/Jahr",
          "Gas: max. 75.000 kWh/Jahr",
          "Baujahr Haus: 1900–2027"
        ]
      },
      {
        "tip": "Verbrauch immer aus der Jahresabrechnung – geschätzte Werte führen später zu Vertragsanpassungen."
      },
      {
        "todo": "Exakte Antwortoptionen (14 Heizungsarten, Solarthermie, Inbetriebnahme-Regel) werden nach Abgleich mit dem TMVT ergänzt."
      }
    ],
    "articles": [],
    "check": {
      "q": "Warum wird das Haushaltseinkommen abgefragt?",
      "o": [
        "Für die Bonitätsprüfung der Finanzierung",
        "Es entscheidet über den Einkommensbonus bei der Förderung",
        "Damit der Closer den Preis anpassen kann",
        "Für Enpals Newsletter"
      ]
    }
  },
  {
    "id": "p2",
    "group": "Presetter",
    "roles": [
      "presetter"
    ],
    "min": 7,
    "title": "Das Terminierungs-Telefonat",
    "video": {
      "title": "Das perfekte Terminierungs-Telefonat",
      "src": ""
    },
    "body": [
      {
        "steps": [
          "Begrüßung mit Bezug zum Setter",
          "Offene TMVT-Fragen klären",
          "Interesse und Dringlichkeit bestätigen",
          "Termin mit zwei Optionen anbieten",
          "Alle Entscheider an den Tisch"
        ]
      },
      {
        "ul": [
          "Was an der Tür schon aufgenommen wurde, ist im Leitfaden markiert – nicht doppelt fragen.",
          "„Passt Ihnen eher Dienstag 17 Uhr oder Samstag 11 Uhr?“ – zwei Optionen statt offener Frage.",
          "„Wer entscheidet bei Ihnen mit? Dann machen wir den Termin so, dass alle dabei sind.“"
        ]
      },
      {
        "h": "Kontaktversuche"
      },
      {
        "ul": [
          "Bis zu fünf Anrufversuche; beim fünften gehen automatisch WhatsApp und E-Mail an den Kunden.",
          "Rückrufe immer im Dashboard eintragen."
        ]
      },
      {
        "tip": "250 € je gelegtem Termin – aber nur, wenn der Kunde später TBK wird. Ein Termin mit dem falschen Kunden bringt also nichts."
      }
    ],
    "articles": [],
    "check": {
      "q": "Warum sollen beim Termin alle Entscheider dabei sein?",
      "o": [
        "Damit der Termin länger dauert",
        "Weil sonst niemand verbindlich entscheiden kann und ein zweiter Termin nötig wird",
        "Weil Enpal das vorschreibt",
        "Damit der Presetter mehr Provision bekommt"
      ]
    }
  },
  {
    "id": "p3",
    "group": "Presetter",
    "roles": [
      "presetter"
    ],
    "min": 5,
    "title": "Einwände am Telefon",
    "video": {
      "title": "Einwände am Telefon",
      "src": ""
    },
    "body": [
      {
        "p": "Am Telefon fehlt der persönliche Eindruck – umso wichtiger sind kurze, klare Antworten."
      },
      {
        "ul": [
          "**„Schicken Sie mir erst mal Infos per E-Mail.“** – Ein Prospekt hilft wenig, jedes Haus ist anders. Beim Termin gibt es Zahlen für Ihr Haus.",
          "**„Woher haben Sie meine Nummer?“** – Vom Gespräch an der Haustür, mit Ihrer Einwilligung.",
          "**„Ich habe schon ein Angebot.“** – Gut, dann haben Sie einen Vergleich. Ein zweiter Blick kostet nichts.",
          "**„Wir wollten erst nächstes Jahr.“** – Planung, Förderung und Montage brauchen Vorlauf. Der Termin klärt nur, was bei Ihnen möglich ist."
        ]
      },
      {
        "tip": "Alle Einwände mit Wortlaut im Leitfaden – Schaltfläche „Einwände“."
      }
    ],
    "articles": [],
    "check": {
      "q": "Kunde: „Schicken Sie mir erst mal Infos per E-Mail.“ Beste Reaktion?",
      "o": [
        "Infos schicken und den Lead schließen",
        "„Mache ich gern – ehrlich gesagt hilft ein Prospekt aber wenig, weil jedes Haus anders ist. Lassen Sie uns einen kurzen Termin machen.“",
        "„Das machen wir grundsätzlich nicht.“",
        "Auflegen und morgen wieder versuchen"
      ]
    }
  },
  {
    "id": "c1",
    "group": "Closer",
    "roles": [
      "closer"
    ],
    "min": 12,
    "title": "Technik: Vorlauftemperatur, Heizlast, Schall",
    "video": {
      "title": "Technik für Closer",
      "src": ""
    },
    "body": [
      {
        "h": "Vorlauftemperatur"
      },
      {
        "p": "Die Temperatur, mit der das Heizungswasser in Heizkörper oder Fußbodenheizung fließt. Je niedriger, desto effizienter arbeitet die Wärmepumpe. Fußbodenheizungen brauchen wenig, kleine alte Heizkörper viel – oft reicht es, einzelne Heizkörper zu tauschen."
      },
      {
        "h": "Heizlast"
      },
      {
        "p": "Wie viel Wärmeleistung (kW) das Haus am kältesten Tag braucht – abhängig von Wohnfläche, Baujahr, Dämmung und Fenstern. Das Dashboard zeigt eine grobe Schätzung; sie ersetzt keine Heizlastberechnung."
      },
      {
        "h": "COP und JAZ"
      },
      {
        "p": "Der **COP** ist die Effizienz in einem Messpunkt (Laborwert). Die **JAZ** ist die Effizienz übers ganze Jahr im echten Haus. Für den Kunden zählt die JAZ."
      },
      {
        "h": "Schall & Aufstellung"
      },
      {
        "p": "Moderne Außengeräte sind leise; entscheidend sind Aufstellort und Abstand zu den Nachbarn. Den Standort beim Aufmaß gemeinsam mit dem Kunden festlegen."
      },
      {
        "todo": "Datenblätter der Enpal-Geräte folgen: Modelle, Leistungsstufen, Kältemittel, max. Vorlauftemperatur, Schallleistung, SCOP, Einsatzgrenzen."
      }
    ],
    "articles": [],
    "check": {
      "q": "Was macht eine Wärmepumpe effizienter?",
      "o": [
        "Eine möglichst hohe Vorlauftemperatur",
        "Eine möglichst niedrige Vorlauftemperatur",
        "Ein größerer Warmwasserspeicher",
        "Mehr Heizkörper im Keller"
      ]
    }
  },
  {
    "id": "c2",
    "group": "Closer",
    "roles": [
      "closer"
    ],
    "min": 8,
    "title": "Enpal-Leistung & Lieferumfang",
    "video": {
      "title": "Enpals Leistungsumfang erklärt",
      "src": ""
    },
    "body": [
      {
        "ul": [
          "**Wärmegarantie**",
          "**Heizkörperaustausch**, wo nötig",
          "**Bezahlung erst, wenn alles fertig ist**",
          "**Finanzierung** möglich",
          "**Preisspannen** dürfen genannt werden"
        ]
      },
      {
        "tip": "„Bezahlung erst nach Fertigstellung“ nimmt dem Kunden das Risiko – die beste Antwort auf „Und wenn etwas schiefgeht?“."
      },
      {
        "todo": "Lieferumfang, genaue Garantiebedingungen, Preisspannen und Finanzierungskonditionen folgen von Tim."
      }
    ],
    "articles": [],
    "check": {
      "q": "Wann bezahlt der Kunde bei Enpal?",
      "o": [
        "Komplett bei Vertragsunterschrift",
        "50 % Anzahlung, Rest nach Montage",
        "Erst, wenn alles fertig ist",
        "Monatlich ab dem Aufmaßtermin"
      ]
    }
  },
  {
    "id": "c3",
    "group": "Closer",
    "roles": [
      "closer"
    ],
    "min": 12,
    "title": "Förderung & Antrag",
    "video": {
      "title": "Förderung beantragen, Schritt für Schritt",
      "src": ""
    },
    "body": [
      {
        "p": "Offiziell beantragt der Kunde die Förderung. In der Praxis macht es immer der Closer gemeinsam mit dem Kunden – deshalb musst du die Bedingungen sicher kennen."
      },
      {
        "h": "Aufbau der Heizungsförderung (KfW)"
      },
      {
        "ul": [
          "**Grundförderung** – für jeden förderfähigen Heizungstausch",
          "**Geschwindigkeitsbonus** – beim Austausch alter fossiler Heizungen, zeitlich befristet",
          "**Einkommensbonus** – bei niedrigerem Haushaltseinkommen (darum die Einkommensfrage im TMVT)",
          "**Effizienzbonus** – z. B. bei natürlichem Kältemittel"
        ]
      },
      {
        "tip": "Kunden mit nur Grundförderung (laut Team ca. 8.400 €) sind meist uninteressant – die Boni machen den Unterschied."
      },
      {
        "todo": "Aktuelle Fördersätze, Höchstbeträge, Einkommensgrenzen und die richtige Reihenfolge von Vertrag und Antrag werden mit der KfW abgeglichen und hier ergänzt."
      }
    ],
    "articles": [],
    "check": {
      "q": "Wer stellt den Förderantrag in der Praxis?",
      "o": [
        "Der Setter",
        "Enpal automatisch",
        "Der Closer zusammen mit dem Kunden (offiziell ist der Kunde Antragsteller)",
        "Der Kunde allein nach der Montage"
      ]
    }
  },
  {
    "id": "c4",
    "group": "Closer",
    "roles": [
      "closer"
    ],
    "min": 6,
    "title": "Finanzierung & Preise",
    "video": {
      "title": "Finanzierung und Preise souverän besprechen",
      "src": ""
    },
    "body": [
      {
        "p": "Preisspannen dürfen genannt werden. Viele Kunden scheuen eine große Einmalzahlung – die Finanzierung macht die Entscheidung leichter."
      },
      {
        "ul": [
          "Gesamtpreis immer zusammen mit Förderung und Ersparnis zeigen",
          "Monatsrate den heutigen Heizkosten gegenüberstellen",
          "Bezahlung erst nach Fertigstellung betonen"
        ]
      },
      {
        "todo": "Preisspannen und Finanzierungskonditionen folgen."
      }
    ],
    "articles": [],
    "check": {
      "q": "Wie präsentierst du den Preis am besten?",
      "o": [
        "Nur den Bruttopreis nennen",
        "Preis zusammen mit Förderung, Ersparnis und auf Wunsch der Monatsrate zeigen",
        "Den Preis erst nach der Unterschrift nennen",
        "Die Konkurrenz schlechtreden"
      ]
    }
  },
  {
    "id": "c5",
    "group": "Closer",
    "roles": [
      "closer"
    ],
    "min": 10,
    "title": "Closing & Dringlichkeit",
    "video": {
      "title": "Closing: Bedarf, Dringlichkeit, Abschluss",
      "src": ""
    },
    "body": [
      {
        "steps": [
          "Bedarf bestätigen: „Was ist Ihnen am wichtigsten?“",
          "Lösung für dieses Haus zeigen",
          "Zahlen: Förderung, Ersparnis, Preis",
          "Dringlichkeit: Ausfallrisiko, Kosten, Vorlauf",
          "Abschlussfrage",
          "Einwände klären"
        ]
      },
      {
        "h": "Einwände im Verkaufstermin"
      },
      {
        "ul": [
          "**Altbau:** Vorlauftemperatur geprüft, ggf. Heizkörpertausch",
          "**Lautstärke:** Aufstellort gemeinsam festgelegt",
          "**Partner fehlt:** hätte im Vorfeld geklärt sein müssen – zeitnah Folgetermin mit beiden",
          "**Zu teuer:** Förderung + Ersparnis + Rate"
        ]
      },
      {
        "todo": "Closing-Leitfaden mit Wortlaut folgt."
      }
    ],
    "articles": [],
    "check": {
      "q": "Im Verkaufstermin fehlt der Partner, der mitentscheidet. Was tust du?",
      "o": [
        "Trotzdem unterschreiben lassen",
        "Zeitnah einen Folgetermin mit beiden vereinbaren",
        "Den Lead als verloren markieren",
        "Sagen, dass das Angebot sonst verfällt"
      ]
    }
  },
  {
    "id": "c6",
    "group": "Closer",
    "roles": [
      "closer"
    ],
    "min": 6,
    "title": "Nach dem Termin: Rückmeldung & EPP",
    "video": {
      "title": "Vertragsanpassungen vermeiden",
      "src": ""
    },
    "body": [
      {
        "ul": [
          "Nach jedem Termin mit Dashboard-Leads ist eine **Rückmeldung Pflicht** – sonst werden deine Slots für neue Leads pausiert.",
          "Ab dem Ersttermin pflegst du den Kunden im **Enpal-Partnerportal (EPP)**.",
          "Beim Aufmaß alles aufnehmen, was zu Vertragsanpassungen führen kann: Heizraum, Zugang, Elektrik, Aufstellort.",
          "Kunden auf den Montagevorbereitungstermin vorbereiten."
        ]
      },
      {
        "todo": "Checkliste „Sonderkriterien beim Montagevorbereitungstermin“ folgt."
      }
    ],
    "articles": [],
    "check": {
      "q": "Was passiert, wenn du die Rückmeldung nach einem Termin nicht abgibst?",
      "o": [
        "Nichts",
        "Deine Slots werden für neue Leads pausiert, bis alles erledigt ist",
        "Du verlierst automatisch die Provision",
        "Der Lead wird gelöscht"
      ]
    }
  }
];

export const TESTS: Record<MaRole, TestQuestion[]> = {
  "setter": [
    {
      "q": "Welcher Kunde passt zu uns?",
      "o": [
        "Mieter in einem Einfamilienhaus mit Gasheizung",
        "Eigentümer eines selbst bewohnten Einfamilienhauses mit alter Ölheizung",
        "Eigentümer eines Mehrfamilienhauses",
        "Einfamilienhaus mit Fernwärme"
      ]
    },
    {
      "q": "Wann bekommst du als Setter deine Provision?",
      "o": [
        "Sobald der Lead eingereicht ist",
        "Sobald der Termin gelegt ist",
        "Wenn der Kunde TBK ist und EnergyEngel bezahlt wurde",
        "Bei Vertragsunterschrift"
      ]
    },
    {
      "q": "Kunde: „Meine Heizung läuft doch noch.“ Beste Antwort?",
      "o": [
        "„Dann melde ich mich in ein paar Jahren.“",
        "„Dann können Sie jetzt in Ruhe planen, statt im Winter unter Druck.“",
        "„Die ist bestimmt bald kaputt.“",
        "„Das ist egal.“"
      ]
    },
    {
      "q": "Welche Aussage erzeugt ehrliche Dringlichkeit?",
      "o": [
        "„Nur heute gibt es diesen Preis.“",
        "„Jeder Winter mit der alten Heizung kostet Geld, das Sie sparen könnten.“",
        "„Ihr Nachbar hat schon unterschrieben.“",
        "„Morgen gibt es keine Förderung mehr.“"
      ]
    },
    {
      "q": "Kunde will die alte Ölheizung zusätzlich behalten. Was gilt?",
      "o": [
        "Passt, einfach einreichen",
        "Passt nicht – Sonderlösungen fallen raus",
        "Passt nur mit Fußbodenheizung",
        "Entscheidet der Setter"
      ]
    },
    {
      "q": "Kunde fragt: „Funktioniert das in meinem Altbau?“",
      "o": [
        "„Nein, nur im Neubau.“",
        "„Das prüft unser Energieberater vor Ort – oft reicht der Tausch einzelner Heizkörper.“",
        "„Ja, immer, ohne Ausnahme.“",
        "„Das weiß ich nicht.“ und Gespräch beenden"
      ]
    },
    {
      "q": "Ein Kunde hat eine Nachtspeicherheizung. Was gilt?",
      "o": [
        "Passt, da Strom",
        "Fällt raus",
        "Passt nur mit PV",
        "Nur mit Einkommensbonus"
      ]
    },
    {
      "q": "„Die Gasrechnung war letztes Jahr ein Schock.“ Welches Interesse steckt dahinter?",
      "o": [
        "Umwelt",
        "Kosten senken",
        "Wert der Immobilie",
        "Technik"
      ]
    }
  ],
  "presetter": [
    {
      "q": "Der Kunde nennt 55 ct/kWh Strom. Was passiert im TMVT?",
      "o": [
        "Wird übernommen",
        "Wird blockiert – erlaubt sind 20–50 ct, Abrechnung prüfen",
        "Wird automatisch auf 50 gesetzt",
        "Egal, wird nicht geprüft"
      ]
    },
    {
      "q": "Kunde ist nicht im Grundbuch und hat keinen Notartermin. Was gilt?",
      "o": [
        "Kein Problem",
        "K.-o.-Kriterium",
        "Nur Grundförderung",
        "Closer entscheidet beim Termin"
      ]
    },
    {
      "q": "Warum wird das Haushaltseinkommen abgefragt?",
      "o": [
        "Bonitätsprüfung",
        "Einkommensbonus bei der Förderung",
        "Preisgestaltung",
        "Statistik"
      ]
    },
    {
      "q": "Woher sollte der Jahresverbrauch kommen?",
      "o": [
        "Schätzung des Kunden",
        "Aus der Jahresabrechnung",
        "Durchschnittswert aus dem Internet",
        "Vom Setter"
      ]
    },
    {
      "q": "Kunde: „Schicken Sie mir erst Infos per E-Mail.“",
      "o": [
        "Mail schicken, Lead schließen",
        "Wunsch anerkennen und zum Termin zurückführen: Zahlen gibt es nur für sein Haus",
        "Auflegen",
        "Preis am Telefon nennen"
      ]
    },
    {
      "q": "Wann wird deine Provision von 250 € je Termin ausgezahlt?",
      "o": [
        "Sofort nach dem Telefonat",
        "Nach dem Aufmaßtermin",
        "Wenn der Kunde TBK ist",
        "Nie bei Eigenleads"
      ]
    },
    {
      "q": "Wer sollte beim Termin dabei sein?",
      "o": [
        "Nur der Anrufer",
        "Alle Entscheider",
        "Der Setter",
        "Ein Nachbar"
      ]
    },
    {
      "q": "Kunde: „Wir wollten eigentlich erst nächstes Jahr.“",
      "o": [
        "„Dann rufe ich nächstes Jahr an.“",
        "„Planung, Förderung und Montage brauchen Vorlauf – der Termin klärt nur, was bei Ihnen möglich ist.“",
        "„Dann ist die Förderung weg.“",
        "Lead als verloren markieren"
      ]
    }
  ],
  "closer": [
    {
      "q": "Was macht die Wärmepumpe effizienter?",
      "o": [
        "Hohe Vorlauftemperatur",
        "Niedrige Vorlauftemperatur",
        "Großer Pufferspeicher",
        "Mehr Heizkörper im Keller"
      ]
    },
    {
      "q": "Welche Kennzahl ist für den Kunden aussagekräftiger?",
      "o": [
        "COP (Laborwert)",
        "JAZ (Jahreswert im echten Haus)",
        "Nennleistung in kW",
        "Schallleistung"
      ]
    },
    {
      "q": "Wer stellt den Förderantrag in der Praxis?",
      "o": [
        "Der Setter",
        "Enpal automatisch",
        "Der Closer mit dem Kunden",
        "Der Kunde nach der Montage"
      ]
    },
    {
      "q": "Kunde bekommt nur die Grundförderung. Wie ist das einzuordnen?",
      "o": [
        "Ideal",
        "Meist uninteressant",
        "Ausschlusskriterium laut TMVT",
        "Egal"
      ]
    },
    {
      "q": "Kunde: „Und wenn etwas schiefgeht?“ Stärkstes Argument?",
      "o": [
        "„Passiert nie.“",
        "Bezahlung erst, wenn alles fertig ist – plus Wärmegarantie",
        "„Dann melden Sie sich bei Enpal.“",
        "Rabatt anbieten"
      ]
    },
    {
      "q": "Woran scheitert es zwischen Verkauf und TBK am häufigsten?",
      "o": [
        "Montagetermin",
        "Vertragsanpassung oder Sonderkriterien beim Montagevorbereitungstermin",
        "Förderung grundsätzlich abgelehnt",
        "Setter zu spät"
      ]
    },
    {
      "q": "Was passiert, wenn die Rückmeldung nach einem Termin fehlt?",
      "o": [
        "Nichts",
        "Slots werden pausiert",
        "Provision verfällt",
        "Lead wird gelöscht"
      ]
    },
    {
      "q": "Im Verkaufstermin fehlt der Partner, der mitentscheidet.",
      "o": [
        "Trotzdem unterschreiben lassen",
        "Zeitnah Folgetermin mit beiden",
        "Lead verloren",
        "Druck machen"
      ]
    },
    {
      "q": "Welcher Hinweis erzeugt ehrliche Dringlichkeit?",
      "o": [
        "„Nur heute dieser Preis.“",
        "„Planung und Montage brauchen Vorlauf – wer jetzt startet, heizt vor dem nächsten Winter mit der Wärmepumpe.“",
        "„Alle Nachbarn haben schon eine.“",
        "„Morgen ist die Förderung weg.“"
      ]
    },
    {
      "q": "Wie präsentierst du den Preis?",
      "o": [
        "Nur Bruttopreis",
        "Mit Förderung, Ersparnis und Rate",
        "Erst nach Unterschrift",
        "Konkurrenz schlechtreden"
      ]
    }
  ]
};

/** Module im Lernpfad einer Rolle, in Reihenfolge */
export const pathFor = (role: MaRole) => MODULES.filter((m) => m.roles.includes(role));
export const moduleById = (id: string) => MODULES.find((m) => m.id === id);
/** Ein Modul ist offen, wenn alle davor im Pfad erledigt sind */
export const moduleOpen = (role: MaRole, id: string, done: ReadonlySet<string>) => {
  const p = pathFor(role);
  const i = p.findIndex((m) => m.id === id);
  return i >= 0 && p.slice(0, i).every((m) => done.has(m.id));
};
export const passMark = (total: number) => Math.ceil(total * PASS_RATIO);

"use client";

import KalenderView from "@/components/closer/KalenderView";
import TermineView from "@/components/closer/TermineView";
import VertraegeView from "@/components/contracts/VertraegeView";
import EventsView from "@/components/events/EventsView";
import NeuView from "@/components/misc/NeuView";
import OverviewView from "@/components/overview/OverviewView";
import AuszahlungenView from "@/components/payouts/AuszahlungenView";
import RanglisteView from "@/components/ranking/RanglisteView";
import LeitfadenView from "@/components/presetter/LeitfadenView";
import ErfassenView from "@/components/setter/ErfassenView";
import PipelineView from "@/components/pipeline/PipelineView";
import StammdatenView from "@/components/profile/StammdatenView";
import TeamView from "@/components/team/TeamView";
import { REACT_VIEWS, useStore } from "@/lib/store";

const VIEWS: Record<string, () => React.ReactNode> = {
  uebersicht: () => <OverviewView />,
  leads: () => <PipelineView />,
  team: () => <TeamView />,
  stammdaten: () => <StammdatenView />,
  events: () => <EventsView />,
  vertraege: () => <VertraegeView />,
  auszahlungen: () => <AuszahlungenView />,
  rangliste: () => <RanglisteView />,
  neu: () => <NeuView />,
  kalender: () => <KalenderView />,
  termine: () => <TermineView />,
  leitfaden: () => <LeitfadenView />,
  erfassen: () => <ErfassenView />,
};

/* Zeigt die bereits auf React umgestellten Ansichten; alle anderen rendert
   noch die Übergangsschicht in <main id="view">. */
export default function ReactViews() {
  const { ui } = useStore();
  const active = REACT_VIEWS.has(ui.view) ? VIEWS[ui.view] : null;
  return (
    <main className="ee-content" hidden={!active}>
      {active?.()}
    </main>
  );
}

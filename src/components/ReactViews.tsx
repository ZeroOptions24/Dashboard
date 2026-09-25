"use client";

import OverviewView from "@/components/overview/OverviewView";
import PipelineView from "@/components/pipeline/PipelineView";
import StammdatenView from "@/components/profile/StammdatenView";
import TeamView from "@/components/team/TeamView";
import { REACT_VIEWS, useStore } from "@/lib/store";

const VIEWS: Record<string, () => React.ReactNode> = {
  uebersicht: () => <OverviewView />,
  leads: () => <PipelineView />,
  team: () => <TeamView />,
  stammdaten: () => <StammdatenView />,
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

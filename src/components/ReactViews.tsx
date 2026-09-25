"use client";

import PipelineView from "@/components/pipeline/PipelineView";
import { REACT_VIEWS, useStore } from "@/lib/store";

const VIEWS: Record<string, () => React.ReactNode> = {
  leads: () => <PipelineView />,
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

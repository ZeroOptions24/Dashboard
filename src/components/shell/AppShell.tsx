"use client";

import { useEffect } from "react";
import DataSource from "@/components/DataSource";
import KalenderView from "@/components/closer/KalenderView";
import TermineView from "@/components/closer/TermineView";
import VertraegeView from "@/components/contracts/VertraegeView";
import DrawerHost from "@/components/drawers/Drawers";
import EventsView from "@/components/events/EventsView";
import NeuView from "@/components/misc/NeuView";
import OverviewView from "@/components/overview/OverviewView";
import AuszahlungenView from "@/components/payouts/AuszahlungenView";
import PipelineView from "@/components/pipeline/PipelineView";
import LeitfadenView from "@/components/presetter/LeitfadenView";
import StammdatenView from "@/components/profile/StammdatenView";
import RanglisteView from "@/components/ranking/RanglisteView";
import ErfassenView from "@/components/setter/ErfassenView";
import { BottomNav, MoreSheet, SideMe, SideNav } from "@/components/shell/Nav";
import Toasts from "@/components/shell/Toasts";
import TopBar, { NotifPanel } from "@/components/shell/TopBar";
import TeamView from "@/components/team/TeamView";
import { allowedView } from "@/lib/nav";
import { viewableRoles } from "@/lib/roles";
import { notify, store, useStore } from "@/lib/store";
import { closeOverlays } from "@/lib/ui";
import { refreshContractSummary } from "@/lib/live";
import type { Role } from "@/lib/types";

const VIEWS: Record<string, () => React.ReactNode> = {
  uebersicht: () => <OverviewView />,
  erfassen: () => <ErfassenView />,
  leitfaden: () => <LeitfadenView />,
  leads: () => <PipelineView />,
  kalender: () => <KalenderView />,
  termine: () => <TermineView />,
  rangliste: () => <RanglisteView />,
  auszahlungen: () => <AuszahlungenView />,
  vertraege: () => <VertraegeView />,
  events: () => <EventsView />,
  stammdaten: () => <StammdatenView />,
  team: () => <TeamView />,
  neu: () => <NeuView />,
};

/** Das ganze Dashboard nach dem Login: Seitenleiste, Kopfzeile, Ansicht, Overlays.
 *  Der Store lebt nur im Browser – deshalb wird er erst nach dem Laden mit der
 *  Sitzung befüllt und vorher nur das leere Gerüst gezeigt (kein Datenmix auf dem Server). */
export default function AppShell({
  roles,
  startRole,
  name,
  view,
  isAdmin,
  banner,
}: {
  roles: Role[];
  startRole: Role;
  name: string;
  view?: string;
  isAdmin: boolean;
  banner?: React.ReactNode;
}) {
  const { session, ui, overlay } = useStore();

  const rolesKey = roles.join(",");
  useEffect(() => {
    store.session = { name, roles: rolesKey.split(",") as Role[] };
    store.ui.role = startRole;
    store.ui.view = allowedView(startRole, view ?? store.ui.view);
    notify();
    void refreshContractSummary();
  }, [name, rolesKey, startRole, view]);

  /* Escape schließt Seitenleisten und Menüs */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeOverlays();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const ready = !!session;
  return (
    <>
      <div className="ee-shell" data-component="AppShell">
        <aside className="ee-side" data-component="SideNav" aria-label="Hauptnavigation">
          <div>
            <div className="ee-brand">
              <div className="ee-brand__mark" aria-hidden="true">
                E
              </div>
              <div>
                <div className="ee-brand__name">
                  Energy<span>Engel</span>
                </div>
                <div className="ee-brand__sub">MB-Dashboard</div>
              </div>
            </div>
          </div>
          {ready && <SideNav />}
          <div className="ee-side__foot">
            <div className="ee-mascot" data-component="MascotSlot">
              Maskottchen
              <br />
              Chibi-Engel
              <br />
              (Platzhalter)
            </div>
            {ready && <SideMe />}
          </div>
        </aside>
        <div className="ee-main">
          {ready && <TopBar switchable={viewableRoles(roles)} name={name} demo={isAdmin} />}
          {banner}
          <main className="ee-content" id="view" tabIndex={-1}>
            {ready ? VIEWS[ui.view]?.() : null}
          </main>
        </div>
      </div>
      {ready && (
        <>
          <BottomNav />
          <div className={overlay.drawerOpen || overlay.more ? "ee-sheet-backdrop is-open" : "ee-sheet-backdrop"} id="backdrop" onClick={closeOverlays} />
          <MoreSheet />
          <NotifPanel />
          <DrawerHost />
          <Toasts />
          <DataSource />
        </>
      )}
    </>
  );
}

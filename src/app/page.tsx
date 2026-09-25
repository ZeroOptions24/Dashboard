import PrototypeBoot from "@/components/PrototypeBoot";
import ReactViews from "@/components/ReactViews";
import DataSource from "@/components/DataSource";

/* Grundgerüst (AppShell) aus dem UI-Prototyp. Die Inhalte der leeren Container
   (Navigation, Ansicht, Drawer …) rendert src/legacy/prototype.js;
   bereits umgestellte Ansichten rendert <ReactViews />. */
export default function Home() {
  return (
    <>
      <div className="ee-shell" data-component="AppShell">
        <aside className="ee-side" data-component="SideNav" aria-label="Hauptnavigation">
          <div>
            <div className="ee-brand">
              <div className="ee-brand__mark" aria-hidden="true">E</div>
              <div>
                <div className="ee-brand__name">
                  Energy<span>Engel</span>
                </div>
                <div className="ee-brand__sub">MB-Dashboard</div>
              </div>
            </div>
          </div>
          <nav className="ee-nav" id="sideNav"></nav>
          <div className="ee-side__foot">
            <div className="ee-mascot" data-component="MascotSlot">
              Maskottchen
              <br />
              Chibi-Engel
              <br />
              (Platzhalter)
            </div>
            <div className="ee-me" id="sideMe"></div>
          </div>
        </aside>

        <div className="ee-main">
          <header className="ee-top" data-component="TopBar">
            <div className="ee-top__brand">
              <div className="ee-brand__mark" aria-hidden="true">E</div>
            </div>
            <div className="ee-top__title" id="topTitle"></div>
            <div className="ee-top__spacer"></div>
            <span className="ee-proto">Prototyp · Beispieldaten</span>
            <div className="ee-role" data-component="RoleSwitch">
              <span className="ee-role__label">Ansicht als</span>
              <div className="ee-seg" role="group" aria-label="Rolle wechseln" id="roleSeg"></div>
              <label className="sr" htmlFor="roleSelect">
                Rolle wechseln
              </label>
              <select id="roleSelect"></select>
            </div>
            <button
              className="ee-iconbtn"
              id="themeBtn"
              data-component="ThemeToggle"
              aria-label="Hell-/Dunkelmodus wechseln"
            ></button>
            <button className="ee-iconbtn" id="bellBtn" aria-label="Benachrichtigungen" aria-expanded="false"></button>
          </header>
          <main className="ee-content" id="view" tabIndex={-1}></main>
          <ReactViews />
        </div>
      </div>

      <nav className="ee-bottom" id="bottomNav" data-component="BottomNav" aria-label="Navigation"></nav>
      <div className="ee-sheet-backdrop" id="backdrop"></div>
      <div className="ee-more" id="moreSheet" data-component="MoreSheet" role="dialog" aria-label="Weitere Bereiche"></div>
      <div className="ee-notif" id="notifPanel" data-component="NotifPanel" hidden></div>
      <aside className="ee-drawer" id="drawer" data-component="Drawer" aria-hidden="true"></aside>
      <div className="ee-toasts" id="toasts" aria-live="polite"></div>
      <input id="copyFallback" className="sr" aria-hidden="true" tabIndex={-1} />

      <PrototypeBoot />
      <DataSource />
    </>
  );
}

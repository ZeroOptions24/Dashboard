"use client";

import Icon from "@/components/ui/Icon";
import { pendingFeedback } from "@/lib/appointments";
import { navFor, ROLE_LABEL, SHORT_LABEL, type NavItem } from "@/lib/nav";
import { useStore } from "@/lib/store";
import { go, toggleMore } from "@/lib/ui";
import { useDashboard } from "@/lib/useDashboard";
import { useOpenTodoCount } from "@/components/overview/Cards";

/** Zähler an Menüpunkten: offene Verträge, fällige Closer-Rückmeldungen */
function Badge({ view }: { view: string }) {
  const { data, role, me, now } = useDashboard();
  const { live } = useStore();
  let n = 0;
  if (view === "vertraege" && live.contracts) n = role === "admin" ? live.contracts.openAll + live.contracts.questions : live.contracts.openMine;
  if (view === "termine" && role === "closer") n = pendingFeedback(data.APPTS, me, now).length;
  if (view === "todos") return <TodoBadge />;
  return n ? <span className="ee-nav__badge">{n}</span> : null;
}

/** Offene To-Dos (überfällig + heute) */
function TodoBadge() {
  const n = useOpenTodoCount();
  return n ? <span className="ee-nav__badge">{n > 99 ? "99+" : n}</span> : null;
}

function NavButton({ item: [v, l, i] }: { item: NavItem }) {
  const { ui } = useDashboard();
  return (
    <button className={v === "neu" ? "ee-nav__item ee-nav__item--ghost" : "ee-nav__item"} aria-current={ui.view === v ? "page" : undefined} onClick={() => go(v)}>
      <Icon name={i} />
      <span>{l}</span>
      <Badge view={v} />
    </button>
  );
}

/** Seitenleiste links (Desktop) */
export function SideNav() {
  const { role } = useDashboard();
  const { session } = useStore();
  return (
    <nav className="ee-nav" id="sideNav">
      <div className="ee-nav__label">{ROLE_LABEL[role]}</div>
      {navFor(role, session?.locked).map((item) => (
        <NavButton key={item[0]} item={item} />
      ))}
    </nav>
  );
}

/** Person unten in der Seitenleiste: die angemeldete Person in ihrer eigenen Rolle,
 *  sonst (Admin schaut in eine andere Rolle) die Beispielperson dieser Rolle */
export function SideMe() {
  const { session } = useStore();
  const { role, person, me } = useDashboard();
  const own = !!session?.roles.includes(role);
  const name = own ? session!.name : person(me).name;
  const initials = own
    ? name
        .split(" ")
        .map((x) => x[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : person(me).initials;
  return (
    <div className="ee-me" id="sideMe">
      <div className="ee-avatar">{initials}</div>
      <div>
        <div className="ee-me__name">{name}</div>
        <div className="ee-me__role">
          {ROLE_LABEL[role]}
          {own ? "" : " · Beispielkonto"}
        </div>
      </div>
    </div>
  );
}

/** Untere Leiste (Handy): vier Hauptpunkte + „Mehr“ */
export function BottomNav() {
  const { role, ui } = useDashboard();
  const { session } = useStore();
  const items = navFor(role, session?.locked),
    nMain = items.some((i) => i[0] === "todos") ? 5 : 4,
    main = items.slice(0, nMain),
    rest = items.slice(nMain);
  return (
    <nav className="ee-bottom" id="bottomNav" data-component="BottomNav" aria-label="Navigation" style={{ gridTemplateColumns: `repeat(${main.length + (rest.length ? 1 : 0)}, minmax(0, 1fr))` }}>
      {main.map(([v, l, i]) => (
        <button key={v} aria-current={ui.view === v ? "page" : undefined} onClick={() => go(v)}>
          <Icon name={i} />
          <span>{SHORT_LABEL[l] || l}</span>
          <Badge view={v} />
        </button>
      ))}
      {rest.length > 0 && (
        <button aria-current={rest.some((i) => i[0] === ui.view) ? "page" : undefined} onClick={() => toggleMore(true)}>
          <Icon name="more" />
          <span>Mehr</span>
        </button>
      )}
    </nav>
  );
}

/** „Mehr“-Menü (Handy) mit den übrigen Punkten */
export function MoreSheet() {
  const { overlay, session } = useStore();
  const { role } = useDashboard();
  const items = navFor(role, session?.locked);
  return (
    <div className={overlay.more ? "ee-more is-open" : "ee-more"} id="moreSheet" data-component="MoreSheet" role="dialog" aria-label="Weitere Bereiche">
      <div className="ee-more__grip" />
      {items.slice(items.some((i) => i[0] === "todos") ? 5 : 4).map((item) => (
        <NavButton key={item[0]} item={item} />
      ))}
    </div>
  );
}

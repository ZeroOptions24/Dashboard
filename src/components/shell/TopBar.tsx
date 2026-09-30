"use client";

import { useEffect, useSyncExternalStore } from "react";
import UserMenu from "@/components/auth/UserMenu";
import Icon from "@/components/ui/Icon";
import { StatusChip } from "@/components/ui/Chips";
import { markAllNotifRead, simulatePipedriveUpdate } from "@/lib/actions";
import { NAV, ROLE_LABEL } from "@/lib/nav";
import { useStore, LIVE } from "@/lib/store";
import { setRole, toast, toggleNotif } from "@/lib/ui";
import { useDashboard } from "@/lib/useDashboard";
import type { Role } from "@/lib/types";

/* ---------- Hell/Dunkel: Wahl im Browser gespeichert, sonst Systemeinstellung ---------- */
const themeListeners = new Set<() => void>();
const storedTheme = () => {
  try {
    return localStorage.getItem("ee-theme");
  } catch {
    return null;
  }
};
const isDark = () => {
  const t = storedTheme();
  return t ? t === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
};
function subscribeTheme(cb: () => void) {
  themeListeners.add(cb);
  const m = matchMedia("(prefers-color-scheme: dark)");
  m.addEventListener("change", cb);
  return () => {
    themeListeners.delete(cb);
    m.removeEventListener("change", cb);
  };
}

function ThemeToggle() {
  const dark = useSyncExternalStore(subscribeTheme, isDark, () => false);
  return (
    <button
      className="ee-iconbtn"
      id="themeBtn"
      data-component="ThemeToggle"
      aria-label="Hell-/Dunkelmodus wechseln"
      onClick={() => {
        const next = dark ? "light" : "dark";
        try {
          localStorage.setItem("ee-theme", next);
        } catch {}
        document.documentElement.setAttribute("data-theme", next);
        themeListeners.forEach((l) => l());
      }}
    >
      <Icon name={dark ? "sun" : "moon"} />
    </button>
  );
}

/* ---------- Benachrichtigungen ---------- */
function Bell() {
  const { data, me } = useDashboard();
  const { overlay } = useStore();
  const n = (data.NOTIFS[me] || []).filter((x) => x.unread).length;
  return (
    <button
      className="ee-iconbtn"
      id="bellBtn"
      aria-label="Benachrichtigungen"
      aria-expanded={overlay.notif}
      onClick={(e) => {
        e.stopPropagation();
        toggleNotif();
      }}
    >
      <Icon name="bell" />
      {n ? <span className="ee-iconbtn__dot">{n}</span> : null}
    </button>
  );
}

export function NotifPanel() {
  const { data, me, role } = useDashboard();
  const { overlay } = useStore();
  const list = data.NOTIFS[me] || [];
  /* Klick außerhalb schließt das Panel */
  useEffect(() => {
    if (!overlay.notif) return;
    const close = (e: MouseEvent) => {
      if (!(e.target as Element).closest("#notifPanel, #bellBtn")) toggleNotif(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [overlay.notif]);
  return (
    <div className="ee-notif" id="notifPanel" data-component="NotifPanel" hidden={!overlay.notif}>
      <div className="ee-notif__head">
        <h3>Benachrichtigungen</h3>
        <button className="ee-btn ee-btn--ghost ee-btn--sm" onClick={markAllNotifRead}>
          Alle gelesen
        </button>
      </div>
      {list.length ? (
        list.map((n, i) => (
          <div key={i} className={n.unread ? "ee-notif__item is-new" : "ee-notif__item"}>
            <div className="ee-notif__icon">
              <Icon name={n.status ? "bolt" : "bell"} small />
            </div>
            <div>
              <div className="ee-notif__text">{n.t}</div>
              <div className="ee-notif__time">
                {n.time}{" "}
                {n.status ? (
                  <>
                    · <StatusChip status={n.status} />
                  </>
                ) : null}
              </div>
            </div>
          </div>
        ))
      ) : (
        <div className="ee-notif__item muted">Keine Benachrichtigungen.</div>
      )}
      {role === "setter" && !LIVE && (
        <div className="ee-notif__foot">
          <button
            className="ee-btn ee-btn--sm ee-btn--block"
            onClick={() => {
              const k = simulatePipedriveUpdate();
              toast(k ? `Pipedrive: ${k} ist jetzt „Termin gelegt“` : "Kein passender Lead für die Demo", k ? "bolt" : "info");
            }}
          >
            <Icon name="bolt" small /> Demo: Statusänderung aus Pipedrive simulieren
          </button>
        </div>
      )}
    </div>
  );
}

/** Kopfzeile: Titel, Prototyp-Hinweis, „Ansicht als“ (nur Admins), Hell/Dunkel, Glocke, Benutzer */
/** switchable: Rollen, zwischen denen die Person wechseln darf (Admins: alle, sonst die eigenen) */
export default function TopBar({ switchable, name, demo }: { switchable: Role[]; name: string; demo: boolean }) {
  const { role, ui } = useDashboard();
  const cur = NAV[role].find((i) => i[0] === ui.view);
  return (
    <header className="ee-top" data-component="TopBar">
      <div className="ee-top__brand">
        <div className="ee-brand__mark" aria-hidden="true">
          E
        </div>
      </div>
      <div className="ee-top__title" id="topTitle">
        {cur ? cur[1] : ""}
      </div>
      <div className="ee-top__spacer" />
      {!LIVE && <span className="ee-proto">Prototyp · Beispieldaten</span>}
      <div className="ee-role" data-component="RoleSwitch" hidden={switchable.length < 2}>
        <span className="ee-role__label">{demo ? "Ansicht als" : "Rolle"}</span>
        <div className="ee-seg" role="group" aria-label="Rolle wechseln" id="roleSeg">
          {switchable.map((r) => (
            <button key={r} aria-pressed={role === r} onClick={() => setRole(r)}>
              {ROLE_LABEL[r]}
            </button>
          ))}
        </div>
        <label className="sr" htmlFor="roleSelect">
          Rolle wechseln
        </label>
        <select id="roleSelect" value={role} onChange={(e) => setRole(e.target.value as Role)}>
          {switchable.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </select>
      </div>
      <ThemeToggle />
      <Bell />
      <UserMenu name={name} />
    </header>
  );
}

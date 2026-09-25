"use client";

import Icon from "@/components/ui/Icon";
import { authClient } from "@/lib/auth-client";

/** Angemeldete Person + Abmelden (Kopfzeile). */
export default function UserMenu({ name }: { name: string }) {
  return (
    <div className="ee-userbar">
      <span className="muted" style={{ fontSize: ".85rem", whiteSpace: "nowrap" }} data-hide-sm="">
        {name}
      </span>
      <button
        className="ee-iconbtn"
        aria-label="Abmelden"
        title="Abmelden"
        onClick={async () => {
          await authClient.signOut();
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- bewusst voller Neuladen: Daten der Sitzung aus dem Speicher entfernen
          window.location.href = "/login";
        }}
      >
        <Icon name="ext" />
      </button>
    </div>
  );
}

"use client";

import Icon from "@/components/ui/Icon";
import { useStore } from "@/lib/store";

/** Kurzmeldungen unten */
export default function Toasts() {
  const { toasts } = useStore();
  return (
    <div className="ee-toasts" id="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="ee-toast" data-component="Toast">
          <Icon name={t.icon} />
          <span>{t.msg}</span>
        </div>
      ))}
    </div>
  );
}

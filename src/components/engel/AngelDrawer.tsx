"use client";

import { DrawerHead } from "@/components/drawers/Drawers";
import Icon from "@/components/ui/Icon";
import { angelAvatar } from "@/components/engel/EngelCanvas";
import { faqFor, stepsFor } from "@/lib/engel";
import { ROLE_LABEL } from "@/lib/nav";
import { useStore } from "@/lib/store";
import { tourStart } from "@/lib/ui";
import { useDashboard } from "@/lib/useDashboard";

/** „Frag den Engel“: Rundgang starten und häufige Fragen zur aktuellen Rolle */
export default function AngelDrawer() {
  const { role, firstName } = useDashboard();
  const { session } = useStore();
  const steps = stepsFor(role, session?.locked);
  const faq = faqFor(role, session?.locked);
  const img = angelAvatar();
  return (
    <>
      <DrawerHead title="Frag den Engel" sub={`${ROLE_LABEL[role]}-Ansicht`} />
      <div className="ee-drawer__body" data-component="AngelHelp">
        <div className="ee-angelhi">
          {/* eslint-disable-next-line @next/next/no-img-element -- Momentaufnahme des 3D-Engels (data-URL) */}
          {img ? <img src={img} alt="" /> : null}
          <p>Hi {firstName}! Ich zeige dir, was wo ist – oder beantworte deine Frage.</p>
        </div>
        <button className="ee-btn ee-btn--primary" onClick={() => tourStart(img)}>
          <Icon name="bolt" small /> Rundgang starten · {steps.length} Schritte
        </button>
        <h3 className="ee-angelh">Häufige Fragen</h3>
        <div className="ee-objlist">
          {faq.map(([q, a]) => (
            <details className="ee-objection" name="faq" key={q}>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </div>
    </>
  );
}

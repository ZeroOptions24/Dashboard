/* Aktionen auf die Oberfläche: Ansicht wechseln, Rolle wechseln (Admin),
   Seitenleisten, Menüs, Kurzmeldungen. */

import type { IconName } from "./icons";
import { allowedView, ROLE_LABEL } from "./nav";
import { notify, store, type Drawer } from "./store";
import { guideAdvance, setLeadStatus } from "./actions";
import type { Role, StatusKey } from "./types";

let toastId = 0;
/** Kurzmeldung unten einblenden (3,2 Sekunden) */
export function toast(msg: string, icon: IconName = "check") {
  const t = { id: ++toastId, msg, icon };
  store.toasts.push(t);
  notify();
  setTimeout(() => {
    const i = store.toasts.indexOf(t);
    if (i >= 0) store.toasts.splice(i, 1);
    notify();
  }, 3200);
}

export function closeOverlays() {
  Object.assign(store.overlay, { drawerOpen: false, more: false, notif: false });
  notify();
}

export function openDrawer(drawer: Drawer) {
  Object.assign(store.overlay, { drawer, drawerOpen: true, more: false, notif: false });
  notify();
}

export const openLead = (id: string) => openDrawer({ kind: "lead", id });

export function toggleMore(open = !store.overlay.more) {
  store.overlay.more = open;
  notify();
}

export function toggleNotif(open = !store.overlay.notif) {
  store.overlay.notif = open;
  notify();
}

/** Zu einer Ansicht wechseln (schließt Overlays, scrollt nach oben) */
export function go(view: string) {
  store.ui.view = allowedView(store.ui.role, view);
  Object.assign(store.overlay, { drawerOpen: false, more: false, notif: false });
  notify();
  window.scrollTo({ top: 0 });
}

/** Admin: „Ansicht als“ andere Rolle */
export function setRole(role: Role) {
  Object.assign(store.ui, { role, leadFilter: "alle", leadSearch: "", leadSetter: "alle" });
  go(store.ui.view);
  const k = store.data.ROLE_USER[role];
  toast(`Ansicht: ${ROLE_LABEL[role]} (${store.data.PEOPLE[k]?.first ?? k})`, "user");
}

/** Anrufen: Telefonleitfaden mit diesem Lead öffnen (href="tel:" wählt parallel) */
export function callLead(id: string) {
  store.ui.guideLead = id;
  store.ui.guideSlot = null;
  go("leitfaden");
}

/** Status aus einem Button heraus ändern: Absage/Verlust fragen erst den Grund ab;
 *  im Telefonleitfaden geht es nach „Nicht erreicht“ automatisch zum nächsten Anruf. */
export function changeStatus(id: string, status: StatusKey | "nicht_erreicht") {
  if (status === "abgesagt" || status === "verloren") return openDrawer({ kind: "reason", id, status });
  toast(setLeadStatus(id, status));
  if (store.ui.view === "leitfaden" && status === "nicht_erreicht") {
    const next = guideAdvance(id);
    if (next) toast(`Nächster Anruf: ${next}`, "phone");
  }
}

"use client";

import { useState } from "react";
import { checkDuplicatesAction, submitLeadAction } from "@/app/actions/workspace";
import type { DuplicateHint } from "@/server/lead-submit";
import Field from "@/components/forms/Field";
import Icon from "@/components/ui/Icon";
import { StatusChip } from "@/components/ui/Chips";
import { PageHead } from "@/components/ui/Kpi";
import { bookSlot, createLead, pushNotif, saveDoorVq, setLeadStatus } from "@/lib/actions";
import DirectBooking from "@/components/booking/DirectBooking";
import { bookableSlots } from "@/lib/appointments";
import { fmtDay, fmtHour, nowStamp } from "@/lib/format";
import { leadsForUser } from "@/lib/leads";
import { newWizard, setWizard, store, type WizardStep, LIVE } from "@/lib/store";
import { useDashboard } from "@/lib/useDashboard";
import { STEP1, VQ_SECTIONS, heatText, vqProgress, vqSummary, type FormValues } from "@/lib/vq";
import type { Slot } from "@/lib/types";
import { toast } from "@/lib/ui";

/* Lead erfassen (Setter) – 1:1 nach dem bestehenden Setting-Formular
   Schritt 1 „Lead anlegen“      → später n8n-Webhook POST /webhook/wp-lead
   Schritt 2 „Vorqualifizieren“  → später n8n-Webhook POST /webhook/wp-vorqual (optional)
   Schritt 3 „Termin legen“      → bucht einen freien Closer-Slot (optional) */

const PRESETTER = "inan"; /* Prototyp: fester Presetter; echte Daten: „das Presetting“ */

const go = (step: WizardStep) => {
  setWizard({ step });
  window.scrollTo({ top: 0 });
};

function Stepper() {
  const { step } = store.wiz;
  const idx = { 1: 0, created: 1, 2: 1, ko: 1, 3: 2, done: 3 }[step];
  return (
    <ol className="ee-stepper" data-component="Stepper">
      {["Lead anlegen", "Vorqualifizieren", "Termin legen"].map((s, i) => (
        <li key={s} className={i < idx ? "is-done" : i === idx ? "is-current" : undefined}>
          <span>{i < idx ? <Icon name="check" small /> : i + 1}</span>
          <b>{s}</b>
          {i ? <small>optional</small> : null}
        </li>
      ))}
    </ol>
  );
}

function CustomerBar() {
  const { data } = useDashboard();
  const l = data.LEADS.find((x) => x.id === store.wiz.leadId);
  if (!l) return null;
  return (
    <div className="ee-wiz__who">
      <div className="ee-avatar">
        {l.kunde
          .split(" ")
          .map((x) => x[0])
          .join("")
          .slice(0, 2)}
      </div>
      <div>
        <b>{l.kunde}</b>
        <div className="faint" style={{ fontSize: ".82rem" }}>
          {l.adresse || l.ort} · <span className="mono">{l.id}</span>
        </div>
      </div>
      <StatusChip status={l.status} />
    </div>
  );
}

/* ---------- Schritt 1: Lead anlegen ---------- */
function validate(d: FormValues) {
  const e: Record<string, string> = {};
  const s = (k: string) => String(d[k] ?? "").trim();
  for (const k of ["vorname", "nachname", "telefon", "email", "strasse", "hausnummer", "stadt"]) if (!s(k)) e[k] = "Pflichtfeld";
  if (!/^\d{5}$/.test(s("plz"))) e.plz = "5 Ziffern";
  if (s("email") && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s("email"))) e.email = "Bitte gültige E-Mail angeben";
  return e;
}

/** Adresse aus dem Standort (wie im bisherigen Formular: GPS + OpenStreetMap/Nominatim, kein API-Key) */
function locateAddress(onDone: (fields: Record<string, string>, standort: Record<string, unknown>) => void, onError: (msg: string) => void) {
  if (!navigator.geolocation) return onError("Standort wird von diesem Browser nicht unterstützt");
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const { latitude: lat, longitude: lon, accuracy } = pos.coords;
      const standort: Record<string, unknown> = { lat, lon, genauigkeit_m: Math.round(accuracy || 0) };
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&addressdetails=1&zoom=18&accept-language=de`, {
          headers: { accept: "application/json" },
        });
        if (!res.ok) throw new Error();
        const data = await res.json();
        const a = data.address || {};
        standort.adresse_roh = data.display_name || "";
        onDone(
          {
            strasse: a.road || a.pedestrian || a.footway || a.residential || a.path || "",
            hausnummer: a.house_number || "",
            plz: a.postcode || "",
            stadt: a.city || a.town || a.village || a.municipality || a.suburb || a.county || "",
          },
          standort,
        );
      } catch {
        onError("Adresse konnte nicht geladen werden – bitte manuell eintragen");
      }
    },
    (err) => onError(err.code === 1 ? "Standortfreigabe abgelehnt – bitte im Browser erlauben" : "Standort konnte nicht ermittelt werden"),
    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
  );
}

/** Standort des letzten Lead-Formulars (geht mit an n8n, wie im bisherigen Formular) */
let lastStandort: Record<string, unknown> | null = null;

function Step1() {
  const { toast } = useDashboard();
  const w = store.wiz;
  const [busy, setBusy] = useState<"" | "geo" | "send">("");
  const onChange = (n: string, v: string | string[]) =>
    setWizard((x) => {
      const errors = { ...x.errors };
      delete errors[n];
      return { data: { ...x.data, [n]: v }, errors };
    });
  const F = (k: keyof typeof STEP1) => <Field f={STEP1[k]} values={w.data} scope="d" error={w.errors[STEP1[k].n]} onChange={onChange} />;
  const [dup, setDup] = useState<{ next: "vq" | "created"; hits: DuplicateHint[] } | null>(null);
  const create = async (next: "vq" | "created", confirmed = false) => {
    const errors = validate(w.data);
    if (Object.keys(errors).length) {
      setWizard({ errors });
      setTimeout(() => document.querySelector(".is-invalid")?.scrollIntoView({ block: "center", behavior: "smooth" }), 0);
      return toast("Bitte die markierten Pflichtfelder ausfüllen", "info");
    }
    if (!LIVE) {
      const l = createLead(w.data);
      setWizard({ leadId: l.id });
      toast(`${l.kunde} in Pipedrive angelegt`);
      return go(next === "vq" ? 2 : "created");
    }
    /* echte Daten: über n8n nach Pipedrive (wie das bisherige Setter-Formular) */
    setBusy("send");
    if (!confirmed) {
      const check = await checkDuplicatesAction(w.data).catch(() => null);
      if (check?.ok && check.data.length) {
        setBusy("");
        setDup({ next, hits: check.data });
        return;
      }
    }
    setDup(null);
    submitLeadAction(w.data, lastStandort)
      .then((res) => {
        if (!res.ok) return toast(res.error, "info");
        const l = createLead(w.data, { leadId: res.data.leadId, dealId: res.data.dealId });
        lastStandort = null;
        setWizard({ leadId: l.id });
        toast(res.data.warning ?? `${l.kunde} angelegt`);
        go(next === "vq" ? 2 : "created");
      })
      .catch(() => toast("Keine Verbindung – Lead wurde nicht angelegt, bitte erneut senden", "info"))
      .finally(() => setBusy(""));
  };
  return (
    <form className="stack" style={{ gap: 18 }} noValidate data-component="LeadForm" onSubmit={(e) => e.preventDefault()}>
      <section className="ee-card">
        <div className="ee-card__head">
          <h2>Notizen aus dem Gespräch</h2>
          <span className="muted">optional</span>
        </div>
        {F("notizen")}
      </section>
      <section className="ee-card">
        <div className="ee-card__head">
          <h2>Terminabsprache</h2>
          <span className="muted">optional</span>
        </div>
        <div className="ee-form">
          {F("alle_entscheider")}
          {F("rueckruf_datum")}
          {F("rueckruf_uhrzeit")}
          {F("zeitfenster")}
        </div>
      </section>
      <section className="ee-card">
        <div className="ee-card__head">
          <h2>Kontaktdaten</h2>
          <button
            type="button"
            className="ee-btn ee-btn--sm"
            disabled={busy === "geo"}
            onClick={() => {
              if (!LIVE) {
                setWizard((x) => ({ data: { ...x.data, strasse: "Lützner Straße", hausnummer: "120", plz: "04179", stadt: "Leipzig" } }));
                return toast("Demo: Adresse per Standort gefüllt (im Live-Formular per GPS)", "pin");
              }
              setBusy("geo");
              locateAddress(
                (fields, standort) => {
                  lastStandort = standort;
                  setWizard((x) => ({ data: { ...x.data, ...Object.fromEntries(Object.entries(fields).filter(([, v]) => v)) } }));
                  toast(fields.hausnummer ? "Adresse übernommen – bitte kurz prüfen" : "Adresse übernommen – Hausnummer bitte ergänzen", "pin");
                  setBusy("");
                },
                (msg) => {
                  toast(msg, "info");
                  setBusy("");
                },
              );
            }}
          >
            <Icon name="pin" small /> {busy === "geo" ? "Standort wird ermittelt …" : "Adresse per Standort ausfüllen"}
          </button>
        </div>
        <div className="ee-form">
          {F("anrede")}
          {F("vorname")}
          {F("nachname")}
          {F("telefon")}
          {F("email")}
          {F("strasse")}
          {F("hausnummer")}
          {F("plz")}
          {F("stadt")}
        </div>
      </section>
      {dup && (
        <section className="ee-alert ee-alert--warn" data-component="DuplicateWarning" role="alert">
          <div className="stack" style={{ gap: 8, width: "100%" }}>
            <b>Diesen Kunden gibt es vermutlich schon</b>
            {dup.hits.map((h, i) => (
              <span key={i}>
                Gleiche{h.grund === "Telefon" ? " Telefonnummer" : "r Name"} · eingereicht am {h.datum} · Stand: {h.status}
              </span>
            ))}
            <span style={{ fontWeight: 400 }}>Anderes Haus derselben Familie? Dann trotzdem anlegen. Sonst bitte nicht doppelt erfassen.</span>
            <div className="row">
              <button type="button" className="ee-btn ee-btn--sm" disabled={busy === "send"} onClick={() => void create(dup.next, true)}>
                Trotzdem anlegen
              </button>
              <button type="button" className="ee-btn ee-btn--ghost ee-btn--sm" onClick={() => setDup(null)}>
                Abbrechen
              </button>
            </div>
          </div>
        </section>
      )}
      <div className="ee-wiz__bar" data-component="ActionBar">
        <button type="button" className="ee-btn" disabled={busy === "send"} onClick={() => create("vq")}>
          <Icon name="check" small /> Direkt an der Tür vorqualifizieren
        </button>
        <button type="button" className="ee-btn ee-btn--primary" disabled={busy === "send"} onClick={() => create("created")}>
          <Icon name="plus" small /> {busy === "send" ? "Wird angelegt …" : "Lead erstellen"}
        </button>
      </div>
    </form>
  );
}

function Created() {
  const { data } = useDashboard();
  const l = data.LEADS.find((x) => x.id === store.wiz.leadId)!;
  return (
    <section className="ee-card ee-wiz__success">
      <div className="ee-wiz__check">
        <Icon name="check" />
      </div>
      <h2>{LIVE ? "Der neue Kunde ist angelegt" : "Der neue Kunde wurde erfolgreich in Pipedrive angelegt"}</h2>
      <p className="muted">
        {l.kunde} · {l.adresse}
      </p>
      <div className="row" style={{ justifyContent: "center" }}>
        <button className="ee-btn ee-btn--primary" onClick={() => go(2)}>
          <Icon name="check" small /> Jetzt vorqualifizieren
        </button>
        <button className="ee-btn" onClick={() => go(3)}>
          <Icon name="cal" small /> Direkt Termin legen
        </button>
        <button className="ee-btn ee-btn--ghost" onClick={reset}>
          <Icon name="plus" small /> Weiteren Kunden anlegen
        </button>
      </div>
    </section>
  );
}

const reset = () => {
  store.wiz = newWizard();
  go(1);
};

/* ---------- Schritt 2: Vorqualifizierung ---------- */
function Step2() {
  const { data, person, toast } = useDashboard();
  const w = store.wiz;
  const p = vqProgress(w.vq);
  const submit = (phone: boolean) => {
    const l = data.LEADS.find((x) => x.id === w.leadId);
    if (!l) return;
    const vq = w.vq;
    l.vq = Object.fromEntries(Object.entries(vq).map(([k, v]) => [k, Array.isArray(v) ? v.join(", ") : v ?? ""]));
    setWizard({ vqSent: true });
    const sum = vqSummary(vq);
    if (phone) {
      setWizard({ phone: true });
      l.preNote = `An der Tür vorqualifiziert (${p.done}/${p.total} Fragen): ${sum || "–"}. Rest telefonisch klären.`;
      saveDoorVq(l.id, l.vq, l.preNote);
      pushNotif(PRESETTER, `${l.kunde}: Vorqualifizierung an der Tür begonnen (${p.done}/${p.total}) – bitte Rest telefonisch klären`, "eingereicht");
      toast(`Teilantworten übertragen – ${LIVE ? "das Presetting" : person(PRESETTER).first} klärt den Rest`);
      return go("done");
    }
    l.preNote = `An der Tür vorqualifiziert: ${sum || "–"}`;
    saveDoorVq(l.id, l.vq, l.preNote);
    if ((vq.eigentuemer && vq.eigentuemer !== "Ja") || vq.selbst_bewohnt === "Nein") return go("ko");
    l.hist.unshift(["Vorqualifizierung an der Tür übertragen", nowStamp(data.NOW)]);
    toast("Vorqualifizierung übertragen");
    go(3);
  };
  return (
    <>
      <CustomerBar />
      <section className="ee-card ee-vq__head" data-component="VqSummary">
        <div>
          <span className="eyebrow">Vorqualifizierung</span>
        </div>
        <div className="ee-vq__stats">
          <div>
            <b className="num" id="vqProgress">
              {p.done}/{p.total}
            </b>
            <span>beantwortet</span>
          </div>
          <div>
            <b className="num" id="vqHeat">
              {heatText(w.vq as Record<string, string>)}
            </b>
            <span>Heizlast (Schätzung)</span>
          </div>
        </div>
      </section>
      <form className="stack" style={{ gap: 18 }} noValidate data-component="VqForm" onSubmit={(e) => e.preventDefault()}>
        {VQ_SECTIONS.map((s, i) => (
          <section key={s.key} className="ee-card">
            <div className="ee-card__head">
              <h2>
                <span className="ee-vq__no">{i + 1}</span>
                {s.title}
              </h2>
            </div>
            <div className="ee-form">
              {s.fields.map((f) => (
                <Field key={f.n} f={f} values={w.vq} scope="vq" onChange={(n, v) => setWizard((x) => ({ vq: { ...x.vq, [n]: v } }))} />
              ))}
            </div>
          </section>
        ))}
        <div className="ee-wiz__bar">
          <button type="button" className="ee-btn" onClick={() => submit(true)}>
            <Icon name="phone" small /> Rest telefonisch klären
          </button>
          <button type="button" className="ee-btn ee-btn--primary" onClick={() => submit(false)}>
            <Icon name="send" small /> Vorqualifizierung abschicken
          </button>
        </div>
      </form>
    </>
  );
}

function Ko() {
  const vq = store.wiz.vq;
  const why = [vq.eigentuemer && vq.eigentuemer !== "Ja" && `Eigentümer: „${vq.eigentuemer}“`, vq.selbst_bewohnt === "Nein" && "nicht selbst bewohnt"]
    .filter(Boolean)
    .join(", ");
  return (
    <>
      <CustomerBar />
      <section className="ee-card ee-wiz__ko">
        <h2>K.-o.-Kriterium: {why}</h2>
        <div className="row">
          <button
            className="ee-btn ee-btn--danger"
            onClick={() => {
              toast(setLeadStatus(store.wiz.leadId!, "abgesagt", vq.selbst_bewohnt === "Nein" && vq.eigentuemer === "Ja" ? "Sonstiges" : "Kein Eigentümer", "An der Tür vorqualifiziert"));
              go("done");
            }}
          >
            Als „Abgesagt“ markieren
          </button>
          <button className="ee-btn" onClick={() => go(3)}>
            Trotzdem Termin legen (Eigentümer kommt zum Termin)
          </button>
        </div>
      </section>
    </>
  );
}

/* ---------- Schritt 3: Termin legen ---------- */
function Step3() {
  const { data, now, person, toast } = useDashboard();
  const w = store.wiz;
  const { slots, closers, paused } = bookableSlots(data.SLOTS, data.APPTS, now);
  const firsts = (ks: string[]) => ks.map((k) => person(k).first).join(", ");
  const byDay: Record<string, Slot[]> = {};
  slots.forEach((s) => (byDay[s.date] ??= []).push(s));
  const sel = data.SLOTS.find((x) => x.id === w.slot);
  const wizLead = data.LEADS.find((x) => x.id === w.leadId);
  return (
    <>
      <CustomerBar />
      {w.data.alle_entscheider === "Nein, nicht alle dabei" && (
        <div className="ee-demo-strip" style={{ borderStyle: "solid", borderColor: "var(--warn)" }}>
          <Icon name="info" small />
          <span>
            <b>Nicht alle Entscheider dabei.</b>
          </span>
        </div>
      )}
      <section className="ee-card" data-component="SlotPicker">
        <div className="ee-card__head">
          <h2>Freie Termine</h2>
          <span className="muted">{closers.length ? `Closer: ${firsts(closers)} · ` : ""}90 Min. vor Ort</span>
        </div>
        {Object.keys(byDay).length ? (
          Object.entries(byDay).map(([k, ss]) => (
            <div key={k} className="ee-slotpick__day">
              <b>{fmtDay(k)}</b>
              <div className="ee-slotpick">
                {ss.map((s) => (
                  <button key={s.id} className="ee-slotpick__btn" aria-pressed={w.slot === s.id} onClick={() => setWizard({ slot: s.id })}>
                    {fmtHour(s.start)}
                    {closers.length > 1 ? ` · ${person(s.closer).first}` : ""}
                  </button>
                ))}
              </div>
            </div>
          ))
        ) : paused.length ? (
          <div className="ee-alert ee-alert--bad">
            <Icon name="lock" small /> {firsts(paused)} {paused.length > 1 ? "sind" : "ist"} pausiert – offene Rückmeldungen
          </div>
        ) : (
          <p className="muted">Keine freien Termine.</p>
        )}
        {wizLead && (
          <div style={{ marginTop: 12 }}>
            <DirectBooking lead={wizLead} onBooked={() => go("done")} />
          </div>
        )}
      </section>
      <div className="ee-wiz__bar">
        <button
          className="ee-btn"
          onClick={() => {
            toast("Lead liegt beim Presetting");
            go("done");
          }}
        >
          Ohne Termin abschließen – Presetting ruft an
        </button>
        <button
          className="ee-btn ee-btn--primary"
          disabled={!sel}
          onClick={() => {
            const l = data.LEADS.find((x) => x.id === w.leadId);
            if (!sel || !l) return;
            bookSlot(l, sel);
            toast(`Termin gebucht: ${fmtDay(sel.date)} ${fmtHour(sel.start)} · ${person(sel.closer).first} informiert`);
            setWizard({ slot: null });
            go("done");
          }}
        >
          <Icon name="cal" small /> {sel ? `Termin ${fmtDay(sel.date)} ${fmtHour(sel.start)} eintragen` : "Termin auswählen"}
        </button>
      </div>
    </>
  );
}

function Row({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className={ok ? "is-ok" : undefined}>
      {ok ? <Icon name="check" small /> : <span className="ee-dash">–</span>}
      <span>{children}</span>
    </li>
  );
}

function Done() {
  const { data, role, me, person, go: goView, openLead } = useDashboard();
  const w = store.wiz;
  const l = data.LEADS.find((x) => x.id === w.leadId)!;
  const a = data.APPTS.find((x) => x.lead === l.id);
  const today = leadsForUser(data.LEADS, role, me).filter((x) => x.datum === l.datum).length;
  const goal = data.DAY_GOAL.goal;
  return (
    <section className="ee-card ee-wiz__success">
      <div className="ee-wiz__check">
        <Icon name="check" />
      </div>
      <h2>{l.kunde} ist erfasst</h2>
      <ul className="ee-donelist">
        <Row ok>
          {LIVE ? "Lead angelegt – Übertragung nach Pipedrive folgt" : "Lead in Pipedrive angelegt"} (<span className="mono">{l.id}</span>)
        </Row>
        <Row ok={w.vqSent}>
          {w.vqSent ? `Vorqualifizierung übertragen${w.phone ? ` – Rest klärt ${LIVE ? "das Presetting" : person(PRESETTER).first} telefonisch` : ""}` : "Vorqualifizierung übersprungen – macht das Presetting"}
        </Row>
        <Row ok={!!a}>{a ? `Termin: ${fmtDay(a.date)} ${fmtHour(a.start)} mit ${person(a.closer).first}` : `Kein Termin – ${LIVE ? "das Presetting" : person(PRESETTER).first} ruft den Kunden an`}</Row>
      </ul>
      <p className="muted">
        Heute:{" "}
        <b className={today >= goal ? "is-good" : undefined}>
          {today} von {goal}
        </b>{" "}
        Leads{today >= goal ? " – Tagesziel erreicht!" : ""}
      </p>
      <div className="row" style={{ justifyContent: "center" }}>
        <button className="ee-btn ee-btn--primary" onClick={reset}>
          <Icon name="plus" small /> Weiteren Kunden anlegen
        </button>
        <button className="ee-btn" onClick={() => openLead(l.id)}>
          Lead ansehen
        </button>
        <button className="ee-btn ee-btn--ghost" onClick={() => goView("uebersicht")}>
          Zur Übersicht
        </button>
      </div>
    </section>
  );
}

export default function ErfassenView() {
  useDashboard(); /* neu zeichnen, wenn sich der Store ändert */
  const { step } = store.wiz;
  return (
    <>
      <PageHead title="Lead erfassen" />
      <Stepper />
      {step === 1 ? <Step1 /> : step === "created" ? <Created /> : step === 2 ? <Step2 /> : step === "ko" ? <Ko /> : step === 3 ? <Step3 /> : <Done />}
    </>
  );
}

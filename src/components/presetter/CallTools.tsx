"use client";

import { useEffect, useState } from "react";
import { claimLeadAction, releaseLeadsAction } from "@/app/actions/workspace";
import { TryChip } from "@/components/ui/Chips";
import Icon from "@/components/ui/Icon";
import { fmtHour, pad } from "@/lib/format";
import { callbackDue, callbackLate, isOverdue, telFull, telHref } from "@/lib/leads";
import { LIVE } from "@/lib/source";
import type { Lead } from "@/lib/types";
import { callLead, changeStatus } from "@/lib/ui";
import { useDashboard } from "@/lib/useDashboard";

/** Aktuelle Uhrzeit, jede Minute neu – für Fälligkeiten (Rückrufe), solange die Ansicht offen ist.
 *  Beispieldaten behalten ihre feste Prototyp-Zeit. */
export function useMinuteClock(start: Date) {
  const [now, setNow] = useState(() => (LIVE ? new Date() : start));
  useEffect(() => {
    if (!LIVE) return;
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  return LIVE ? now : start;
}

/** Vereinbarte Rückrufe, die jetzt dran sind (bis 10 Min. vorher, bis 90 Min. danach) */
export function CallbackAlerts({ leads, onCall }: { leads: Lead[]; onCall?: (id: string) => void }) {
  const { data } = useDashboard();
  const now = useMinuteClock(data.NOW);
  const due = leads
    .map((l) => ({ l, at: callbackDue(l, now) }))
    .filter((x): x is { l: Lead; at: Date } => !!x.at && x.at.getTime() - now.getTime() <= 10 * 6e4 && now.getTime() - x.at.getTime() <= 90 * 6e4)
    .sort((a, b) => a.at.getTime() - b.at.getTime());
  if (!due.length) return null;
  return (
    <section className="ee-alert ee-alert--warn" data-component="CallbackAlerts" aria-live="polite">
      <div className="stack" style={{ gap: 8, width: "100%" }}>
        <b>
          <Icon name="clock" small /> {due.length === 1 ? "Rückruf ist jetzt dran" : `${due.length} Rückrufe sind jetzt dran`}
        </b>
        {due.map(({ l, at }) => (
          <div key={l.id} className="row row--between" style={{ gap: 10 }}>
            <span>
              {pad(at.getHours())}:{pad(at.getMinutes())} · <b>{l.kunde}</b>
              {l.ort ? ` · ${l.ort}` : ""}
            </span>
            <a className="ee-btn ee-btn--primary ee-btn--sm" href={telHref(l)} onClick={() => (onCall ? onCall(l.id) : callLead(l.id))}>
              <Icon name="phone" small /> Anrufen
            </a>
          </div>
        ))}
      </div>
    </section>
  );
}

type QueueFilter = "alle" | "faellig" | "neu" | "rueckruf" | "versuche";
const PAGE = 25;

/** Anrufliste mit Suche (Name, Ort, Telefon) und Filtern; zeigt 25 auf einmal */
export function FilteredCallQueue({ queue }: { queue: Lead[] }) {
  const { person, openLead, data } = useDashboard();
  const now = useMinuteClock(data.NOW);
  const [q, setQ] = useState("");
  const [f, setF] = useState<QueueFilter>("alle");
  const [shown, setShown] = useState(PAGE);
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const needle = norm(q.trim());
  const digits = q.replace(/\D/g, "");
  const tests: Record<QueueFilter, (l: Lead) => boolean> = {
    alle: () => true,
    faellig: (l) => isOverdue(l, now) || callbackLate(l, now),
    neu: (l) => !l.attempts && !l.nextTry,
    rueckruf: (l) => !!callbackDue(l, now),
    versuche: (l) => l.attempts > 0,
  };
  const matchText = (l: Lead) =>
    !needle ||
    norm(`${l.kunde} ${l.ort} ${l.adresse ?? ""} ${l.setter === "unbekannt" ? "" : person(l.setter).name}`).includes(needle) ||
    (digits.length >= 3 && telFull(l).replace(/\D/g, "").includes(digits));
  const list = queue.filter((l) => tests[f](l) && matchText(l));
  const chips: [QueueFilter, string][] = [
    ["alle", "Alle"],
    ["faellig", "Überfällig"],
    ["rueckruf", "Rückruf vereinbart"],
    ["neu", "Noch nicht angerufen"],
    ["versuche", "Mit Versuchen"],
  ];
  return (
    <>
      <div className="stack" style={{ gap: 10, padding: "0 20px 12px" }}>
        <input
          className="ee-input"
          type="search"
          id="queueSearch"
          placeholder="Suchen: Name, Ort, Telefon, Setter"
          aria-label="Anrufliste durchsuchen"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setShown(PAGE);
          }}
        />
        <div className="ee-filters" style={{ margin: 0 }}>
          {chips.map(([k, label]) => (
            <button
              key={k}
              className="ee-filter"
              aria-pressed={f === k}
              onClick={() => {
                setF(k);
                setShown(PAGE);
              }}
            >
              {label}
              <span className="c">{queue.filter((l) => tests[k](l) && matchText(l)).length}</span>
            </button>
          ))}
        </div>
      </div>
      {!list.length ? (
        <div className="ee-empty">{queue.length ? "Kein Lead passt zu Suche und Filter." : "Alle Leads sind angerufen."}</div>
      ) : (
        <div className="ee-calls">
          {list.slice(0, shown).map((l) => {
            const cb = callbackDue(l, now);
            return (
              <div key={l.id} className={isOverdue(l, now) || callbackLate(l, now) ? "ee-call is-over" : "ee-call"}>
                <button className="ee-call__who" onClick={() => openLead(l.id)}>
                  <b>{l.kunde}</b>
                  <span>{[l.ort, l.setter === "unbekannt" ? "ohne Setter" : `von ${person(l.setter).first}`].filter(Boolean).join(" · ")}</span>
                  <span className="mono">{telFull(l)}</span>
                </button>
                <div className="ee-call__meta">
                  <TryChip lead={l} now={now} />
                  <span className="faint">
                    {cb ? `Rückruf ${cb.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })} ${fmtHour(cb.getHours() + cb.getMinutes() / 60)}` : l.attempts ? `${l.attempts}. Versuch` : "noch nicht angerufen"}
                  </span>
                </div>
                <div className="ee-call__actions">
                  <button className="ee-btn ee-btn--sm" onClick={() => changeStatus(l.id, "nicht_erreicht")}>
                    Nicht erreicht
                  </button>
                  {/* href="tel:" wählt parallel die Nummer, der Klick öffnet den Leitfaden */}
                  <a className="ee-btn ee-btn--primary ee-btn--sm" href={telHref(l)} onClick={() => callLead(l.id)}>
                    <Icon name="phone" small /> Anrufen
                  </a>
                </div>
              </div>
            );
          })}
          {list.length > shown && (
            <div style={{ padding: "12px 20px" }}>
              <button className="ee-btn ee-btn--ghost ee-btn--block" onClick={() => setShown(shown + PAGE)}>
                Weitere {Math.min(PAGE, list.length - shown)} von {list.length - shown} anzeigen
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

/** Hinweis, wenn jemand anderes denselben Lead gerade im Leitfaden offen hat; hält den eigenen Lead offen */
export function LeadLockBanner({ leadId, onNext }: { leadId: string; onNext?: () => void }) {
  const [other, setOther] = useState<{ name: string; since: string } | null>(null);
  useEffect(() => {
    if (!LIVE || !/^PD-\d+$/.test(leadId)) return;
    let off = false;
    const claim = (force = false) =>
      claimLeadAction(leadId, force).then((res) => {
        if (!off && res.ok) setOther(res.data.other);
      });
    void claim();
    const t = setInterval(() => void claim(), 4 * 60_000);
    return () => {
      off = true;
      clearInterval(t);
      setOther(null);
    };
  }, [leadId]);
  useEffect(() => () => void releaseLeadsAction(), []);
  if (!other) return null;
  const since = new Date(other.since).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  return (
    <section className="ee-alert ee-alert--warn" data-component="LeadLock" aria-live="polite">
      <span style={{ flex: 1 }}>
        <b>{other.name}</b> hat diesen Lead seit {since} Uhr offen – vermutlich läuft gerade der Anruf.
      </span>
      {onNext && (
        <button className="ee-btn ee-btn--sm" onClick={onNext}>
          Nächsten Lead nehmen
        </button>
      )}
      <button
        className="ee-btn ee-btn--ghost ee-btn--sm"
        onClick={() =>
          void claimLeadAction(leadId, true).then((res) => {
            if (res.ok) setOther(null);
          })
        }
      >
        Trotzdem übernehmen
      </button>
    </section>
  );
}

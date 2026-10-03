import { PIPELINE, STATUS } from "@/lib/domain";
import { ageH, callbackLate, isCallback } from "@/lib/leads";
import type { Lead, StatusKey } from "@/lib/types";

/** Farbiger Chip mit freiem Text. tone: ok | warn | bad | info | pos | Status-Töne */
export function ToneChip({ label, tone }: { label: string; tone?: string }) {
  return (
    <span className={tone ? `ee-chip ee-chip--${tone}` : "ee-chip"} data-component="StatusChip">
      {label}
    </span>
  );
}

export function StatusChip({ status }: { status: StatusKey }) {
  const s = STATUS[status];
  return <ToneChip label={s.label} tone={s.tone} />;
}

/* 7 Segmente = PIPELINE: Eingereicht · Terminierung · Aufmaß · Checks · Verkaufstermin · Verkauf · Ausgezahlt */
function stepClasses(status: StatusKey): string[] {
  const idx = PIPELINE.indexOf(status);
  const seg: string[] = PIPELINE.map((_, i) => (i <= idx ? "on" : ""));
  if (status === "verkauft" || status === "ausgezahlt") seg[5] = "win";
  if (status === "ausgezahlt") seg[6] = "paid";
  if (status === "abgesagt") seg[0] = "fail";
  if (status === "verloren") {
    seg[0] = seg[1] = seg[2] = "on";
    seg[3] = "fail";
  }
  return seg;
}

export function PipelineSteps({ status }: { status: StatusKey }) {
  return (
    <div data-component="PipelineSteps" title={STATUS[status].label}>
      <div className="ee-steps">
        {stepClasses(status).map((c, i) => (
          <i key={i} className={c || undefined} />
        ))}
      </div>
    </div>
  );
}

/** Wie lange der Lead schon wartet – grün < 2 Std., gelb < 24 Std., sonst rot. */
export function AgeBadge({ lead, now }: { lead: Lead; now: Date }) {
  const h = ageH(lead, now);
  const txt =
    h < 1 ? `seit ${Math.max(1, Math.round(h * 60))} Min.` : h < 48 ? `seit ${Math.round(h)} Std.` : `seit ${Math.round(h / 24)} Tagen`;
  return <ToneChip label={txt} tone={h < 2 ? "ok" : h < 24 ? "warn" : "bad"} />;
}

/** Status offener Anrufe – überall gleich. */
export function TryChip({ lead, now, short }: { lead: Lead; now: Date; short?: boolean }) {
  const t = lead.nextTry;
  if (!t) return <AgeBadge lead={lead} now={now} />;
  if (callbackLate(lead, now)) return <ToneChip label={`Rückruf überfällig (${t.replace(/^Rückruf /, "")})`} tone="bad" />;
  if (isCallback(lead))
    return <ToneChip label={short ? t.replace(/^Rückruf /, "") : t.replace(/^Rückruf /, "Rückruf: ")} tone="info" />;
  return <ToneChip label={`${short ? "" : "Nächster Versuch: "}${t}`} tone="warn" />;
}

import { eq } from "drizzle-orm";
import { isAdmin, parseRoles } from "@/lib/roles";
import type { PayoutItem } from "@/lib/types";
import { getSession } from "@/server/auth";
import { db, schema } from "@/server/db";

/* Gutschrift zu einer Abrechnung als druckbare Seite („Als PDF speichern“ im Druckdialog).
   Nur die Person selbst und Admins. Absender aus GUTSCHRIFT_ABSENDER (Zeilen mit „|“ getrennt). */
export const dynamic = "force-dynamic";

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const eur = (n: number) => n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });

export async function GET(_req: Request, ctx: RouteContext<"/api/payouts/[id]/gutschrift">) {
  const s = await getSession();
  if (!s || s.user.banned) return new Response("Nicht angemeldet", { status: 401 });
  const { id } = await ctx.params;
  const [p] = await db.select().from(schema.payout).where(eq(schema.payout.id, id));
  if (!p || (p.userId !== s.user.id && !isAdmin(parseRoles(s.user.role)))) return new Response("Nicht gefunden", { status: 404 });
  const [u] = await db.select({ name: schema.user.name }).from(schema.user).where(eq(schema.user.id, p.userId));
  const [pr] = await db.select().from(schema.profile).where(eq(schema.profile.userId, p.userId));
  let items: PayoutItem[] = [];
  try {
    items = JSON.parse(p.posten);
  } catch {
    /* leer */
  }
  const netto = p.netto ?? p.betrag,
    ust = p.ust ?? 0;
  const absender = (process.env.GUTSCHRIFT_ABSENDER || "EnergyEngel").split("|").map((x) => x.trim());
  const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Gutschrift ${esc(p.id)}</title>
<style>
body{font:14px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif;color:#13221a;max-width:760px;margin:32px auto;padding:0 24px}
h1{font-size:22px;margin:28px 0 4px}.muted{color:#5a6b61}.head{display:flex;justify-content:space-between;gap:24px}
table{width:100%;border-collapse:collapse;margin-top:18px}th,td{padding:7px 6px;border-bottom:1px solid #d5dfd7;text-align:left;vertical-align:top}
th{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:#5a6b61}.r{text-align:right;white-space:nowrap}
.sum td{border:0;padding-top:4px}.total td{font-weight:700;border-top:2px solid #13221a}
.bar{margin:24px 0;display:flex;gap:10px}button{font:inherit;padding:8px 14px;border-radius:8px;border:1px solid #1d4c37;background:#1d4c37;color:#fff;cursor:pointer}
@media print{.bar{display:none}body{margin:0}}
</style></head><body>
<div class="bar"><button onclick="window.print()">Drucken / als PDF speichern</button></div>
<div class="head"><div><b>${esc(absender[0])}</b>${absender.slice(1).map((l) => `<br>${esc(l)}`).join("")}</div>
<div style="text-align:right">Gutschrift <b>${esc(p.id)}</b><br>${esc(p.periode)}<br>Auszahlung am ${esc(p.datum)}</div></div>
<p style="margin-top:28px">${esc(u?.name)}<br>${esc(pr?.strasse)}<br>${esc(pr?.plz)} ${esc(pr?.ort)}${pr?.steuernummer ? `<br><span class="muted">Steuernummer ${esc(pr.steuernummer)}</span>` : ""}</p>
<h1>Gutschrift</h1><p class="muted">Abrechnung von Provisionen im Gutschriftverfahren.</p>
<table><thead><tr><th>Datum</th><th>Kunde / Anlass</th><th class="r">Betrag</th></tr></thead><tbody>
${items.map((x) => `<tr><td>${esc(x.datum)}</td><td>${esc(x.kunde)} – ${esc(x.anlass)}${x.grund ? `<br><span class="muted">${esc(x.grund)}</span>` : ""}</td><td class="r">${eur(x.betrag)}</td></tr>`).join("")}
<tr class="sum"><td></td><td class="r">Summe netto</td><td class="r">${eur(netto)}</td></tr>
${ust ? `<tr class="sum"><td></td><td class="r">zzgl. 19 % Umsatzsteuer</td><td class="r">${eur(ust)}</td></tr>` : ""}
<tr class="total"><td></td><td class="r">Auszahlungsbetrag</td><td class="r">${eur(netto + ust)}</td></tr>
</tbody></table>
${!ust ? `<p class="muted">Gemäß § 19 UStG wird keine Umsatzsteuer ausgewiesen (Kleinunternehmerregelung).</p>` : ""}
<p class="muted">Überweisung auf das Konto ${pr?.ibanLast4 ? `•••• ${esc(pr.ibanLast4)}` : "(IBAN fehlt)"}${pr?.kontoinhaber ? `, Inhaber ${esc(pr.kontoinhaber)}` : ""}.</p>
</body></html>`;
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}

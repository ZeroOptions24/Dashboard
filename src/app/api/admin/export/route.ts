import { requireAdmin } from "@/server/auth";
import { exportDuplicates, exportWithoutSetter } from "@/server/lead-export";
import { exportTransfers } from "@/server/payout-export";

/* CSV-Listen für Admins (enthalten Kunden- bzw. Bankdaten – nur Admins, wird protokolliert):
   ?liste=ohne-setter · ?liste=dubletten · ?liste=ueberweisungen (freigegebene Abrechnungen mit IBAN) */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  let adminId: string;
  try {
    adminId = (await requireAdmin()).user.id;
  } catch {
    return Response.json({ error: "Keine Berechtigung" }, { status: 403 });
  }
  const liste = new URL(req.url).searchParams.get("liste");
  const day = new Date().toISOString().slice(0, 10);
  const body =
    liste === "dubletten" ? await exportDuplicates(adminId) : liste === "ohne-setter" ? await exportWithoutSetter(adminId) : liste === "ueberweisungen" ? await exportTransfers(adminId) : null;
  if (body == null) return Response.json({ error: "Unbekannte Liste" }, { status: 400 });
  const name = liste === "dubletten" ? "Moegliche-Dubletten" : liste === "ueberweisungen" ? "Ueberweisungen" : "Leads-ohne-Setter";
  return new Response(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${name}-${day}.csv"`,
      "cache-control": "no-store",
    },
  });
}

import { requireAdmin } from "@/server/auth";
import { exportDuplicates, exportWithoutSetter } from "@/server/lead-export";

/* CSV-Listen für Admins (enthalten Kundendaten – nur Admins, wird protokolliert):
   ?liste=ohne-setter · ?liste=dubletten */
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
  const body = liste === "dubletten" ? await exportDuplicates(adminId) : liste === "ohne-setter" ? await exportWithoutSetter(adminId) : null;
  if (body == null) return Response.json({ error: "Unbekannte Liste" }, { status: 400 });
  return new Response(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${liste === "dubletten" ? "Moegliche-Dubletten" : "Leads-ohne-Setter"}-${day}.csv"`,
      "cache-control": "no-store",
    },
  });
}

import { requireAdmin } from "@/server/auth";
import { exportMember } from "@/server/team";

/* Datenauskunft einer Person als JSON-Datei – nur Admins, wird protokolliert. */
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: RouteContext<"/api/team/[id]/export">) {
  let adminId: string;
  try {
    adminId = (await requireAdmin()).user.id;
  } catch {
    return Response.json({ error: "Keine Berechtigung" }, { status: 403 });
  }
  const { id } = await ctx.params;
  try {
    const data = await exportMember(id, adminId);
    const file = `Datenauskunft-${data.konto.name.replace(/[^A-Za-z0-9äöüÄÖÜß-]+/g, "_")}-${data.erstellt.slice(0, 10)}.json`;
    return new Response(JSON.stringify(data, null, 2), {
      headers: { "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="${encodeURIComponent(file)}"`, "cache-control": "no-store" },
    });
  } catch {
    return Response.json({ error: "Nicht gefunden" }, { status: 404 });
  }
}

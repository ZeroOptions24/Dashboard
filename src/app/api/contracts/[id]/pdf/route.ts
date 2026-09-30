import { contractPdf } from "@/server/contract-service";
import { getSession } from "@/server/auth";

/* Vertrags-PDF: nur für die Person selbst oder Admins (Admin-Abrufe werden protokolliert). */
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: RouteContext<"/api/contracts/[id]/pdf">) {
  const session = await getSession();
  if (!session) return new Response("Nicht angemeldet", { status: 401 });
  const { id } = await params;
  const file = await contractPdf(id, { id: session.user.id, role: session.user.role ?? null });
  if (!file) return new Response("Nicht gefunden", { status: 404 });
  return new Response(new Uint8Array(file.pdf), {
    headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="${file.name}"`, "cache-control": "private, no-store" },
  });
}

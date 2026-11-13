// Streams a document, photo or voice note a borrower sent, from Meta to the
// coach's browser. Nothing is saved on our side; Meta keeps media 30 days.
import { graphApi } from "@/lib/whatsapp/client";
import { coachAuthorized, unauthorized, waStore } from "@/lib/whatsapp/deps";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!coachAuthorized(req)) return unauthorized();
  const { id } = await params;
  const m = await waStore().getMessage(Number(id));
  if (!m?.mediaId) return Response.json({ error: "No file on that message." }, { status: 404 });
  const file = await graphApi().downloadMedia(m.mediaId);
  if (!file.ok) return Response.json({ error: file.error }, { status: 502 });
  const name = (m.fileName ?? `whatsapp-${m.id}`).replace(/[^\w.-]/g, "_");
  return new Response(file.body, { headers: { "Content-Type": file.mime, "Content-Disposition": `attachment; filename="${name}"`, "Cache-Control": "no-store" } });
}

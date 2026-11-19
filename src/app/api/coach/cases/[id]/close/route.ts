import { coachAuthorized, unauthorized, waDeps } from "@/lib/whatsapp/deps";
import { coachClose } from "@/lib/whatsapp/service";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!coachAuthorized(req)) return unauthorized();
  const { id } = await params;
  const { contactId } = (await req.json().catch(() => ({}))) as { contactId?: string };
  if (!contactId) return Response.json({ error: "contactId is required" }, { status: 400 });
  const r = await coachClose(waDeps(), id, contactId);
  return r.ok ? Response.json({ ok: true }) : Response.json({ error: r.error }, { status: r.status });
}

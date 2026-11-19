import { coachAuthorized, unauthorized, waDeps } from "@/lib/whatsapp/deps";
import { coachFollowUp } from "@/lib/whatsapp/service";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!coachAuthorized(req)) return unauthorized();
  const { id } = await params;
  const r = await coachFollowUp(waDeps(), id);
  return r.ok ? Response.json({ ok: true }) : Response.json({ error: r.error }, { status: r.status });
}

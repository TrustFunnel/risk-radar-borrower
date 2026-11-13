import { coachAuthorized, unauthorized, waStore } from "@/lib/whatsapp/deps";
import { windowOpen } from "@/lib/whatsapp/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!coachAuthorized(req)) return unauthorized();
  const { id } = await params;
  const store = waStore();
  const c = await store.getContact(id);
  if (!c) return Response.json({ error: "No such conversation." }, { status: 404 });
  const [messages, openCase] = await Promise.all([store.messages(id), store.getOpenCase(id)]);
  return Response.json({
    contact: {
      id: c.id, phone: c.phone ?? `+${c.waId}`, name: c.state.name ?? c.profileName, linkedAccount: !!c.userId,
      lang: c.state.lang, step: c.state.step, level: c.state.level ?? null, answers: c.state.answers, consents: c.state.consents,
      windowOpen: windowOpen(c), lastInboundAt: c.lastInboundAt,
    },
    openCase,
    messages: messages.map((m) => ({ id: m.id, direction: m.direction, author: m.author, type: m.type, body: m.body, hasMedia: !!m.mediaId, fileName: m.fileName, status: m.status, error: m.errorTitle, at: m.createdAt })),
  });
}

import { coachAuthorized, unauthorized, waStore } from "@/lib/whatsapp/deps";
import { windowOpen } from "@/lib/whatsapp/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ORDER = { urgent: 0, high: 1, normal: 2 } as const;

export async function GET(req: Request) {
  if (!coachAuthorized(req)) return unauthorized();
  const status = new URL(req.url).searchParams.get("status") === "closed" ? "closed" : "open";
  const cases = await waStore().listCases(status);
  if (status === "open") cases.sort((a, b) => ORDER[a.priority] - ORDER[b.priority] || a.createdAt.localeCompare(b.createdAt));
  return Response.json({
    cases: cases.map((c) => ({
      id: c.id, reason: c.reason, priority: c.priority, note: c.note, status: c.status, createdAt: c.createdAt, closedAt: c.closedAt,
      contact: {
        id: c.contact.id, name: c.contact.state?.name ?? c.contact.profileName, phoneEnd: c.contact.waId.slice(-3),
        level: c.contact.state?.level ?? null, lang: c.contact.state?.lang ?? "en", windowOpen: windowOpen(c.contact),
      },
    })),
  });
}

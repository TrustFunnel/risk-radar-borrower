// WhatsApp Cloud API webhook. Meta calls GET once to verify the URL, then
// POSTs every incoming message and every delivery status here.
import { waDeps } from "@/lib/whatsapp/deps";
import { processWebhook } from "@/lib/whatsapp/service";
import { verifyChallenge, verifySignature } from "@/lib/whatsapp/webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: Request) {
  const challenge = verifyChallenge(new URL(req.url).searchParams, process.env.WHATSAPP_VERIFY_TOKEN ?? "");
  return challenge ? new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } }) : new Response("Forbidden", { status: 403 });
}

export async function POST(req: Request) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return new Response("WhatsApp is not configured", { status: 503 });
  const raw = await req.text();
  if (!verifySignature(secret, raw, req.headers.get("x-hub-signature-256"))) return new Response("Invalid signature", { status: 401 });

  let body: unknown;
  try { body = JSON.parse(raw); } catch { return new Response("Bad JSON", { status: 400 }); }

  try {
    const summary = await processWebhook(body, waDeps());
    return Response.json({ ok: true, ...summary });
  } catch (e) {
    // 500 makes Meta retry later; stored message ids stop double replies.
    console.error("whatsapp webhook failed:", (e as Error).message);
    return new Response("Temporary error", { status: 500 });
  }
}

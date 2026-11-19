// Meta webhook: signature check and parsing of the payload into the
// messages and delivery statuses we act on.
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Inbound } from "./types";

// Meta signs every webhook POST with the app secret: header
// X-Hub-Signature-256 = "sha256=" + hex HMAC-SHA256 of the raw body.
export function verifySignature(appSecret: string, rawBody: string, header: string | null): boolean {
  if (!appSecret || !header?.startsWith("sha256=")) return false;
  const got = Buffer.from(header.slice(7), "hex");
  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest();
  return got.length === expected.length && timingSafeEqual(got, expected);
}

export function sign(appSecret: string, rawBody: string): string {
  return "sha256=" + createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
}

// The GET handshake when the webhook is set up in the Meta app dashboard.
export function verifyChallenge(params: URLSearchParams, verifyToken: string): string | null {
  if (!verifyToken) return null;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token") ?? "";
  const challenge = params.get("hub.challenge");
  if (mode !== "subscribe" || !challenge) return null;
  const a = Buffer.from(token), b = Buffer.from(verifyToken);
  return a.length === b.length && timingSafeEqual(a, b) ? challenge : null;
}

export interface InboundMessage {
  wamid: string;
  waId: string; // sender's WhatsApp id: their number, digits only, e.g. 254712345678
  profileName?: string;
  phoneNumberId: string; // our business number that received it
  at: Date;
  type: string; // Meta's type: text, interactive, button, image, document, audio, ...
  inbound: Inbound;
  media?: { id: string; mime?: string; fileName?: string; caption?: string };
}

export interface StatusUpdate {
  wamid: string;
  status: "sent" | "delivered" | "read" | "failed";
  at: Date;
  recipient: string;
  error?: { code?: number; title: string };
  pricingCategory?: string;
}

type Raw = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : undefined);

export function parseWebhook(body: unknown): { messages: InboundMessage[]; statuses: StatusUpdate[] } {
  const messages: InboundMessage[] = [];
  const statuses: StatusUpdate[] = [];
  const root = body as { object?: string; entry?: { changes?: { field?: string; value?: Raw }[] }[] };
  if (root?.object !== "whatsapp_business_account") return { messages, statuses };

  for (const entry of root.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "messages" || !change.value) continue;
      const v = change.value as {
        metadata?: { phone_number_id?: string };
        contacts?: { wa_id?: string; profile?: { name?: string } }[];
        messages?: Raw[];
        statuses?: Raw[];
      };
      const phoneNumberId = v.metadata?.phone_number_id ?? "";
      const names = new Map((v.contacts ?? []).map((c) => [c.wa_id, c.profile?.name]));

      for (const m of v.messages ?? []) {
        const wamid = str(m.id), from = str(m.from), type = str(m.type) ?? "unknown";
        if (!wamid || !from) continue;
        // Reactions and system notices (e.g. "number changed") need no reply.
        if (type === "reaction" || type === "system") continue;
        const parsed = toInbound(type, m);
        messages.push({ wamid, waId: from, profileName: names.get(from), phoneNumberId, at: new Date(Number(m.timestamp ?? 0) * 1000), type, ...parsed });
      }

      for (const s of v.statuses ?? []) {
        const wamid = str(s.id), status = str(s.status);
        if (!wamid || !status || !["sent", "delivered", "read", "failed"].includes(status)) continue;
        const err = (s.errors as { code?: number; title?: string; message?: string; error_data?: { details?: string } }[] | undefined)?.[0];
        statuses.push({
          wamid, status: status as StatusUpdate["status"], at: new Date(Number(s.timestamp ?? 0) * 1000), recipient: str(s.recipient_id) ?? "",
          ...(err ? { error: { code: err.code, title: err.error_data?.details || err.title || err.message || "Unknown error" } } : {}),
          pricingCategory: str((s.pricing as Raw | undefined)?.category),
        });
      }
    }
  }
  return { messages, statuses };
}

function toInbound(type: string, m: Raw): Pick<InboundMessage, "inbound" | "media"> {
  switch (type) {
    case "text":
      return { inbound: { kind: "text", text: str((m.text as Raw)?.body) ?? "" } };
    case "interactive": {
      const i = m.interactive as { type?: string; button_reply?: { id: string; title: string }; list_reply?: { id: string; title: string } };
      const r = i?.button_reply ?? i?.list_reply;
      return r ? { inbound: { kind: "choice", choiceId: r.id, text: r.title } } : { inbound: { kind: "unsupported" } };
    }
    case "button": // quick-reply button on a template message
      return { inbound: { kind: "choice", choiceId: str((m.button as Raw)?.payload), text: str((m.button as Raw)?.text) } };
    case "image":
    case "document":
    case "audio":
    case "video":
    case "sticker": {
      const d = m[type] as { id?: string; mime_type?: string; filename?: string; caption?: string } | undefined;
      if (type === "sticker") return { inbound: { kind: "unsupported" } };
      return {
        inbound: { kind: "media", mediaType: type, text: d?.caption },
        media: d?.id ? { id: d.id, mime: d.mime_type, fileName: d.filename, caption: d.caption } : undefined,
      };
    }
    default: // location, contacts, reaction, order, system, unsupported...
      return { inbound: { kind: "unsupported" } };
  }
}

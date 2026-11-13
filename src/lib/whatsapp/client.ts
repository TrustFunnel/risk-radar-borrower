// Server-only: the WhatsApp Business Platform (Cloud API), called directly
// on Meta's Graph API. No middleman (BSP) and no per-message markup.
// Env: WHATSAPP_TOKEN (system user access token), WHATSAPP_PHONE_NUMBER_ID,
// optional WHATSAPP_GRAPH_VERSION (default v25.0, supported until July 2028).
import type { Reply } from "./types";

export interface SendResult {
  ok: boolean;
  id?: string; // wamid of the sent message
  error?: { code?: number; title: string };
  retryable?: boolean;
}

export interface WaApi {
  send(to: string, reply: Reply): Promise<SendResult>;
  sendTemplate(to: string, name: string, lang: string, params: string[]): Promise<SendResult>;
  markRead(messageId: string): Promise<void>;
  downloadMedia(mediaId: string): Promise<{ ok: true; mime: string; body: ArrayBuffer } | { ok: false; error: string }>;
}

export function waConfigured(): boolean {
  return !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

const clip = (s: string, n: number) => (s.length <= n ? s : s.slice(0, n - 1) + "…");

// The JSON body Meta expects for each kind of reply. Exported for tests.
export function toPayload(to: string, r: Reply): Record<string, unknown> {
  const base = { messaging_product: "whatsapp", recipient_type: "individual", to };
  switch (r.type) {
    case "text":
      return { ...base, type: "text", text: { preview_url: false, body: clip(r.body, 4096) } };
    case "buttons":
      return {
        ...base, type: "interactive",
        interactive: { type: "button", body: { text: clip(r.body, 1024) }, action: { buttons: r.buttons.slice(0, 3).map((b) => ({ type: "reply", reply: { id: b.id, title: clip(b.title, 20) } })) } },
      };
    case "list":
      return {
        ...base, type: "interactive",
        interactive: {
          type: "list", body: { text: clip(r.body, 4096) },
          action: { button: clip(r.button, 20), sections: [{ title: clip(r.button, 24), rows: r.rows.slice(0, 10).map((x) => ({ id: x.id, title: clip(x.title, 24), ...(x.description ? { description: clip(x.description, 72) } : {}) })) }] },
        },
      };
  }
}

type GraphError = { error?: { message?: string; code?: number; error_subcode?: number; error_data?: { details?: string } } };

export function graphApi(opts?: { token?: string; phoneNumberId?: string; version?: string; fetchImpl?: typeof fetch }): WaApi {
  const token = opts?.token ?? process.env.WHATSAPP_TOKEN ?? "";
  const phoneId = opts?.phoneNumberId ?? process.env.WHATSAPP_PHONE_NUMBER_ID ?? "";
  const version = opts?.version ?? process.env.WHATSAPP_GRAPH_VERSION ?? "v25.0";
  const f = opts?.fetchImpl ?? fetch;
  // WHATSAPP_GRAPH_BASE points at a mock Graph API for local simulation only.
  const base = `${(process.env.WHATSAPP_GRAPH_BASE || "https://graph.facebook.com").replace(/\/$/, "")}/${version}`;
  const auth = { Authorization: `Bearer ${token}` };

  async function post(body: Record<string, unknown>): Promise<SendResult> {
    if (!token || !phoneId) return { ok: false, error: { title: "WhatsApp is not configured" } };
    for (let attempt = 0; ; attempt++) {
      let res: Response;
      try {
        res = await f(`${base}/${phoneId}/messages`, { method: "POST", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify(body) });
      } catch (e) {
        if (attempt < 1) continue;
        return { ok: false, error: { title: `Network error: ${(e as Error).message}` }, retryable: true };
      }
      const json = (await res.json().catch(() => ({}))) as GraphError & { messages?: { id: string }[] };
      if (res.ok && json.messages?.[0]?.id) return { ok: true, id: json.messages[0].id };
      const code = json.error?.code;
      // 429, 5xx, and Meta's throttling codes are worth one more try.
      const retryable = res.status === 429 || res.status >= 500 || code === 4 || code === 80007 || code === 130429 || code === 131056;
      if (retryable && attempt < 1) { await new Promise((r) => setTimeout(r, 400)); continue; }
      const title = json.error?.error_data?.details || json.error?.message || `HTTP ${res.status}`;
      return { ok: false, error: { code, title }, retryable };
    }
  }

  return {
    send: (to, reply) => post(toPayload(to, reply)),
    sendTemplate: (to, name, lang, params) =>
      post({
        messaging_product: "whatsapp", to, type: "template",
        template: { name, language: { code: lang }, ...(params.length ? { components: [{ type: "body", parameters: params.map((text) => ({ type: "text", text })) }] } : {}) },
      }),
    async markRead(messageId) {
      if (!token || !phoneId) return;
      await f(`${base}/${phoneId}/messages`, { method: "POST", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify({ messaging_product: "whatsapp", status: "read", message_id: messageId }) }).catch(() => undefined);
    },
    async downloadMedia(mediaId) {
      if (!token) return { ok: false, error: "WhatsApp is not configured" };
      const meta = await f(`${base}/${encodeURIComponent(mediaId)}`, { headers: auth });
      if (!meta.ok) return { ok: false, error: `Media lookup failed: HTTP ${meta.status}` };
      const { url, mime_type } = (await meta.json()) as { url?: string; mime_type?: string };
      if (!url) return { ok: false, error: "Media has no URL (Meta keeps media for 30 days)" };
      // The token goes with the download, so only ever send it to Meta's own hosts.
      if (!/^https:\/\/[^/]*(\.fbsbx\.com|\.facebook\.com|\.whatsapp\.net)\//.test(url)) return { ok: false, error: "Unexpected media host" };
      const file = await f(url, { headers: auth });
      if (!file.ok) return { ok: false, error: `Media download failed: HTTP ${file.status}` };
      return { ok: true, mime: mime_type ?? file.headers.get("content-type") ?? "application/octet-stream", body: await file.arrayBuffer() };
    },
  };
}

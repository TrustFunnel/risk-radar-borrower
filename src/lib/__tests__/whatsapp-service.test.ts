import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { graphApi, toPayload, type WaApi } from "../whatsapp/client";
import { cleanProfileName, coachClose, coachFollowUp, coachReply, phoneFromWaId, processWebhook, type Deps } from "../whatsapp/service";
import { memoryStore, type MemoryStore } from "../whatsapp/store";
import type { Reply } from "../whatsapp/types";
import { parseWebhook, sign, verifyChallenge, verifySignature } from "../whatsapp/webhook";
import { buttonMsg, docMsg, listMsg, PHONE_ID, statusMsg, textMsg } from "./wa-helpers";

const WA = "254712345678";

// A fake Meta API that records what would be sent.
function fakeApi(fail?: (r: Reply) => boolean) {
  const sent: { to: string; reply: Reply; id: string }[] = [];
  const templates: { to: string; name: string; lang: string; params: string[] }[] = [];
  let n = 0;
  const api: WaApi = {
    async send(to, reply) {
      if (fail?.(reply)) return { ok: false, error: { code: 131026, title: "Message undeliverable" } };
      const id = `wamid.out.${++n}`;
      sent.push({ to, reply, id });
      return { ok: true, id };
    },
    async sendTemplate(to, name, lang, params) { templates.push({ to, name, lang, params }); return { ok: true, id: `wamid.tpl.${++n}` }; },
    async markRead() {},
    async downloadMedia() { return { ok: false, error: "n/a" }; },
  };
  return { api, sent, templates };
}

function setup() {
  const store = memoryStore();
  const fake = fakeApi();
  const alerts: string[] = [];
  const deps: Deps = { store, api: fake.api, appUrl: "https://app.example", phoneNumberId: PHONE_ID, notifyCoach: async (c) => { alerts.push(c.priority); } };
  return { store, deps, alerts, ...fake };
}

describe("webhook security and parsing", () => {
  it("accepts only bodies signed with the app secret", () => {
    const body = JSON.stringify(textMsg(WA, "hi"));
    expect(verifySignature("s3cret", body, sign("s3cret", body))).toBe(true);
    expect(verifySignature("s3cret", body + " ", sign("s3cret", body))).toBe(false);
    expect(verifySignature("other", body, sign("s3cret", body))).toBe(false);
    expect(verifySignature("s3cret", body, null)).toBe(false);
    expect(verifySignature("", body, sign("", body))).toBe(false);
  });
  it("answers Meta's verification handshake only with the right token", () => {
    const ok = new URLSearchParams({ "hub.mode": "subscribe", "hub.verify_token": "tok", "hub.challenge": "123" });
    expect(verifyChallenge(ok, "tok")).toBe("123");
    expect(verifyChallenge(ok, "nope")).toBeNull();
    expect(verifyChallenge(ok, "")).toBeNull();
  });
  it("parses text, buttons, lists, documents and statuses, and skips reactions", () => {
    expect(parseWebhook(textMsg(WA, "hello")).messages[0]).toMatchObject({ waId: WA, profileName: "Mercy Wanjiku", inbound: { kind: "text", text: "hello" } });
    expect(parseWebhook(buttonMsg(WA, "lang:sw", "Kiswahili")).messages[0].inbound).toEqual({ kind: "choice", choiceId: "lang:sw", text: "Kiswahili" });
    expect(parseWebhook(listMsg(WA, "menu:app")).messages[0].inbound.choiceId).toBe("menu:app");
    expect(parseWebhook(docMsg(WA)).messages[0]).toMatchObject({ inbound: { kind: "media", mediaType: "document" }, media: { id: "MEDIA1", fileName: "MPESA_Statement.pdf" } });
    expect(parseWebhook(statusMsg("wamid.x", "failed", { code: 131047, title: "Re-engagement message" })).statuses[0]).toMatchObject({ status: "failed", error: { code: 131047 }, pricingCategory: "service" });
    const reaction = textMsg(WA, "x") as unknown as { entry: { changes: { value: { messages: Record<string, unknown>[] } }[] }[] };
    reaction.entry[0].changes[0].value.messages[0].type = "reaction";
    expect(parseWebhook(reaction).messages).toEqual([]);
    expect(parseWebhook({ object: "page" }).messages).toEqual([]);
  });
  it("cleans profile names and recognises Kenyan numbers", () => {
    expect(cleanProfileName("Mercy 💛 W.")).toBe("Mercy");
    expect(cleanProfileName("💰💰")).toBeNull();
    expect(phoneFromWaId("254712345678")).toBe("+254712345678");
    expect(phoneFromWaId("447700900123")).toBeNull();
  });
});

describe("Meta Graph API client", () => {
  it("builds the JSON Meta expects", () => {
    expect(toPayload(WA, { type: "text", body: "Hi" })).toEqual({ messaging_product: "whatsapp", recipient_type: "individual", to: WA, type: "text", text: { preview_url: false, body: "Hi" } });
    const b = toPayload(WA, { type: "buttons", body: "Pick", buttons: [{ id: "a", title: "A title that is much too long" }] }) as { interactive: { action: { buttons: { reply: { title: string } }[] } } };
    expect(b.interactive.action.buttons[0].reply.title).toHaveLength(20);
  });
  it("sends, retries once on a server error, and reports Meta's error details", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const responses = [
      new Response(JSON.stringify({ error: { message: "Service unavailable", code: 2 } }), { status: 503 }),
      new Response(JSON.stringify({ messaging_product: "whatsapp", messages: [{ id: "wamid.OK" }] }), { status: 200 }),
      new Response(JSON.stringify({ error: { message: "(#131047) Re-engagement message", code: 131047, error_data: { details: "More than 24 hours have passed" } } }), { status: 400 }),
    ];
    const api = graphApi({ token: "T", phoneNumberId: "P", version: "v25.0", fetchImpl: (async (url: string, init: RequestInit) => { calls.push({ url, init }); return responses.shift()!; }) as typeof fetch });
    expect(await api.send(WA, { type: "text", body: "hi" })).toEqual({ ok: true, id: "wamid.OK" });
    expect(calls[0].url).toBe("https://graph.facebook.com/v25.0/P/messages");
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe("Bearer T");
    expect(await api.send(WA, { type: "text", body: "late" })).toMatchObject({ ok: false, error: { code: 131047, title: "More than 24 hours have passed" } });
  });
  it("refuses to send the token to a media URL that isn't Meta's", async () => {
    const api = graphApi({ token: "T", phoneNumberId: "P", fetchImpl: (async () => new Response(JSON.stringify({ url: "https://evil.example/x", mime_type: "application/pdf" }))) as unknown as typeof fetch });
    expect(await api.downloadMedia("M1")).toEqual({ ok: false, error: "Unexpected media host" });
  });
  it("says so when not configured", async () => {
    expect(await graphApi({ token: "", phoneNumberId: "" }).send(WA, { type: "text", body: "x" })).toMatchObject({ ok: false, error: { title: "WhatsApp is not configured" } });
  });
});

describe("end to end through the service", () => {
  it("runs a full conversation, stores consent, assessment and case, and alerts the coach", async () => {
    const { store, deps, sent, alerts } = setup();
    for (const p of [
      textMsg(WA, "Hi"), buttonMsg(WA, "lang:en"), buttonMsg(WA, "consent:yes"), textMsg(WA, "Mercy"), textMsg(WA, "4"),
      buttonMsg(WA, "behind:yes"), buttonMsg(WA, "days:30to90"), listMsg(WA, "income:casual"), textMsg(WA, "20000"), textMsg(WA, "12000"), buttonMsg(WA, "pressure:none"),
    ]) await processWebhook(p, deps);
    const d = (store as MemoryStore).dump();
    expect(d.contacts[0]).toMatchObject({ waId: WA, phone: "+254712345678", profileName: "Mercy", state: { step: "human", level: "distressed", name: "Mercy" } });
    expect(d.consents).toMatchObject([{ purpose: "keep", granted: true }]);
    expect(d.assessments[0].result.level).toBe("distressed");
    expect(d.cases).toMatchObject([{ reason: "assessment", status: "open" }]);
    expect(alerts).toEqual(["normal"]);
    expect(sent.every((s) => s.to === WA)).toBe(true);
    expect(d.messages.filter((m) => m.direction === "in")).toHaveLength(11);
    expect(d.messages.filter((m) => m.direction === "out")).toHaveLength(sent.length);
  });

  it("ignores Meta's retries of the same message", async () => {
    const { deps, sent } = setup();
    const p = textMsg(WA, "Hi", "wamid.SAME");
    const a = await processWebhook(p, deps);
    const b = await processWebhook(p, deps);
    expect(a.received).toBe(1);
    expect(b).toMatchObject({ received: 0, duplicates: 1, replies: 0 });
    expect(sent).toHaveLength(1);
  });

  it("ignores events for another phone number on the same Meta app", async () => {
    const { deps, sent } = setup();
    const p = textMsg(WA, "Hi") as unknown as { entry: { changes: { value: { metadata: { phone_number_id: string } } }[] }[] };
    p.entry[0].changes[0].value.metadata.phone_number_id = "OTHER";
    expect((await processWebhook(p, deps)).ignored).toBe(1);
    expect(sent).toHaveLength(0);
  });

  it("tracks delivery statuses forward only, and records failures", async () => {
    const { store, deps, sent } = setup();
    await processWebhook(textMsg(WA, "Hi"), deps);
    const id = sent[0].id;
    await processWebhook(statusMsg(id, "read"), deps);
    await processWebhook(statusMsg(id, "delivered"), deps); // late, must not go backwards
    expect((store as MemoryStore).dump().messages.find((m) => m.wamid === id)?.status).toBe("read");
    await processWebhook(statusMsg(id, "failed", { code: 131026, title: "Message undeliverable" }), deps);
    expect((store as MemoryStore).dump().messages.find((m) => m.wamid === id)).toMatchObject({ status: "failed", errorCode: 131026 });
  });

  it("records a reply Meta refused, without breaking the conversation", async () => {
    const store = memoryStore();
    const fake = fakeApi(() => true);
    const sum = await processWebhook(textMsg(WA, "Hi"), { store, api: fake.api, appUrl: "x" });
    expect(sum.sendErrors).toBe(1);
    expect(store.dump().messages.find((m) => m.direction === "out")).toMatchObject({ status: "error", errorTitle: "Message undeliverable" });
    expect(store.dump().contacts[0].state.step).toBe("lang");
  });

  it("links a WhatsApp number to the borrower's app account once they consent", async () => {
    const { store, deps, sent } = setup();
    (store as MemoryStore).linkAccount("+254712345678", { userId: "user-1", displayName: "Wanjiru", loanCount: 3 });
    for (const p of [textMsg(WA, "Hi"), buttonMsg(WA, "lang:en")]) await processWebhook(p, deps);
    expect((store as MemoryStore).dump().contacts[0].userId).toBeNull(); // not before consent
    await processWebhook(buttonMsg(WA, "consent:yes"), deps);
    expect((store as MemoryStore).dump().contacts[0].userId).toBe("user-1");
    expect(sent.map((s) => s.reply.body).join("\n")).toContain("where you have 3 loans saved");
  });

  it("retries when another webhook updated the same person at the same time", async () => {
    const { store, deps } = setup();
    await processWebhook(textMsg(WA, "Hi"), deps);
    let first = true;
    const racy = { ...store, saveContact: async (...a: Parameters<typeof store.saveContact>) => { if (first) { first = false; return false; } return store.saveContact(...a); } };
    await processWebhook(buttonMsg(WA, "lang:sw"), { ...deps, store: racy });
    expect((store as MemoryStore).dump().contacts[0].state).toMatchObject({ step: "consent", lang: "sw" });
  });

  it("erases everything on DELETE, leaving only a count", async () => {
    const { store, deps, sent } = setup();
    for (const p of [textMsg(WA, "Hi"), buttonMsg(WA, "lang:en"), buttonMsg(WA, "consent:yes"), textMsg(WA, "Mercy"), textMsg(WA, "DELETE"), buttonMsg(WA, "delete:yes")]) await processWebhook(p, deps);
    const d = (store as MemoryStore).dump();
    expect(d).toMatchObject({ contacts: [], messages: [], consents: [], cases: [], assessments: [], erasures: 1 });
    expect(sent[sent.length - 1].reply.body).toContain("erased everything");
  });
});

describe("coach inbox actions", () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ["Date"] }));
  afterEach(() => vi.useRealTimers());

  async function waiting() {
    const s = setup();
    vi.setSystemTime(new Date("2026-11-13T09:00:00Z"));
    for (const p of [textMsg(WA, "Hi"), buttonMsg(WA, "lang:en"), buttonMsg(WA, "consent:yes"), textMsg(WA, "Mercy"), textMsg(WA, "PERSON")]) await processWebhook(p, s.deps);
    const d = (s.store as MemoryStore).dump();
    // The payload builder's timestamps are fixed in the past; make the last message "now".
    await s.store.saveContact(d.contacts[0], { lastInboundAt: new Date().toISOString() }, d.contacts[0].version);
    return { ...s, contactId: d.contacts[0].id, caseId: d.cases[0].id };
  }

  it("sends a coach reply inside the 24-hour window", async () => {
    const { deps, sent, store, contactId } = await waiting();
    expect(await coachReply(deps, contactId, "Hi Mercy, I'm Faith from Afueni.")).toEqual({ ok: true });
    expect(sent[sent.length - 1].reply).toEqual({ type: "text", body: "Hi Mercy, I'm Faith from Afueni." });
    expect((store as MemoryStore).dump().messages.at(-1)).toMatchObject({ author: "coach", status: "sent" });
  });

  it("blocks free text after 24 hours and offers the approved template instead", async () => {
    const { deps, templates, contactId } = await waiting();
    vi.setSystemTime(new Date("2026-11-14T10:00:00Z"));
    const r = await coachReply(deps, contactId, "Are you there?");
    expect(r).toMatchObject({ ok: false, status: 409 });
    expect(await coachFollowUp(deps, contactId)).toEqual({ ok: true });
    expect(templates[0]).toEqual({ to: WA, name: "afueni_follow_up", lang: "en", params: ["Mercy"] });
  });

  it("closing the case hands the chat back to the bot's menu", async () => {
    const { deps, store, sent, contactId, caseId } = await waiting();
    expect(await coachClose(deps, caseId, contactId)).toEqual({ ok: true });
    const c = await store.getContact(contactId);
    expect(c?.state.step).toBe("q_loans"); // was on the loans question when they asked for a person
    await processWebhook(textMsg(WA, "3"), deps);
    expect(sent.at(-1)?.reply.body).toContain("Are you behind");
    expect(await coachClose(deps, caseId, contactId)).toMatchObject({ ok: false, status: 404 });
  });
});

describe("case escalation", () => {
  it("raises an open case to urgent when a safety message arrives, and alerts the coach again", async () => {
    const { store, deps, alerts } = setup();
    for (const p of [textMsg(WA, "Hi"), buttonMsg(WA, "lang:en"), buttonMsg(WA, "consent:yes"), textMsg(WA, "Mercy"), textMsg(WA, "0"), docMsg(WA), textMsg(WA, "I want to die")]) await processWebhook(p, deps);
    const cases = (store as MemoryStore).dump().cases;
    expect(cases).toHaveLength(1);
    expect(cases[0]).toMatchObject({ priority: "urgent", reason: "safety", status: "open" });
    expect(alerts).toEqual(["normal", "urgent"]);
  });
});

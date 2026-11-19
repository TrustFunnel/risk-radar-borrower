// Glue between Meta's webhook, the conversation engine, storage and sending.
import type { WaApi } from "./client";
import { step } from "./flow";
import type { Contact, WaStore } from "./store";
import { CONSENT_VERSION, type CasePriority, type CaseReason, type Reply } from "./types";
import { parseWebhook, type InboundMessage, type StatusUpdate } from "./webhook";

export interface Deps {
  store: WaStore;
  api: WaApi;
  appUrl: string;
  phoneNumberId?: string; // ignore events for any other number on the same Meta app
  notifyCoach?: (c: { priority: CasePriority; reason: CaseReason }) => Promise<void>;
  log?: (msg: string) => void; // must never be given phone numbers or message text
}

export interface ProcessSummary { received: number; duplicates: number; replies: number; sendErrors: number; statuses: number; ignored: number }

const WINDOW_MS = 24 * 60 * 60 * 1000;

export async function processWebhook(body: unknown, deps: Deps): Promise<ProcessSummary> {
  const { messages, statuses } = parseWebhook(body);
  const sum: ProcessSummary = { received: 0, duplicates: 0, replies: 0, sendErrors: 0, statuses: 0, ignored: 0 };
  // Several messages from one person in one payload are handled in order.
  for (const m of messages.sort((a, b) => a.at.getTime() - b.at.getTime())) {
    if (deps.phoneNumberId && m.phoneNumberId !== deps.phoneNumberId) { sum.ignored++; continue; }
    await handleMessage(m, deps, sum);
  }
  for (const s of statuses) await handleStatus(s, deps, sum);
  return sum;
}

// Kenyan numbers to E.164 for matching an app account; others stay null.
export function phoneFromWaId(waId: string): string | null {
  return /^254[17]\d{8}$/.test(waId) ? `+${waId}` : null;
}

// First name only, letters only: the profile name is set by the user and may be anything.
export function cleanProfileName(name?: string): string | null {
  const first = (name ?? "").normalize("NFKC").replace(/[^\p{L}\s'-]/gu, " ").trim().split(/\s+/)[0] ?? "";
  return first.length >= 2 ? first.slice(0, 20) : null;
}

async function handleMessage(m: InboundMessage, deps: Deps, sum: ProcessSummary) {
  const { store } = deps;
  const phone = phoneFromWaId(m.waId);
  let contact = await store.getOrCreateContact(m.waId, phone, cleanProfileName(m.profileName));

  const fresh = await store.addMessage({
    contactId: contact.id, wamid: m.wamid, direction: "in", author: "borrower", type: m.type,
    body: m.inbound.kind === "choice" ? `[${m.inbound.choiceId}] ${m.inbound.text ?? ""}`.trim() : m.inbound.text ?? null,
    media: m.media, status: "received", at: m.at,
  });
  if (!fresh) { sum.duplicates++; return; }
  sum.received++;
  void deps.api.markRead(m.wamid);

  // Compute the next state; if another webhook changed this person meanwhile, reload and redo.
  for (let attempt = 0; attempt < 4; attempt++) {
    const openCase = !!(await store.getOpenCase(contact.id));
    const linked = phone && !contact.userId ? await store.findAccount(phone) : null;
    const result = step(contact.state, m.inbound, {
      profileName: contact.profileName ?? undefined,
      linkedAccount: linked ? { displayName: linked.displayName, loanCount: linked.loanCount } : null,
      appUrl: deps.appUrl,
      openCase,
    });
    const patch: Parameters<WaStore["saveContact"]>[1] = { state: result.state, lastInboundAt: m.at.toISOString() };
    if (linked && result.state.consents.keep) patch.userId = linked.userId;

    if (!(await store.saveContact(contact, patch, contact.version))) {
      const again = await store.getContact(contact.id);
      if (!again) return; // erased meanwhile
      contact = again;
      continue;
    }

    let erase = false;
    for (const fx of result.effects) {
      if (fx.type === "consent") await store.addConsent(contact.id, fx.purpose, fx.granted, CONSENT_VERSION, m.wamid);
      else if (fx.type === "assessment") await store.addAssessment(contact.id, fx.answers, fx.result);
      else if (fx.type === "case") {
        let alert = !!(await store.openCase(contact.id, fx.reason, fx.priority, fx.note));
        if (!alert) {
          const existing = await store.getOpenCase(contact.id);
          alert = !!existing && (await store.escalateCase(existing.id, fx.priority, fx.note));
        }
        if (alert && deps.notifyCoach) await deps.notifyCoach({ priority: fx.priority, reason: fx.reason }).catch(() => deps.log?.("coach alert failed"));
      } else if (fx.type === "erase") erase = true;
    }

    for (const r of result.replies) await sendAndRecord(deps, contact, r, "bot", sum, !erase);
    if (erase) await store.erase(contact.id, "borrower_request");
    return;
  }
  deps.log?.("whatsapp: gave up after repeated concurrent updates");
}

async function sendAndRecord(deps: Deps, contact: Contact, r: Reply, author: "bot" | "coach", sum: ProcessSummary, record = true) {
  const res = await deps.api.send(contact.waId, r);
  if (res.ok) sum.replies++;
  else {
    sum.sendErrors++;
    deps.log?.(`whatsapp: send failed (${res.error?.code ?? "-"}) ${res.error?.title ?? ""}`);
  }
  if (!record) return res;
  await deps.store.addMessage({
    contactId: contact.id, wamid: res.id ?? null, direction: "out", author, type: r.type === "text" ? "text" : "interactive",
    body: r.type === "text" ? r.body : `${r.body}\n${r.type === "buttons" ? r.buttons.map((b) => `[${b.title}]`).join(" ") : r.rows.map((x) => `• ${x.title}`).join("\n")}`,
    status: res.ok ? "sent" : "error", error: res.error,
  });
  return res;
}

async function handleStatus(s: StatusUpdate, deps: Deps, sum: ProcessSummary) {
  await deps.store.updateStatus(s.wamid, s.status, s.at, s.error, s.pricingCategory);
  if (s.status === "failed") deps.log?.(`whatsapp: delivery failed (${s.error?.code ?? "-"}) ${s.error?.title ?? ""}`);
  sum.statuses++;
}

// ---------- Coach actions ----------

export type CoachResult = { ok: true } | { ok: false; status: number; error: string };

export function windowOpen(c: Pick<Contact, "lastInboundAt">, now = Date.now()): boolean {
  return !!c.lastInboundAt && now - new Date(c.lastInboundAt).getTime() < WINDOW_MS;
}

export async function coachReply(deps: Deps, contactId: string, text: string, now = Date.now()): Promise<CoachResult> {
  const body = text.trim();
  if (!body || body.length > 4096) return { ok: false, status: 400, error: "Write a message of 1 to 4096 characters." };
  const c = await deps.store.getContact(contactId);
  if (!c) return { ok: false, status: 404, error: "No such conversation." };
  if (c.state.step === "opted_out") return { ok: false, status: 409, error: "This person sent STOP. Don't message them unless they write again." };
  if (!windowOpen(c, now)) {
    return { ok: false, status: 409, error: "More than 24 hours since their last message, so WhatsApp only allows an approved template. Use 'Send follow-up template'." };
  }
  const sum: ProcessSummary = { received: 0, duplicates: 0, replies: 0, sendErrors: 0, statuses: 0, ignored: 0 };
  const res = await sendAndRecord(deps, c, { type: "text", body }, "coach", sum);
  return res.ok ? { ok: true } : { ok: false, status: 502, error: `WhatsApp refused it: ${res.error?.title ?? "unknown error"}` };
}

// Outside the 24-hour window: an approved utility template that invites the
// person to reply, which reopens the window (see docs/SETUP-whatsapp.md).
export async function coachFollowUp(deps: Deps, contactId: string): Promise<CoachResult> {
  const c = await deps.store.getContact(contactId);
  if (!c) return { ok: false, status: 404, error: "No such conversation." };
  if (c.state.step === "opted_out") return { ok: false, status: 409, error: "This person sent STOP." };
  const name = process.env.WHATSAPP_FOLLOWUP_TEMPLATE || "afueni_follow_up";
  const lang = c.state.lang === "sw" ? "sw" : "en";
  const res = await deps.api.sendTemplate(c.waId, name, lang, [c.state.name ?? c.profileName ?? (lang === "sw" ? "rafiki" : "there")]);
  await deps.store.addMessage({ contactId: c.id, wamid: res.id ?? null, direction: "out", author: "coach", type: "template", body: `[template ${name}/${lang}]`, status: res.ok ? "sent" : "error", error: res.error });
  return res.ok ? { ok: true } : { ok: false, status: 502, error: `WhatsApp refused it: ${res.error?.title ?? "unknown error"}` };
}

// Closing a case hands the conversation back to the bot.
export async function coachClose(deps: Deps, caseId: string, contactId: string): Promise<CoachResult> {
  const closed = await deps.store.closeCase(caseId);
  if (!closed || closed.contactId !== contactId) return { ok: false, status: 404, error: "No such open case." };
  for (let attempt = 0; attempt < 4; attempt++) {
    const c = await deps.store.getContact(contactId);
    if (!c) return { ok: true };
    if (c.state.step !== "human") return { ok: true };
    const back = c.state.resumeStep && !["human", "confirm_delete", "new", "lang"].includes(c.state.resumeStep) ? c.state.resumeStep : c.state.consents.keep ? "menu" : "consent";
    if (await deps.store.saveContact(c, { state: { ...c.state, step: back, resumeStep: undefined, retries: 0 } }, c.version)) return { ok: true };
  }
  return { ok: false, status: 409, error: "The conversation changed while closing; try again." };
}

// Storage for the WhatsApp channel. The Supabase store is used in production;
// the memory store backs the tests and local simulation (npm run wa:simulate).
import type { SupabaseClient } from "@supabase/supabase-js";
import { initialState, type Answers, type Assessment, type CasePriority, type CaseReason, type ConsentPurpose, type ConvState } from "./types";

export interface Contact {
  id: string;
  waId: string;
  phone: string | null;
  profileName: string | null;
  userId: string | null;
  state: ConvState;
  version: number;
  lastInboundAt: string | null;
}

export type MsgStatus = "received" | "sent" | "delivered" | "read" | "failed" | "error";

export interface MessageRow {
  id: number;
  contactId: string;
  wamid: string | null;
  direction: "in" | "out";
  author: "borrower" | "bot" | "coach";
  type: string;
  body: string | null;
  mediaId: string | null;
  mediaMime: string | null;
  fileName: string | null;
  status: MsgStatus;
  errorCode: number | null;
  errorTitle: string | null;
  createdAt: string;
}

export interface CaseRow {
  id: string;
  contactId: string;
  reason: CaseReason;
  priority: CasePriority;
  note: string | null;
  status: "open" | "closed";
  createdAt: string;
  closedAt: string | null;
}

export interface NewMessage {
  contactId: string;
  wamid?: string | null;
  direction: "in" | "out";
  author: MessageRow["author"];
  type: string;
  body?: string | null;
  media?: { id: string; mime?: string; fileName?: string };
  status: MsgStatus;
  error?: { code?: number; title: string };
  at?: Date;
}

export interface WaStore {
  getOrCreateContact(waId: string, phone: string | null, profileName: string | null): Promise<Contact>;
  getContact(id: string): Promise<Contact | null>;
  // Saves the state only if nobody else changed it since `expectedVersion`.
  saveContact(c: Contact, patch: Partial<Pick<Contact, "state" | "userId" | "lastInboundAt" | "profileName">>, expectedVersion: number): Promise<boolean>;
  // false when the wamid was already stored (Meta retried the webhook).
  addMessage(m: NewMessage): Promise<boolean>;
  updateStatus(wamid: string, status: "sent" | "delivered" | "read" | "failed", at: Date, error?: { code?: number; title: string }, pricingCategory?: string): Promise<void>;
  addConsent(contactId: string, purpose: ConsentPurpose, granted: boolean, version: string, sourceWamid: string | null): Promise<void>;
  openCase(contactId: string, reason: CaseReason, priority: CasePriority, note: string): Promise<CaseRow | null>; // null if one is already open
  getOpenCase(contactId: string): Promise<CaseRow | null>;
  // Raises the open case's priority (never lowers it) and adds to its note. True if it changed.
  escalateCase(caseId: string, priority: CasePriority, note: string): Promise<boolean>;
  closeCase(caseId: string): Promise<CaseRow | null>;
  listCases(status: "open" | "closed"): Promise<(CaseRow & { contact: Pick<Contact, "id" | "waId" | "profileName" | "state" | "lastInboundAt"> })[]>;
  messages(contactId: string, limit?: number): Promise<MessageRow[]>;
  getMessage(id: number): Promise<MessageRow | null>;
  addAssessment(contactId: string, answers: Answers, result: Assessment): Promise<void>;
  erase(contactId: string, reason: string): Promise<void>;
  findAccount(phone: string): Promise<{ userId: string; displayName: string; loanCount: number } | null>;
}

export const PRIORITY_RANK: Record<CasePriority, number> = { normal: 0, high: 1, urgent: 2 };
const RANK: Record<string, number> = { received: 0, error: 0, sent: 1, delivered: 2, read: 3, failed: 4 };

// ---------------- Memory store ----------------

export type Account = { userId: string; displayName: string; loanCount: number };
export type MemoryStore = WaStore & {
  linkAccount(phone: string, a: Account): void;
  dump(): { contacts: Contact[]; messages: MessageRow[]; consents: { contactId: string; purpose: ConsentPurpose; granted: boolean }[]; cases: CaseRow[]; assessments: { contactId: string; answers: Answers; result: Assessment }[]; erasures: number };
};

export function memoryStore(): MemoryStore {
  const contacts = new Map<string, Contact>();
  const messages: MessageRow[] = [];
  const consents: { contactId: string; purpose: ConsentPurpose; granted: boolean; version: string; sourceWamid: string | null; at: string }[] = [];
  const cases: CaseRow[] = [];
  const assessments: { contactId: string; answers: Answers; result: Assessment }[] = [];
  let erasures = 0, seq = 0;
  const uid = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;
  const copy = <T>(x: T): T => structuredClone(x);
  const accounts = new Map<string, Account>();

  return {
    linkAccount(phone, a) { accounts.set(phone, a); },
    async getOrCreateContact(waId, phone, profileName) {
      let c = [...contacts.values()].find((x) => x.waId === waId);
      if (!c) {
        c = { id: uid(), waId, phone, profileName, userId: null, state: initialState(), version: 0, lastInboundAt: null };
        contacts.set(c.id, c);
      }
      return copy(c);
    },
    async getContact(id) { const c = contacts.get(id); return c ? copy(c) : null; },
    async saveContact(c, patch, expectedVersion) {
      const cur = contacts.get(c.id);
      if (!cur || cur.version !== expectedVersion) return false;
      contacts.set(c.id, { ...cur, ...copy(patch), version: cur.version + 1 });
      return true;
    },
    async addMessage(m) {
      if (m.wamid && messages.some((x) => x.wamid === m.wamid)) return false;
      messages.push({
        id: messages.length + 1, contactId: m.contactId, wamid: m.wamid ?? null, direction: m.direction, author: m.author, type: m.type, body: m.body ?? null,
        mediaId: m.media?.id ?? null, mediaMime: m.media?.mime ?? null, fileName: m.media?.fileName ?? null, status: m.status,
        errorCode: m.error?.code ?? null, errorTitle: m.error?.title ?? null, createdAt: (m.at ?? new Date()).toISOString(),
      });
      return true;
    },
    async updateStatus(wamid, status, _at, error) {
      const m = messages.find((x) => x.wamid === wamid);
      if (!m || RANK[status] <= RANK[m.status]) return;
      m.status = status;
      if (error) { m.errorCode = error.code ?? null; m.errorTitle = error.title; }
    },
    async addConsent(contactId, purpose, granted, version, sourceWamid) { consents.push({ contactId, purpose, granted, version, sourceWamid, at: new Date().toISOString() }); },
    async openCase(contactId, reason, priority, note) {
      if (cases.some((x) => x.contactId === contactId && x.status === "open")) return null;
      const row: CaseRow = { id: uid(), contactId, reason, priority, note, status: "open", createdAt: new Date().toISOString(), closedAt: null };
      cases.push(row);
      return copy(row);
    },
    async getOpenCase(contactId) { const x = cases.find((c) => c.contactId === contactId && c.status === "open"); return x ? copy(x) : null; },
    async escalateCase(caseId, priority, note) {
      const x = cases.find((c) => c.id === caseId && c.status === "open");
      if (!x || PRIORITY_RANK[priority] <= PRIORITY_RANK[x.priority]) return false;
      x.priority = priority; x.reason = priority === "urgent" ? "safety" : x.reason; x.note = `${note} | ${x.note ?? ""}`;
      return true;
    },
    async closeCase(caseId) {
      const x = cases.find((c) => c.id === caseId && c.status === "open");
      if (!x) return null;
      x.status = "closed"; x.closedAt = new Date().toISOString();
      return copy(x);
    },
    async listCases(status) {
      return cases.filter((c) => c.status === status).map((c) => {
        const k = contacts.get(c.contactId)!;
        return { ...copy(c), contact: { id: k.id, waId: k.waId, profileName: k.profileName, state: copy(k.state), lastInboundAt: k.lastInboundAt } };
      });
    },
    async messages(contactId, limit = 200) { return copy(messages.filter((m) => m.contactId === contactId).slice(-limit)); },
    async getMessage(id) { const m = messages.find((x) => x.id === id); return m ? copy(m) : null; },
    async addAssessment(contactId, answers, result) { assessments.push({ contactId, answers: copy(answers), result: copy(result) }); },
    async erase(contactId) {
      contacts.delete(contactId);
      for (const list of [messages, consents, cases, assessments] as { contactId: string }[][]) {
        for (let i = list.length - 1; i >= 0; i--) if (list[i].contactId === contactId) list.splice(i, 1);
      }
      erasures++;
    },
    async findAccount(phone) { return accounts.get(phone) ?? null; },
    dump: () => ({ contacts: copy([...contacts.values()]), messages: copy(messages), consents: copy(consents), cases: copy(cases), assessments: copy(assessments), erasures }),
  };
}

// ---------------- Supabase store ----------------

type Row = Record<string, unknown>;
const contactFrom = (r: Row): Contact => ({
  id: r.id as string, waId: r.wa_id as string, phone: (r.phone as string) ?? null, profileName: (r.profile_name as string) ?? null,
  userId: (r.user_id as string) ?? null, state: { ...initialState(), ...(r.state as ConvState) }, version: r.version as number, lastInboundAt: (r.last_inbound_at as string) ?? null,
});
const messageFrom = (r: Row): MessageRow => ({
  id: Number(r.id), contactId: r.contact_id as string, wamid: (r.wamid as string) ?? null, direction: r.direction as "in" | "out", author: r.author as MessageRow["author"],
  type: r.type as string, body: (r.body as string) ?? null, mediaId: (r.media_id as string) ?? null, mediaMime: (r.media_mime as string) ?? null, fileName: (r.file_name as string) ?? null,
  status: r.status as MsgStatus, errorCode: (r.error_code as number) ?? null, errorTitle: (r.error_title as string) ?? null, createdAt: r.created_at as string,
});
const caseFrom = (r: Row): CaseRow => ({
  id: r.id as string, contactId: r.contact_id as string, reason: r.reason as CaseReason, priority: r.priority as CasePriority, note: (r.note as string) ?? null,
  status: r.status as "open" | "closed", createdAt: r.created_at as string, closedAt: (r.closed_at as string) ?? null,
});

function must<T>(res: { data: T; error: { message: string; code?: string } | null }, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return res.data;
}

export function supabaseStore(db: SupabaseClient): WaStore {
  return {
    async getOrCreateContact(waId, phone, profileName) {
      const found = must(await db.from("wa_contacts").select("*").eq("wa_id", waId).maybeSingle(), "load contact");
      if (found) return contactFrom(found);
      const ins = await db.from("wa_contacts").insert({ wa_id: waId, phone, profile_name: profileName, state: initialState() }).select("*").single();
      if (ins.error?.code === "23505") return contactFrom(must(await db.from("wa_contacts").select("*").eq("wa_id", waId).single(), "load contact")!);
      return contactFrom(must(ins, "create contact"));
    },
    async getContact(id) {
      const r = must(await db.from("wa_contacts").select("*").eq("id", id).maybeSingle(), "load contact");
      return r ? contactFrom(r) : null;
    },
    async saveContact(c, patch, expectedVersion) {
      const row: Row = { version: expectedVersion + 1, updated_at: new Date().toISOString() };
      if (patch.state) row.state = patch.state;
      if (patch.userId !== undefined) row.user_id = patch.userId;
      if (patch.lastInboundAt !== undefined) row.last_inbound_at = patch.lastInboundAt;
      if (patch.profileName !== undefined) row.profile_name = patch.profileName;
      const r = must(await db.from("wa_contacts").update(row).eq("id", c.id).eq("version", expectedVersion).select("id"), "save contact");
      return (r?.length ?? 0) === 1;
    },
    async addMessage(m) {
      const res = await db.from("wa_messages").insert({
        contact_id: m.contactId, wamid: m.wamid ?? null, direction: m.direction, author: m.author, type: m.type, body: m.body ?? null,
        media_id: m.media?.id ?? null, media_mime: m.media?.mime ?? null, file_name: m.media?.fileName ?? null, status: m.status,
        error_code: m.error?.code ?? null, error_title: m.error?.title ?? null, ...(m.at ? { created_at: m.at.toISOString() } : {}),
      });
      if (res.error?.code === "23505") return false;
      must(res, "store message");
      return true;
    },
    async updateStatus(wamid, status, at, error, pricingCategory) {
      // Statuses can arrive out of order; only move forward (failed always wins).
      const lower = Object.keys(RANK).filter((k) => RANK[k] < RANK[status]);
      must(await db.from("wa_messages").update({
        status, status_at: at.toISOString(), ...(error ? { error_code: error.code ?? null, error_title: error.title } : {}), ...(pricingCategory ? { pricing_category: pricingCategory } : {}),
      }).eq("wamid", wamid).in("status", lower), "update status");
    },
    async addConsent(contactId, purpose, granted, version, sourceWamid) {
      must(await db.from("wa_consents").insert({ contact_id: contactId, purpose, granted, version, source_wamid: sourceWamid }), "store consent");
    },
    async openCase(contactId, reason, priority, note) {
      const res = await db.from("wa_cases").insert({ contact_id: contactId, reason, priority, note }).select("*").single();
      if (res.error?.code === "23505") return null;
      return caseFrom(must(res, "open case"));
    },
    async getOpenCase(contactId) {
      const r = must(await db.from("wa_cases").select("*").eq("contact_id", contactId).eq("status", "open").maybeSingle(), "load case");
      return r ? caseFrom(r) : null;
    },
    async escalateCase(caseId, priority, note) {
      const cur = must(await db.from("wa_cases").select("*").eq("id", caseId).eq("status", "open").maybeSingle(), "load case");
      if (!cur || PRIORITY_RANK[priority] <= PRIORITY_RANK[cur.priority as CasePriority]) return false;
      must(await db.from("wa_cases").update({ priority, ...(priority === "urgent" ? { reason: "safety" } : {}), note: `${note} | ${cur.note ?? ""}` }).eq("id", caseId), "escalate case");
      return true;
    },
    async closeCase(caseId) {
      const r = must(await db.from("wa_cases").update({ status: "closed", closed_at: new Date().toISOString() }).eq("id", caseId).eq("status", "open").select("*"), "close case");
      return r?.[0] ? caseFrom(r[0]) : null;
    },
    async listCases(status) {
      const rows = must(await db.from("wa_cases").select("*, wa_contacts(id, wa_id, profile_name, state, last_inbound_at)").eq("status", status).order("created_at", { ascending: status === "open" }).limit(200), "list cases");
      return (rows ?? []).map((r: Row) => {
        const k = r.wa_contacts as Row;
        return { ...caseFrom(r), contact: { id: k.id as string, waId: k.wa_id as string, profileName: (k.profile_name as string) ?? null, state: k.state as ConvState, lastInboundAt: (k.last_inbound_at as string) ?? null } };
      });
    },
    async messages(contactId, limit = 200) {
      const rows = must(await db.from("wa_messages").select("*").eq("contact_id", contactId).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(limit), "load messages");
      return (rows ?? []).map(messageFrom).reverse();
    },
    async getMessage(id) {
      const r = must(await db.from("wa_messages").select("*").eq("id", id).maybeSingle(), "load message");
      return r ? messageFrom(r) : null;
    },
    async addAssessment(contactId, answers, result) {
      must(await db.from("wa_assessments").insert({ contact_id: contactId, answers, level: result.level, dsr: result.dsr, reasons: result.reasons }), "store assessment");
    },
    async erase(contactId, reason) {
      must(await db.from("wa_contacts").delete().eq("id", contactId), "erase contact");
      must(await db.from("wa_erasures").insert({ reason }), "log erasure");
    },
    async findAccount(phone) {
      const p = must(await db.from("profiles").select("user_id, display_name").eq("phone", phone).limit(1).maybeSingle(), "find account");
      if (!p) return null;
      const { count } = await db.from("loans").select("id", { count: "exact", head: true }).eq("user_id", p.user_id).neq("status", "closed");
      return { userId: p.user_id as string, displayName: p.display_name as string, loanCount: count ?? 0 };
    },
  };
}

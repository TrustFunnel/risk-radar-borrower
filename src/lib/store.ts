"use client";

import { consentFromRow, docFromRow, docToRow, loanFromRow, loanToRow, profileFromRow, profileToRow, requestFromRow, requestToRow } from "./rows";
import { supabase } from "./supabase";
import type { ConsentPurpose, ConsentRecord, DistressRequest, DocRecord, Loan, Profile } from "./types";
import { CONSENT_VERSION } from "./types";

// One store, two backends:
// - demo mode: everything lives in this browser's localStorage.
// - accounts mode: Supabase is the source of truth. The store keeps an
//   in-memory copy so screens read synchronously; writes update the copy at
//   once and are saved in the background. A failed save raises "rr-store-error".

const KEY = "rr-borrower-v1";

export interface Db {
  profile: Profile | null;
  consents: ConsentRecord[];
  loans: Loan[];
  requests: DistressRequest[];
  documents: DocRecord[];
}

const empty = (): Db => ({ profile: null, consents: [], loans: [], requests: [], documents: [] });

let remoteUser: string | null = null; // set while signed in
let cache: Db | null = null;

function loadLocal(): Db {
  if (typeof window === "undefined") return empty();
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? { ...empty(), ...JSON.parse(raw) } : empty();
  } catch {
    return empty();
  }
}

function emit(name = "rr-store", detail?: string) {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(name, { detail }));
}

function commit(db: Db) {
  if (remoteUser) cache = db;
  else {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(db));
    } catch {
      // Storage blocked (private mode): the session still works in memory.
    }
  }
  emit();
}

const current = (): Db => (remoteUser ? (cache ?? empty()) : loadLocal());

// Supabase writes run in the background, one at a time and in order, so a
// consent is always saved before the loan or request that depends on it
// (the database rejects those without consent). Failures reach the screen.
let queue: Promise<unknown> = Promise.resolve();

function persist(what: string, op: () => PromiseLike<{ error: { message: string } | null }>) {
  if (!remoteUser || !supabase) return;
  queue = queue.then(() => op()).then(
    (r) => { const { error } = r as { error: { message: string } | null }; if (error) emit("rr-store-error", `Couldn't save ${what}: ${error.message}`); },
    (e: Error) => emit("rr-store-error", `Couldn't save ${what}: ${e.message}`),
  );
}

export const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);

export const store = {
  snapshot: current,

  isRemote: () => !!remoteUser,

  // Load the signed-in borrower's data from Supabase.
  async signIn(userId: string) {
    if (!supabase) return;
    const [p, c, l, r, d] = await Promise.all([
      supabase.from("profiles").select("*").maybeSingle(),
      supabase.from("consents").select("*").order("at"),
      supabase.from("loans").select("*").order("created_at"),
      supabase.from("distress_requests").select("*").order("created_at"),
      supabase.from("documents").select("*").order("created_at"),
    ]);
    const err = p.error ?? c.error ?? l.error ?? r.error ?? d.error;
    if (err) throw new Error(err.message);
    remoteUser = userId;
    cache = {
      profile: p.data ? profileFromRow(p.data) : null,
      consents: (c.data ?? []).map(consentFromRow),
      loans: (l.data ?? []).map(loanFromRow),
      requests: (r.data ?? []).map(requestFromRow),
      documents: (d.data ?? []).map(docFromRow),
    };
    emit();
  },

  signOut() {
    remoteUser = null;
    cache = null;
    emit();
  },

  // Demo data left on this phone from before the borrower had an account.
  localDemoData: (): Db | null => {
    const d = loadLocal();
    return d.loans.length ? d : null;
  },

  // Copy demo loans into the account, then clear them from the phone.
  async importLocal() {
    const d = loadLocal();
    if (!remoteUser || !supabase || !d.loans.length) return 0;
    const db = current();
    const loans = d.loans.map((l) => ({ ...l, id: newId() }));
    await queue; // pending consents first
    const { error } = await supabase.from("loans").insert(loans.map((l) => loanToRow(l, remoteUser!)));
    if (error) throw new Error(error.message);
    commit({ ...db, loans: [...db.loans, ...loans] });
    try { window.localStorage.removeItem(KEY); } catch {}
    return loans.length;
  },

  saveProfile(p: Profile) {
    const db = current();
    commit({ ...db, profile: p });
    persist("your profile", () => supabase!.from("profiles").upsert(profileToRow(p, remoteUser!)));
  },

  setConsent(purpose: ConsentPurpose, granted: boolean) {
    const db = current();
    const rec: ConsentRecord = { purpose, granted, version: CONSENT_VERSION, at: new Date().toISOString() };
    commit({ ...db, consents: [...db.consents, rec] });
    persist("your consent", () => supabase!.from("consents").insert({ user_id: remoteUser, purpose, granted, version: rec.version }));
  },

  // The latest record per purpose wins; the full history is kept as the audit trail.
  hasConsent(purpose: ConsentPurpose, db = current()): boolean {
    const last = [...db.consents].reverse().find((c) => c.purpose === purpose);
    return !!last?.granted;
  },

  saveLoan(loan: Omit<Loan, "id" | "createdAt" | "updatedAt"> & { id?: string }) {
    const db = current();
    const now = new Date().toISOString();
    const existing = loan.id ? db.loans.find((l) => l.id === loan.id) : undefined;
    const saved: Loan = existing
      ? { ...existing, ...loan, id: existing.id, updatedAt: now }
      : ({ ...loan, id: newId(), createdAt: now, updatedAt: now } as Loan);
    commit({ ...db, loans: existing ? db.loans.map((l) => (l.id === saved.id ? saved : l)) : [...db.loans, saved] });
    persist("the loan", () => supabase!.from("loans").upsert(loanToRow(saved, remoteUser!)));
  },

  deleteLoan(id: string) {
    const db = current();
    commit({ ...db, loans: db.loans.filter((l) => l.id !== id), requests: db.requests.filter((r) => r.loanId !== id) });
    persist("the deletion", () => supabase!.from("loans").delete().eq("id", id));
  },

  addRequest(r: Omit<DistressRequest, "id" | "createdAt" | "status">) {
    const db = current();
    const req: DistressRequest = { ...r, id: newId(), status: "submitted", createdAt: new Date().toISOString() };
    commit({ ...db, requests: [...db.requests, req] });
    persist("your request", () => supabase!.from("distress_requests").insert(requestToRow(req, remoteUser!)));
  },

  addDocument(d: Omit<DocRecord, "id" | "createdAt">) {
    const db = current();
    const doc: DocRecord = { ...d, id: newId(), createdAt: new Date().toISOString() };
    commit({ ...db, documents: [...db.documents, doc] });
    persist("the document", () => supabase!.from("documents").insert(docToRow(doc, remoteUser!)));
    return doc;
  },

  deleteDocument(id: string) {
    const db = current();
    commit({ ...db, documents: db.documents.filter((d) => d.id !== id) });
    persist("the deletion", () => supabase!.from("documents").delete().eq("id", id));
  },

  // Supabase access token for calls to our own API routes.
  async token(): Promise<string | undefined> {
    if (!supabase) return undefined;
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token;
  },

  exportAll(): string {
    return JSON.stringify(current(), null, 2);
  },

  // Demo mode: wipe this browser. Accounts mode: delete the account and
  // everything linked to it, then sign out.
  async deleteAll() {
    if (remoteUser && supabase) {
      const { error } = await supabase.rpc("delete_my_account");
      if (error) throw new Error(error.message);
      await supabase.auth.signOut();
      store.signOut();
    }
    try {
      window.localStorage.removeItem(KEY);
    } catch {}
    emit();
  },
};

"use client";

import type { ConsentPurpose, ConsentRecord, DistressRequest, Loan, Profile } from "./types";
import { CONSENT_VERSION } from "./types";

// Demo storage: everything lives in this browser's localStorage. It keeps the
// app usable before Supabase is configured, and nothing leaves the device.
// The Supabase-backed store (src/lib/supabase-store.ts) implements the same API.

const KEY = "rr-borrower-v1";

interface Db {
  profile: Profile | null;
  consents: ConsentRecord[];
  loans: Loan[];
  requests: DistressRequest[];
}

const empty = (): Db => ({ profile: null, consents: [], loans: [], requests: [] });

function load(): Db {
  if (typeof window === "undefined") return empty();
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? { ...empty(), ...JSON.parse(raw) } : empty();
  } catch {
    return empty();
  }
}

function save(db: Db) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(db));
    window.dispatchEvent(new Event("rr-store"));
  } catch {
    // Storage blocked (private mode): the session still works in memory.
  }
}

export const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);

export const store = {
  snapshot: load,

  saveProfile(p: Profile) {
    const db = load();
    db.profile = p;
    save(db);
  },

  setConsent(purpose: ConsentPurpose, granted: boolean) {
    const db = load();
    db.consents.push({ purpose, granted, version: CONSENT_VERSION, at: new Date().toISOString() });
    save(db);
  },

  // The latest record per purpose wins; the full history is kept as the audit trail.
  hasConsent(purpose: ConsentPurpose, db = load()): boolean {
    const last = [...db.consents].reverse().find((c) => c.purpose === purpose);
    return !!last?.granted;
  },

  saveLoan(loan: Omit<Loan, "id" | "createdAt" | "updatedAt"> & { id?: string }) {
    const db = load();
    const now = new Date().toISOString();
    const existing = loan.id ? db.loans.find((l) => l.id === loan.id) : undefined;
    if (existing) Object.assign(existing, loan, { updatedAt: now });
    else db.loans.push({ ...loan, id: newId(), createdAt: now, updatedAt: now } as Loan);
    save(db);
  },

  deleteLoan(id: string) {
    const db = load();
    db.loans = db.loans.filter((l) => l.id !== id);
    db.requests = db.requests.filter((r) => r.loanId !== id);
    save(db);
  },

  addRequest(r: Omit<DistressRequest, "id" | "createdAt" | "status">) {
    const db = load();
    db.requests.push({ ...r, id: newId(), status: "submitted", createdAt: new Date().toISOString() });
    save(db);
  },

  exportAll(): string {
    return JSON.stringify(load(), null, 2);
  },

  deleteAll() {
    try {
      window.localStorage.removeItem(KEY);
      window.dispatchEvent(new Event("rr-store"));
    } catch {}
  },
};

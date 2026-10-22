import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { latestConsent, nairobiToday, remindersFor } from "../reminders";
import { loanFromRow, loanToRow } from "../rows";
import { verifyHook } from "../sms";
import { normaliseKenyanPhone } from "../supabase";
import type { Loan } from "../types";

const loan: Loan = {
  id: "L1", lender: "KCB Bank", lenderType: "bank",
  terms: { principal: 120000, rate: 0, rateType: "reducing_annual", frequency: "monthly", installments: 12, installmentAmount: 11000 },
  disbursedOn: "2026-09-01", firstDueDate: "2026-10-05", arrearsDays: 0, status: "current",
  createdAt: "2026-09-01T00:00:00Z", updatedAt: "2026-09-01T00:00:00Z",
};

describe("phone numbers", () => {
  it.each([
    ["0712 345 678", "+254712345678"],
    ["712345678", "+254712345678"],
    ["+254 112 345 678", "+254112345678"],
    ["254712345678", "+254712345678"],
  ])("normalises %s", (input, out) => expect(normaliseKenyanPhone(input)).toBe(out));
  it("rejects non-Kenyan mobiles", () => {
    expect(normaliseKenyanPhone("020 123 4567")).toBeNull();
    expect(normaliseKenyanPhone("+44 7700 900123")).toBeNull();
  });
});

describe("Supabase SMS hook signature", () => {
  const raw = Buffer.from("super-secret-key-bytes").toString("base64");
  const secret = `v1,whsec_${raw}`;
  const body = JSON.stringify({ user: { phone: "254712345678" }, sms: { otp: "123456" } });
  const sign = (id: string, ts: number) => createHmac("sha256", Buffer.from(raw, "base64")).update(`${id}.${ts}.${body}`).digest("base64");
  const now = 1_790_000_000_000;
  const ts = Math.floor(now / 1000);
  const headers = (sig: string, t = ts) => new Headers({ "webhook-id": "msg_1", "webhook-timestamp": String(t), "webhook-signature": `v1,${sig}` });

  it("accepts a valid signature", () => expect(verifyHook(secret, headers(sign("msg_1", ts)), body, now)).toBe(true));
  it("rejects a tampered body", () => expect(verifyHook(secret, headers(sign("msg_1", ts)), body.replace("123456", "999999"), now)).toBe(false));
  it("rejects an old timestamp", () => expect(verifyHook(secret, headers(sign("msg_1", ts - 600), ts - 600), body, now)).toBe(false));
});

describe("reminders", () => {
  it("texts 3 days before and on the due date only", () => {
    const at = (iso: string) => new Date(iso + "T00:00:00");
    expect(remindersFor([loan], at("2026-11-02")).map((r) => [r.kind, r.dueDate])).toEqual([["due_3d", "2026-11-05"]]);
    expect(remindersFor([loan], at("2026-11-05")).map((r) => r.kind)).toEqual(["due_today"]);
    expect(remindersFor([loan], at("2026-11-04"))).toEqual([]);
    expect(remindersFor([{ ...loan, status: "closed" }], at("2026-11-05"))).toEqual([]);
  });
  it("mentions the lender and amount", () => {
    const [r] = remindersFor([loan], new Date("2026-11-02T00:00:00"));
    expect(r.message).toContain("KCB Bank");
    expect(r.message).toContain("KES 11,000");
  });
  it("uses the Nairobi date even late in the UTC day", () => {
    const d = nairobiToday(new Date("2026-11-01T22:30:00Z")); // 01:30 on 2 Nov in Nairobi
    expect([d.getFullYear(), d.getMonth() + 1, d.getDate()]).toEqual([2026, 11, 2]);
  });
  it("follows the latest consent", () => {
    expect(latestConsent([
      { purpose: "reminders", granted: true, version: "v", at: "2026-10-01T00:00:00Z" },
      { purpose: "reminders", granted: false, version: "v", at: "2026-10-02T00:00:00Z" },
    ], "reminders")).toBe(false);
  });
});

describe("row mapping", () => {
  it("round-trips a loan through a database row", () => {
    const row = { ...loanToRow(loan, "user-1"), created_at: loan.createdAt, principal: "120000.00", installment_amount: "11000.00" };
    expect(loanFromRow(row)).toEqual({ ...loan, productName: undefined, outstandingBalance: undefined, notes: undefined, terms: { ...loan.terms, termDays: undefined, upfrontFees: undefined } });
  });
});

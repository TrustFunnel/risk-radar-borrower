import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseKbaReport, productRates } from "../../../scripts/kba-parse.mjs";
import { allOffers, compareLoan, detailsOf, loanKind, quoteOffer, sameLender } from "../compare";
import type { LenderProduct } from "../market";
import type { Loan } from "../types";

const kba = (lenderId: string, lender: string, rate: number, kind: LenderProduct["kind"] = "personal"): LenderProduct => ({
  lenderId, lender, lenderType: "bank", kind, product: "x", rate, rateType: "reducing_annual", feesIncluded: false, sourceUrl: "https://kba", checkedOn: "2026-10-26",
});

const loan = (over: Omit<Partial<Loan>, "terms"> & { terms?: Partial<Loan["terms"]> }): Loan => ({
  id: "l1", lender: "KCB", lenderType: "bank", disbursedOn: "2026-10-01", firstDueDate: "2026-11-01",
  arrearsDays: 0, status: "current", createdAt: "", updatedAt: "",
  ...over,
  terms: { principal: 200000, rate: 20, rateType: "reducing_annual", frequency: "monthly", installments: 24, ...over.terms },
});

describe("KBA report parser, all products", () => {
  it("reads every product column", () => {
    const md = readFileSync(new URL("../../../scripts/fixtures/kba-interest-rate-2026-10-21.md", import.meta.url), "utf8");
    const rows = productRates(parseKbaReport(md));
    const kinds = new Set(rows.map((r: { kind: string }) => r.kind));
    expect([...kinds].sort()).toEqual(["asset", "business", "mobile", "mortgage", "personal"]);
    expect(rows.filter((r: { kind: string }) => r.kind === "personal").length).toBe(41);
  });
});

describe("which product a loan is", () => {
  it("reads the lender type and product name", () => {
    expect(loanKind({ lenderType: "digital", lender: "Tala" })).toBe("mobile");
    expect(loanKind({ lenderType: "bank", lender: "NCBA", productName: "M-Shwari" })).toBe("mobile");
    expect(loanKind({ lenderType: "bank", lender: "Stanbic", productName: "Car loan" })).toBe("asset");
    expect(loanKind({ lenderType: "bank", lender: "HFC", productName: "Mortgage" })).toBe("mortgage");
    expect(loanKind({ lenderType: "sacco", lender: "Stima Sacco", productName: "Development loan" })).toBe("personal");
  });
  it("matches lender names loosely", () => {
    expect(sameLender("KCB", "KCB Bank Kenya Limited")).toBe(true);
    expect(sameLender("Co-op Bank", "Co-operative Bank of Kenya Limited")).toBe(true);
    expect(sameLender("Equity", "KCB Bank Kenya Limited")).toBe(false);
  });
});

describe("offers", () => {
  const offers = allOffers([kba("kcb", "KCB Bank Kenya Limited", 16), kba("co-operative", "Co-op", 4, "mobile"), kba("branch-microfinance", "Branch Microfinance Bank Ltd", 16.69, "mobile")]);
  it("drops premium-only rates and lets a lender's own page win", () => {
    expect(offers.find((o) => o.id === "co-operative:mobile")).toBeUndefined();
    const branch = offers.filter((o) => o.lenderId === "branch-microfinance");
    expect(branch).toHaveLength(1);
    expect(branch[0].rateMax).toBe(17.6);
  });
  it("prices M-Shwari and Fuliza from their published fees", () => {
    const mshwari = offers.find((o) => o.id === "mshwari:mobile")!;
    expect(quoteOffer(mshwari, 10000, 1).totalCost).toBeCloseTo(900); // 7.5% fee + 1.5% excise
    const fuliza = offers.find((o) => o.id === "fuliza:mobile")!;
    expect(quoteOffer(fuliza, 3000, 1).totalCost).toBeCloseTo(930); // 1% + 30 days x KES 30
  });
  it("adds the assumed fee to bank rates and flags amounts over the limit", () => {
    const kcb = offers.find((o) => o.id === "kcb:personal")!;
    const q = quoteOffer(kcb, 100000, 12, 3);
    expect(q.totalCost).toBeGreaterThan(3000);
    expect(quoteOffer(kcb, 5_000_000, 12).overLimit).toBe(true);
  });
  it("falls back to typical requirements", () => {
    const d = detailsOf(offers.find((o) => o.id === "kcb:personal")!);
    expect(d.requirementsTypical).toBe(false);
    expect(d.requirements).toContain("KRA PIN");
  });
});

describe("comparing a loan", () => {
  const offers = allOffers([kba("kcb", "KCB Bank Kenya Limited", 16), kba("equity", "Equity Bank Kenya Limited", 30)]);
  it("ranks the same product, cheapest first, and marks your lender", () => {
    const c = compareLoan(loan({ lender: "Equity Bank", terms: { rate: 30 } }), offers, 3, new Date("2026-10-15"));
    expect(c.kind).toBe("personal");
    expect(c.months).toBe(24);
    expect(c.rows[0].offer.lenderId).not.toBe("equity");
    expect(c.rows[0].saving).toBeGreaterThan(0);
    expect(c.rows.find((r) => r.offer.lenderId === "equity")?.yours).toBe(true);
    expect(c.rows.every((r) => r.offer.kind === "personal")).toBe(true);
  });
  it("compares a mobile loan over 30 days", () => {
    const c = compareLoan(loan({ lender: "Tala", lenderType: "digital", terms: { principal: 5000, rate: 15, rateType: "per_term", frequency: "bullet", installments: 1, termDays: 30 } }), offers);
    expect(c.kind).toBe("mobile");
    expect(c.current.totalCost).toBeCloseTo(750);
    expect(c.rows.find((r) => r.offer.lenderId === "tala")?.yours).toBe(true);
    expect(c.rows[0].quote.totalCost).toBeLessThan(750);
  });
});

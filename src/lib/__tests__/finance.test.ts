import { describe, expect, it } from "vitest";
import { apr, healthScore, installment, payoffPlan, schedule, totalCostOfCredit, type LoanTerms } from "../finance";

const bank: LoanTerms = { principal: 100_000, rate: 13, rateType: "reducing_annual", frequency: "monthly", installments: 12 };

describe("installment and APR", () => {
  it("matches the standard reducing-balance annuity", () => {
    expect(installment(bank)).toBeCloseTo(8931.73, 1);
    expect(apr(bank)).toBeCloseTo(13, 2);
  });

  it("counts upfront fees in APR", () => {
    expect(apr({ ...bank, upfrontFees: 3_000 })).toBeGreaterThan(18);
  });

  it("converts a flat monthly rate to a much higher APR", () => {
    const flat: LoanTerms = { principal: 100_000, rate: 1.5, rateType: "flat_monthly", frequency: "monthly", installments: 12 };
    expect(installment(flat)).toBeCloseTo(9833.33, 1);
    expect(apr(flat)).toBeGreaterThan(30);
    expect(apr(flat)).toBeLessThan(35);
  });

  it("annualises a 30-day per-term charge", () => {
    const digital: LoanTerms = { principal: 1_000, rate: 10, rateType: "per_term", frequency: "bullet", installments: 1, termDays: 30 };
    expect(totalCostOfCredit(digital)).toBeCloseTo(100, 6);
    expect(apr(digital)).toBeCloseTo(121.67, 1);
  });

  it("uses the borrower's known installment over the quoted rate", () => {
    expect(installment({ ...bank, installmentAmount: 9_500 })).toBe(9_500);
  });
});

describe("schedule", () => {
  it("pays the loan to zero", () => {
    const rows = schedule(bank);
    expect(rows).toHaveLength(12);
    expect(rows.at(-1)!.balance).toBe(0);
    const princ = rows.reduce((s, r) => s + r.principal, 0);
    expect(princ).toBeCloseTo(100_000, 0);
  });
});

describe("healthScore", () => {
  it("is healthy with low DTI and no arrears", () => {
    const h = healthScore({ monthlyIncome: 100_000, loans: [{ terms: bank, arrearsDays: 0, lenderType: "bank" }] });
    expect(h.band).toBe("Healthy");
    expect(h.signals).toHaveLength(0);
  });

  it("flags arrears and loan stacking", () => {
    const d: LoanTerms = { principal: 2_000, rate: 10, rateType: "per_term", frequency: "bullet", installments: 1, termDays: 30 };
    const loans = [0, 1, 2].map(() => ({ terms: d, arrearsDays: 45, lenderType: "digital" }));
    const h = healthScore({ monthlyIncome: 10_000, loans });
    expect(h.band === "At risk" || h.band === "Distressed").toBe(true);
    expect(h.signals.length).toBeGreaterThanOrEqual(3);
  });
});

describe("payoffPlan", () => {
  const loans = [
    { id: "a", name: "Bank", balance: 50_000, aprPct: 14, minPayment: 3_000 },
    { id: "b", name: "App", balance: 5_000, aprPct: 120, minPayment: 800 },
  ];
  it("avalanche pays the costliest loan first and saves interest", () => {
    const av = payoffPlan(loans, 2_000, "avalanche");
    const sn = payoffPlan(loans, 2_000, "snowball");
    expect(av.payoffOrder[0].id).toBe("b");
    expect(av.totalInterest).toBeLessThanOrEqual(sn.totalInterest);
    expect(av.capped).toBe(false);
  });
  it("reports a plan that never finishes", () => {
    const r = payoffPlan([{ id: "x", name: "X", balance: 100_000, aprPct: 120, minPayment: 100 }], 0, "avalanche", 120);
    expect(r.capped).toBe(true);
  });
});

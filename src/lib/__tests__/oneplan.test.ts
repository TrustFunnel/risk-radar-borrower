import { describe, expect, it } from "vitest";
import { buildPlan, canRefinance, checkListings, freedomDate, graduateEligible, perPayment, plainStatus, planRef, routes, safePayment } from "../oneplan";
import type { CrbReport, Loan } from "../types";

const loan = (id: string, lender: string, principal: number, extra: Partial<Loan> = {}): Loan => ({
  id, lender, lenderType: "digital", disbursedOn: "2026-10-01", firstDueDate: "2026-11-01", arrearsDays: 0, status: "current",
  terms: { principal, rate: 10, rateType: "flat_monthly", frequency: "monthly", installments: 3 },
  createdAt: "", updatedAt: "", ...extra,
});

describe("Safe Payment", () => {
  it("matches the strategy doc example: 28,000 - 22,000, less 20% = 4,800", () => {
    expect(safePayment(28000, 22000)).toBe(4800);
  });
  it("is zero, never negative, when essentials exceed income", () => {
    expect(safePayment(15000, 20000)).toBe(0);
  });
  it("converts a monthly amount to weekly and daily payments", () => {
    expect(perPayment(4800, "weekly")).toBe(1107); // about KES 1,100 a week, as in the doc
    expect(perPayment(4800, "monthly")).toBe(4800);
  });
});

describe("One Plan split", () => {
  const loans = [
    { loanId: "a", lender: "Tala", balance: 3000 },
    { loanId: "b", lender: "KCB", balance: 30000 },
    { loanId: "c", lender: "Chama", balance: 5000 },
  ];

  it("shares each payment in proportion to what each lender is owed, and clears everything", () => {
    const p = buildPlan(loans, 4800, "monthly", "fair");
    expect(p.feasible).toBe(true);
    expect(p.lines.reduce((s, l) => s + l.firstPayment, 0)).toBeCloseTo(4800, -1);
    const kcb = p.lines.find((l) => l.loanId === "b")!;
    const tala = p.lines.find((l) => l.loanId === "a")!;
    expect(kcb.firstPayment).toBeGreaterThan(tala.firstPayment);
    // 38,000 at 4,800 a month: 8 payments
    expect(p.totalPayments).toBe(8);
    expect(p.total).toBe(38000);
  });

  it("clears the smallest debt first when asked, but still pays every lender", () => {
    const p = buildPlan(loans, 4800, "monthly", "small_first");
    const tala = p.lines.find((l) => l.loanId === "a")!;
    expect(tala.clearsOn).toBe(1);
    expect(p.lines.every((l) => l.firstPayment > 0)).toBe(true);
    expect(p.totalPayments).toBe(8);
  });

  it("is not feasible with nothing to pay", () => {
    expect(buildPlan(loans, 0, "monthly").feasible).toBe(false);
  });

  it("dates the Freedom Date from the first payment", () => {
    const d = freedomDate(new Date(2026, 11, 1), "monthly", 8);
    expect(d.getMonth()).toBe(6); // July 2027
    expect(d.getFullYear()).toBe(2027);
  });
});

describe("status, refinance and routes", () => {
  it("says Behind when a loan is in arrears, Stretched when payments exceed the Safe Payment", () => {
    expect(plainStatus([loan("a", "Tala", 5000, { arrearsDays: 10 })], 4000).status).toBe("Behind");
    expect(plainStatus([loan("a", "KCB", 50000)], 1000).status).toBe("Stretched");
    expect(plainStatus([loan("a", "KCB", 5000)], 10000).status).toBe("On track");
  });

  it("does not offer cheaper lenders to people in arrears or listed", () => {
    expect(canRefinance([loan("a", "Tala", 5000, { arrearsDays: 10 })]).ok).toBe(false);
    const crb: CrbReport = { bureau: "Metropol", accounts: [{ lender: "Zenka", accountType: "mobile loan", balance: 900, arrearsDays: 120, status: "non_performing", negative: true }] };
    expect(canRefinance([loan("a", "KCB", 50000)], crb).ok).toBe(false);
    expect(canRefinance([loan("a", "KCB", 50000)]).ok).toBe(true);
  });

  it("recommends One Plan to a borrower who is behind, and Pause after a shock", () => {
    const l = loan("a", "Tala", 5000, { arrearsDays: 10 });
    const views = [{ id: "a", lender: "Tala", balance: 5000, aprPct: 200, monthly: 2000 }];
    const r = routes({ loans: [l], views, safe: 4000 });
    expect(r.find((x) => x.recommended)?.key).toBe("one_plan");
    const s = routes({ loans: [l], views, safe: 4000, shock: true });
    expect(s.filter((x) => x.recommended).map((x) => x.key)).toEqual(["pause"]);
  });
});

describe("Clean Slate", () => {
  it("flags listings under KES 1,000, paid but still listed, and no notice", () => {
    const crb: CrbReport = { bureau: "TransUnion", accounts: [
      { lender: "App A", accountType: "mobile loan", balance: 900, arrearsDays: 100, status: "non_performing", negative: true },
      { lender: "Bank B", accountType: "personal loan", balance: 0, arrearsDays: 0, status: "settled", negative: true },
      { lender: "Bank C", accountType: "personal loan", balance: 40000, arrearsDays: 95, status: "non_performing", negative: true },
      { lender: "Bank D", accountType: "personal loan", balance: 10000, arrearsDays: 0, status: "performing", negative: false },
    ] };
    const out = checkListings(crb, new Set(["Bank C|personal loan|"]));
    expect(out).toHaveLength(3);
    expect(out[0].problems[0]).toMatch(/less than KES 1,000/);
    expect(out[0].smallDebt).toBe(true);
    expect(out[1].problems[0]).toMatch(/paid or closed/);
    expect(out[2].problems[0]).toMatch(/30-day/);
  });
});

describe("references and Graduates", () => {
  it("makes AFUENI- references without look-alike characters", () => {
    expect(planRef(() => 0)).toBe("AFUENI-AAAAAA");
    expect(planRef()).toMatch(/^AFUENI-[A-HJ-NP-Z2-9]{6}$/);
  });
  it("needs a finished plan or 12 months on time", () => {
    expect(graduateEligible({ completed: false, monthsOnTime: 11 })).toBe(false);
    expect(graduateEligible({ completed: false, monthsOnTime: 12 })).toBe(true);
    expect(graduateEligible({ completed: true, monthsOnTime: 0 })).toBe(true);
  });
});

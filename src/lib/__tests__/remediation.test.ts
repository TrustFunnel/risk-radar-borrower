import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseKbaReport, personalRates } from "../../../scripts/kba-parse.mjs";
import type { LenderProduct } from "../market";
import { affordableBudget, affordablePlan, monthsToClear, parseStatementCsv, refinanceOffers, summariseIncome } from "../remediation";

describe("income from statements", () => {
  it("reads an M-Pesa style CSV and ignores loan repayments as spending", () => {
    const csv = [
      "Receipt No,Completion Time,Details,Transaction Status,Paid In,Withdrawn,Balance",
      "A1,2026-07-03 10:00:00,Salary from Acme,Completed,50000,,50000",
      "A2,2026-07-10 10:00:00,Pay Bill to KPLC,Completed,,2000,48000",
      "A3,2026-07-15 10:00:00,Loan repayment Tala,Completed,,5000,43000",
      "A4,2026-08-03 10:00:00,Salary from Acme,Completed,\"52,000\",,95000",
    ].join("\n");
    const flows = parseStatementCsv(csv);
    expect(flows).toEqual([
      { month: "2026-07", inflow: 50000, outflow: 2000 },
      { month: "2026-08", inflow: 52000, outflow: 0 },
    ]);
  });

  it("reads a bank CSV with one signed amount and DD/MM/YYYY dates", () => {
    const flows = parseStatementCsv("Date,Narration,Amount\n05/09/2026,Sales,30000\n06/09/2026,Stock,-12000\n02/10/2026,Sales,18000");
    expect(flows.map((f) => f.month)).toEqual(["2026-09", "2026-10"]);
    expect(flows[0]).toMatchObject({ inflow: 30000, outflow: 12000 });
  });

  it("sizes the plan on the weakest months, not the average", () => {
    const s = summariseIncome([10, 40, 40, 40, 40, 40].map((x, i) => ({ month: `2026-0${i + 1}`, inflow: x * 1000, outflow: 0 })));
    expect(s.conservativeIncome).toBe(25000);
    expect(s.averageIncome).toBe(35000);
    expect(affordableBudget(25000, 15000)).toBe(8000);
  });
});

describe("affordable plan", () => {
  it("keeps today's payments when they fit", () => {
    const p = affordablePlan([{ id: "a", name: "KCB", balance: 100000, aprPct: 15, currentMonthly: 5000 }], 8000);
    expect(p.fitsToday).toBe(true);
    expect(p.proposed[0].ask).toBe("keep");
  });

  it("stretches loans to fit the budget and flags ones that need a rate cut", () => {
    const p = affordablePlan([
      { id: "a", name: "Bank", balance: 100000, aprPct: 15, currentMonthly: 9000 },
      { id: "b", name: "App", balance: 10000, aprPct: 300, currentMonthly: 4000 },
    ], 6000);
    expect(p.fitsToday).toBe(false);
    const total = p.proposed.reduce((s, x) => s + x.proposedMonthly, 0);
    expect(total).toBeLessThanOrEqual(6000);
    expect(p.proposed.find((x) => x.id === "a")!.ask).toBe("extend");
  });

  it("knows when a payment never clears a loan", () => {
    expect(monthsToClear(10000, 0.1, 900)).toBeNull();
    expect(monthsToClear(12000, 0, 1000)).toBe(12);
  });
});

describe("refinance offers", () => {
  const p = (lender: string, rate: number): LenderProduct => ({ lenderId: lender, lender, lenderType: "bank", product: "Personal", rate, rateType: "reducing_annual", feesIncluded: false, sourceUrl: "x", checkedOn: "2026-10-21" });
  it("offers only cheaper lenders that still save money after fees", () => {
    const offers = refinanceOffers({ balance: 100000, aprPct: 30, monthsLeft: 24, currentMonthly: 5590 }, [p("Cheap", 14), p("Mid", 25), p("Dear", 35)]);
    expect(offers.map((o) => o.lender.lender)).toEqual(["Cheap", "Mid"]);
    expect(offers[0].saving).toBeGreaterThan(offers[1].saving);
  });
  it("prices offers at the middle of the bank's reported range", () => {
    const wide = { ...p("Wide", 9), rateMin: 3, rateMax: 25 };
    const [o] = refinanceOffers({ balance: 100000, aprPct: 30, monthsLeft: 24, currentMonthly: 5590 }, [wide]);
    expect(o.rate).toBe(14);
  });
  it("skips loans too small or short for a buyout", () => {
    expect(refinanceOffers({ balance: 8000, aprPct: 146, monthsLeft: 1, currentMonthly: 8960 }, [p("Cheap", 14)])).toEqual([]);
  });
});

describe("KBA report parser", () => {
  it("parses the saved report", () => {
    const md = readFileSync(new URL("../../../scripts/fixtures/kba-interest-rate-2026-10-21.md", import.meta.url), "utf8");
    const rows = personalRates(parseKbaReport(md));
    expect(rows.length).toBe(41);
    const kcb = rows.find((r: { bank: string }) => r.bank.startsWith("KCB"));
    expect(kcb).toMatchObject({ rate: 15.54, rateMin: 12.92, rateMax: 19.63, updatedOn: "2026-09-24" });
  });
});

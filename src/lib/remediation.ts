// The two remediation options on the Get help screen:
//   1. an affordable repayment plan worked out from the borrower's own income
//   2. refinancing (a buyout) by a cheaper lender from the Compare data

import { installment, type LoanTerms } from "./finance";
import { DEFAULT_FEE_PCT, type LenderProduct } from "./market";

// ---------- 1. Affordable plan ----------

export interface MonthFlow {
  month: string; // YYYY-MM
  inflow: number; // KES received (salary, sales, transfers in)
  outflow: number; // KES spent, excluding loan repayments where known
}

export interface IncomeSummary {
  months: number;
  averageIncome: number;
  conservativeIncome: number; // what the plan is built on
  lowestMonth: number;
  volatility: number; // coefficient of variation, 0 = steady
}

// Plans are sized on a "bad month", not an average one: the mean of the
// lowest third of months (at least one), so a slow month doesn't cause arrears.
export function summariseIncome(flows: MonthFlow[]): IncomeSummary {
  const xs = flows.map((f) => f.inflow).filter((x) => x > 0).sort((a, b) => a - b);
  if (!xs.length) return { months: 0, averageIncome: 0, conservativeIncome: 0, lowestMonth: 0, volatility: 0 };
  const mean = xs.reduce((s, x) => s + x, 0) / xs.length;
  const k = Math.max(1, Math.floor(xs.length / 3));
  const low = xs.slice(0, k).reduce((s, x) => s + x, 0) / k;
  const sd = Math.sqrt(xs.reduce((s, x) => s + (x - mean) ** 2, 0) / xs.length);
  return { months: xs.length, averageIncome: mean, conservativeIncome: low, lowestMonth: xs[0], volatility: mean ? sd / mean : 0 };
}

export interface PlanInputLoan {
  id: string;
  name: string;
  balance: number;
  aprPct: number;
  currentMonthly: number;
}

export interface ProposedLoanPlan {
  id: string;
  name: string;
  balance: number;
  currentMonthly: number;
  proposedMonthly: number;
  months: number | null; // null = can't clear at this payment without a rate cut
  ask: "keep" | "extend" | "rate_cut";
}

export interface AffordablePlan {
  budget: number; // KES per month the borrower can put towards loans
  currentTotal: number;
  proposed: ProposedLoanPlan[];
  fitsToday: boolean;
  maxMonths: number | null;
}

// Months to clear balance B with payment P at monthly rate r (annuity).
export function monthsToClear(balance: number, monthlyRate: number, payment: number): number | null {
  if (balance <= 0) return 0;
  if (monthlyRate === 0) return Math.ceil(balance / payment);
  if (payment <= balance * monthlyRate) return null;
  return Math.ceil(-Math.log(1 - (monthlyRate * balance) / payment) / Math.log(1 + monthlyRate));
}

// Keep a 20% buffer of what's left after essentials for emergencies.
export const SAFETY_BUFFER = 0.2;

export function affordableBudget(conservativeIncome: number, essentials: number): number {
  return Math.max(0, (conservativeIncome - essentials) * (1 - SAFETY_BUFFER));
}

// When today's repayments don't fit the budget, split the budget across loans
// in proportion to the payment each needs to clear within maxTermMonths at
// its own rate, then say what to ask each lender for.
export function affordablePlan(loans: PlanInputLoan[], budget: number, maxTermMonths = 60): AffordablePlan {
  const live = loans.filter((l) => l.balance > 0);
  const currentTotal = live.reduce((s, l) => s + l.currentMonthly, 0);
  if (currentTotal <= budget) {
    return {
      budget, currentTotal, fitsToday: true,
      proposed: live.map((l) => ({ ...l, proposedMonthly: l.currentMonthly, months: monthsToClear(l.balance, l.aprPct / 1200, l.currentMonthly), ask: "keep" })),
      maxMonths: null,
    };
  }
  // Minimum payment that clears each loan within maxTermMonths at its rate.
  const floor = live.map((l) => {
    const r = l.aprPct / 1200;
    return r === 0 ? l.balance / maxTermMonths : (l.balance * r) / (1 - Math.pow(1 + r, -maxTermMonths));
  });
  const floorTotal = floor.reduce((s, x) => s + x, 0);
  const proposed = live.map((l, i) => {
    // Never propose more than they pay today.
    const share = floorTotal > 0 ? floor[i] / floorTotal : 1 / live.length;
    const pay = Math.min(l.currentMonthly, budget * share);
    const months = monthsToClear(l.balance, l.aprPct / 1200, pay);
    const ask: ProposedLoanPlan["ask"] = months == null || months > maxTermMonths ? "rate_cut" : pay < l.currentMonthly - 1 ? "extend" : "keep";
    return { id: l.id, name: l.name, balance: l.balance, currentMonthly: l.currentMonthly, proposedMonthly: Math.round(pay), months, ask };
  });
  const ms = proposed.map((p) => p.months).filter((m): m is number => m != null);
  return { budget, currentTotal, fitsToday: false, proposed, maxMonths: ms.length ? Math.max(...ms) : null };
}

// Read a bank or M-Pesa statement exported as CSV into monthly flows.
// Accepts a date column plus either one signed amount column or separate
// paid-in / withdrawn columns (the M-Pesa layout). Loan repayments are
// excluded from outflow when the description says so.
export function parseStatementCsv(text: string): MonthFlow[] {
  const rows = text.split(/\r?\n/).map(splitCsv).filter((r) => r.some((c) => c.trim()));
  if (rows.length < 2) return [];
  const head = rows[0].map((h) => h.toLowerCase());
  const col = (...names: string[]) => head.findIndex((h) => names.some((n) => h.includes(n)));
  const iDate = col("date", "completion time");
  const iIn = col("paid in", "credit", "money in", "deposit");
  const iOut = col("withdrawn", "debit", "money out", "withdrawal");
  const iAmt = col("amount");
  const iDesc = col("details", "description", "narration", "particulars");
  if (iDate < 0 || (iIn < 0 && iAmt < 0)) return [];

  const byMonth = new Map<string, MonthFlow>();
  for (const r of rows.slice(1)) {
    const month = toMonth(r.at(iDate) ?? "");
    if (!month) continue;
    const num = (i: number) => (i < 0 ? 0 : Number(String(r.at(i) ?? "").replace(/[^\d.-]/g, "")) || 0);
    let inflow = 0, outflow = 0;
    if (iIn >= 0) { inflow = Math.abs(num(iIn)); outflow = Math.abs(num(iOut)); }
    else { const a = num(iAmt); if (a >= 0) inflow = a; else outflow = -a; }
    addToMonth(byMonth, month, inflow, outflow, iDesc >= 0 ? r.at(iDesc) ?? "" : "");
  }
  return sortedFlows(byMonth);
}

// Adds one transaction to its month. Loan repayments are not spending, and
// money borrowed or moved between the borrower's own accounts is not income.
export function addToMonth(byMonth: Map<string, MonthFlow>, month: string, inflow: number, outflow: number, details: string) {
  const desc = details.toLowerCase();
  if (/loan|fuliza|m-shwari|repay|overdraft/.test(desc)) outflow = 0;
  if (/reversal|own account|m-shwari withdraw|overdraft of credit|loan disburs|m-shwari loan|m-?pesa loan/.test(desc)) inflow = 0;
  const m = byMonth.get(month) ?? { month, inflow: 0, outflow: 0 };
  m.inflow += inflow; m.outflow += outflow;
  byMonth.set(month, m);
}

export const sortedFlows = (byMonth: Map<string, MonthFlow>) => [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month));

function splitCsv(line: string): string[] {
  const out: string[] = [];
  let cur = "", q = false;
  for (const ch of line) {
    if (ch === '"') q = !q;
    else if (ch === "," && !q) { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

function toMonth(s: string): string | null {
  const t = s.trim();
  let m = t.match(/^(\d{4})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}`;
  m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/); // DD/MM/YYYY, the Kenyan default
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}`;
  return null;
}

// ---------- 2. Refinance (buyout) offers ----------

export interface RefinanceOffer {
  lender: LenderProduct;
  rate: number; // the rate the offer is priced at
  newMonthly: number;
  newTotal: number; // repayments + fees
  oldTotal: number; // what's left to pay on the current loan
  saving: number;
}

// Banks don't buy out small or nearly finished loans.
export const MIN_REFINANCE_BALANCE = 20_000;
export const MIN_REFINANCE_MONTHS = 3;

// KBA averages mix secured and unsecured products, so a low average can come
// from a secured loan the borrower won't get. Quote the middle of the bank's
// reported range instead, never below its average.
export const typicalQuote = (p: LenderProduct) =>
  p.rateMin != null && p.rateMax != null ? Math.max(p.rate, (p.rateMin + p.rateMax) / 2) : p.rate;

// For one loan: which reporting lenders would pay it off and charge less over
// the same remaining term, after their upfront fees. Best saving first.
export function refinanceOffers(
  loan: { balance: number; aprPct: number; monthsLeft: number; currentMonthly: number },
  products: LenderProduct[],
  feePct = DEFAULT_FEE_PCT,
  limit = 3,
): RefinanceOffer[] {
  if (loan.balance < MIN_REFINANCE_BALANCE || loan.monthsLeft < MIN_REFINANCE_MONTHS) return [];
  const n = loan.monthsLeft;
  const oldTotal = loan.currentMonthly * n;
  return products
    .filter((p) => typicalQuote(p) < loan.aprPct)
    .map((p) => {
      const terms: LoanTerms = { principal: loan.balance, rate: typicalQuote(p), rateType: p.rateType, frequency: "monthly", installments: n };
      const newMonthly = installment(terms);
      const fees = p.feesIncluded ? 0 : (loan.balance * feePct) / 100;
      const newTotal = newMonthly * n + fees;
      return { lender: p, rate: terms.rate, newMonthly, newTotal, oldTotal, saving: oldTotal - newTotal };
    })
    .filter((o) => o.saving > 0)
    .sort((a, b) => b.saving - a.saving)
    .slice(0, limit);
}

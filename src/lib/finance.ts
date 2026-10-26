// Loan maths for the borrower app. Pure functions, no I/O, so they can run
// in the browser, on the server and in tests.

export type Frequency = "monthly" | "weekly" | "bullet";

// How the lender quotes interest. Kenyan banks mostly quote an annual rate on
// a reducing balance; MFIs and digital lenders often quote a flat monthly rate
// or a one-off charge for the whole term (e.g. "7.5% for 30 days").
export type RateType = "reducing_annual" | "flat_annual" | "flat_monthly" | "per_term";

export interface LoanTerms {
  principal: number; // KES disbursed on paper
  rate: number; // percent, meaning depends on rateType
  rateType: RateType;
  frequency: Frequency;
  installments: number; // number of payments; 1 for bullet
  termDays?: number; // bullet loans only
  upfrontFees?: number; // KES deducted or paid at disbursement (incl. excise duty)
  installmentAmount?: number; // if the borrower knows it, it overrides the rate maths
}

export interface ScheduleRow {
  n: number;
  payment: number;
  interest: number;
  principal: number;
  balance: number;
}

export const periodsPerYear = (f: Frequency, termDays = 30): number =>
  f === "monthly" ? 12 : f === "weekly" ? 52 : 365 / Math.max(termDays, 1);

const round2 = (x: number) => Math.round(x * 100) / 100;

// Payment per installment implied by the quoted rate.
export function installmentFromRate(t: LoanTerms): number {
  const n = Math.max(t.installments, 1);
  const ppy = periodsPerYear(t.frequency, t.termDays);
  const r = t.rate / 100;
  switch (t.rateType) {
    case "reducing_annual": {
      const i = r / ppy;
      if (i === 0) return t.principal / n;
      return (t.principal * i) / (1 - Math.pow(1 + i, -n));
    }
    case "flat_annual": {
      const years = n / ppy;
      return (t.principal * (1 + r * years)) / n;
    }
    case "flat_monthly": {
      const months = (n / ppy) * 12;
      return (t.principal * (1 + r * months)) / n;
    }
    case "per_term":
      return (t.principal * (1 + r)) / n;
  }
}

export const installment = (t: LoanTerms): number =>
  t.installmentAmount && t.installmentAmount > 0 ? t.installmentAmount : installmentFromRate(t);

export function totalRepayable(t: LoanTerms): number {
  return installment(t) * Math.max(t.installments, 1);
}

// Everything the borrower pays above what they received.
export function totalCostOfCredit(t: LoanTerms): number {
  return totalRepayable(t) - t.principal + (t.upfrontFees ?? 0);
}

// Periodic internal rate of return of: +net disbursed at t0, -payment each period.
function periodicIrr(netDisbursed: number, payment: number, n: number): number {
  if (netDisbursed <= 0 || payment * n <= netDisbursed) return 0;
  const pv = (i: number) => payment * (1 - Math.pow(1 + i, -n)) / i;
  let lo = 1e-9;
  let hi = 10; // 1000% per period is far beyond any real loan
  for (let k = 0; k < 200; k++) {
    const mid = (lo + hi) / 2;
    if (pv(mid) > netDisbursed) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

// Annual percentage rate (nominal, periodic rate x periods per year), counting
// fees. This is the figure CBK asks lenders to disclose, and the one we rank by.
export function apr(t: LoanTerms): number {
  const n = Math.max(t.installments, 1);
  const net = t.principal - (t.upfrontFees ?? 0);
  const i = periodicIrr(net, installment(t), n);
  return i * periodsPerYear(t.frequency, t.termDays) * 100;
}

// Effective annual rate: what the APR compounds to over a year.
export function effectiveAnnualRate(t: LoanTerms): number {
  const n = Math.max(t.installments, 1);
  const net = t.principal - (t.upfrontFees ?? 0);
  const i = periodicIrr(net, installment(t), n);
  return (Math.pow(1 + i, periodsPerYear(t.frequency, t.termDays)) - 1) * 100;
}

// Amortisation at the loan's true periodic rate, so interest and principal
// split the way the lender's statement should.
export function schedule(t: LoanTerms): ScheduleRow[] {
  const n = Math.max(t.installments, 1);
  const pay = installment(t);
  const i = periodicIrr(t.principal, pay, n);
  const rows: ScheduleRow[] = [];
  let bal = t.principal;
  for (let k = 1; k <= n; k++) {
    const interest = bal * i;
    const princ = k === n ? bal : pay - interest;
    bal = Math.max(bal - princ, 0);
    rows.push({ n: k, payment: round2(k === n ? princ + interest : pay), interest: round2(interest), principal: round2(princ), balance: round2(bal) });
  }
  return rows;
}

// Monthly cost of a loan's installment, so weekly and bullet loans add up.
export function monthlyObligation(t: LoanTerms): number {
  const pay = installment(t);
  if (t.frequency === "monthly") return pay;
  if (t.frequency === "weekly") return (pay * 52) / 12;
  // A bullet loan is due in one go; spread it over its term for budgeting.
  return (pay * 30) / Math.max(t.termDays ?? 30, 1);
}

export interface HealthInput {
  monthlyIncome: number;
  loans: { terms: LoanTerms; arrearsDays: number; lenderType: string; closed?: boolean }[];
}

export type HealthBand = "Healthy" | "Watch" | "At risk" | "Distressed";

export interface HealthResult {
  score: number; // 0-100, higher is safer
  band: HealthBand;
  debtToIncome: number; // percent
  signals: string[];
}

// Rules-based early-warning score. Deliberately simple and explainable: each
// signal the borrower sees is the reason points were taken off.
export function healthScore(h: HealthInput): HealthResult {
  const active = h.loans.filter((l) => !l.closed);
  const obligations = active.reduce((s, l) => s + monthlyObligation(l.terms), 0);
  const dti = h.monthlyIncome > 0 ? (obligations / h.monthlyIncome) * 100 : active.length ? 100 : 0;
  const maxArrears = active.reduce((m, l) => Math.max(m, l.arrearsDays), 0);
  const digital = active.filter((l) => l.lenderType === "digital").length;
  const costly = active.filter((l) => apr(l.terms) > 100).length;

  let score = 100;
  const signals: string[] = [];

  if (dti > 50) { score -= 35; signals.push(`Loan repayments take ${dti.toFixed(0)}% of your income (above 50%).`); }
  else if (dti > 35) { score -= 20; signals.push(`Loan repayments take ${dti.toFixed(0)}% of your income (above 35%).`); }

  if (maxArrears > 90) { score -= 40; signals.push(`A loan is ${maxArrears} days overdue. It is likely listed as non-performing with the CRB.`); }
  else if (maxArrears > 30) { score -= 25; signals.push(`A loan is ${maxArrears} days overdue.`); }
  else if (maxArrears > 0) { score -= 10; signals.push(`A loan is ${maxArrears} days overdue.`); }

  if (digital >= 3) { score -= 15; signals.push(`You have ${digital} digital loans open at once. Borrowing from one app to pay another is a common debt trap.`); }
  if (costly > 0) { score -= 10; signals.push(`${costly} of your loans cost over 100% a year. Refinancing them first saves the most.`); }
  if (h.monthlyIncome <= 0 && active.length) signals.push("Add your monthly income to get an accurate score.");

  score = Math.max(0, Math.min(100, score));
  const band: HealthBand = score >= 75 ? "Healthy" : score >= 55 ? "Watch" : score >= 35 ? "At risk" : "Distressed";
  return { score, band, debtToIncome: dti, signals };
}

export type Strategy = "avalanche" | "snowball";

export interface PlanLoan {
  id: string;
  name: string;
  balance: number;
  aprPct: number;
  minPayment: number; // per month
}

export interface PlanResult {
  months: number;
  totalInterest: number;
  payoffOrder: { id: string; name: string; month: number }[];
  capped: boolean; // true if the plan never finishes (payments below interest)
  firstMonth: { id: string; name: string; pay: number }[]; // what to pay each loan now
  uncleared: string[]; // loans still owing when the plan stops (capped plans)
}

// Month-by-month payoff simulation. Every loan gets its minimum; the extra
// goes to the target loan (highest APR for avalanche, smallest balance for
// snowball), and a cleared loan's minimum rolls into the next target.
export function payoffPlan(loans: PlanLoan[], extraPerMonth: number, strategy: Strategy, maxMonths = 600): PlanResult {
  const ls = loans.filter((l) => l.balance > 0).map((l) => ({ ...l }));
  const budget = ls.reduce((s, l) => s + l.minPayment, 0) + Math.max(extraPerMonth, 0);
  let totalInterest = 0;
  const payoffOrder: PlanResult["payoffOrder"] = [];
  let month = 0;
  const firstMonth = new Map<string, number>();
  const paid = (id: string, x: number) => { if (month === 1) firstMonth.set(id, (firstMonth.get(id) ?? 0) + x); };

  while (ls.some((l) => l.balance > 0.005) && month < maxMonths) {
    month++;
    for (const l of ls) {
      if (l.balance <= 0) continue;
      const interest = l.balance * (l.aprPct / 100 / 12);
      l.balance += interest;
      totalInterest += interest;
    }
    let left = budget;
    for (const l of ls) {
      if (l.balance <= 0) continue;
      const pay = Math.min(l.minPayment, l.balance, left);
      l.balance -= pay;
      left -= pay;
      paid(l.id, pay);
    }
    const order = ls
      .filter((l) => l.balance > 0)
      .sort((a, b) => (strategy === "avalanche" ? b.aprPct - a.aprPct : a.balance - b.balance));
    for (const l of order) {
      if (left <= 0) break;
      const pay = Math.min(l.balance, left);
      l.balance -= pay;
      left -= pay;
      paid(l.id, pay);
    }
    for (const l of ls) {
      if (l.balance <= 0.005 && !payoffOrder.some((p) => p.id === l.id)) {
        l.balance = 0;
        payoffOrder.push({ id: l.id, name: l.name, month });
      }
    }
  }
  return {
    months: month,
    totalInterest: round2(totalInterest),
    payoffOrder,
    capped: ls.some((l) => l.balance > 0.005),
    firstMonth: ls.filter((l) => firstMonth.has(l.id)).map((l) => ({ id: l.id, name: l.name, pay: round2(firstMonth.get(l.id)!) })),
    uncleared: ls.filter((l) => l.balance > 0.005).map((l) => l.name),
  };
}

export const kes = (x: number) =>
  "KES " + Math.round(x).toLocaleString("en-KE");

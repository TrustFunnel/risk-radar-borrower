// What a borrower should know before taking a lender's product: requirements,
// turnaround and costs beyond the interest rate. Collected with Firecrawl from
// each lender's own product page (sourceUrl), checked on the date given.
// Lenders that don't report to the Kenya Bankers Association (mobile lenders,
// SACCOs) also carry their pricing here, so they can be ranked.

import type { Frequency, RateType } from "../lib/finance";
import type { ProductKind } from "../lib/market";
import type { LenderType } from "../lib/types";

export type Pricing =
  // A rate the loan maths in finance.ts understands. For mobile loans the rate
  // is for one 30-day term. excisePct is excise duty as a % of the charge.
  | { model: "rate"; rate: number; rateMin?: number; rateMax?: number; rateType: RateType; frequency: Frequency; termDays?: number; upfrontPct?: number; excisePct?: number }
  // Fuliza: a one-off access fee, then a fixed daily fee by outstanding band.
  | { model: "daily_bands"; accessPct: number; bands: [upTo: number, fee: number][]; excisePct: number };

export interface Cost { name: string; value: string }

export interface LenderDetail {
  lenderId: string; // the KBA slug for banks, so details attach to their rates
  lender: string;
  lenderType: LenderType;
  kind: ProductKind;
  product: string;
  pricing?: Pricing; // only for lenders missing from the KBA report
  minAmount?: number;
  maxAmount?: number;
  amount?: string;
  term?: string;
  requirements: string[];
  turnaround?: string;
  costs: Cost[];
  security?: string;
  notes?: string[];
  sourceUrl: string;
  checkedOn: string;
}

const CHECKED = "2026-10-26";

export const LENDER_DETAILS: LenderDetail[] = [
  // ---------- Banks: personal loans ----------
  {
    lenderId: "kcb", lender: "KCB Bank Kenya Limited", lenderType: "bank", kind: "personal",
    product: "Personal Unsecured Non-check Off Loan",
    minAmount: 20_000, maxAmount: 4_000_000, amount: "KES 20,000 to 4 million", term: "Up to 48 months",
    requirements: ["Kenyan national ID or passport", "KRA PIN", "Filled application form", "Employer introduction letter", "Latest 3 months' payslips", "An active KCB account for at least 3 months"],
    costs: [],
    security: "None (no security deposit)",
    notes: ["Open to salaried and self-employed people"],
    sourceUrl: "https://ke.kcbgroup.com/products/personal-unsecured-non-check-off-loan", checkedOn: CHECKED,
  },
  {
    lenderId: "co-operative", lender: "Co-operative Bank of Kenya Limited", lenderType: "bank", kind: "personal",
    product: "Unsecured Personal Loan",
    minAmount: 50_000, maxAmount: 10_000_000, amount: "KES 50,000 to 10 million, depending on your employer's scheme", term: "Up to 132 months",
    requirements: ["Original national ID and a copy", "Copy of KRA PIN", "Payslips for the last 3 months", "Filled loan application form", "Employed or with a regular income (no minimum net salary)"],
    turnaround: "Applications are appraised within 48 hours",
    costs: [{ name: "Credit life insurance", value: "Covers death and permanent disability, not retrenchment" }],
    security: "None",
    notes: ["Can buy off loans from other banks and SACCOs so you have one repayment", "Available in KES and USD"],
    sourceUrl: "https://www.co-opbank.co.ke/borrow/personal-loan/", checkedOn: CHECKED,
  },
  {
    lenderId: "equity", lender: "Equity Bank Kenya Limited", lenderType: "bank", kind: "personal",
    product: "Equiloan (check-off loan)",
    maxAmount: 10_000_000, amount: "Up to KES 10 million, based on your ability to pay", term: "Up to 144 months",
    requirements: ["Payslip", "Identification documents", "Employment letter", "Your employer must have a check-off agreement with Equity"],
    turnaround: "An offer letter is issued on approval; money is paid out once you accept and meet its conditions",
    costs: [],
    security: "Repaid by check-off from your salary",
    sourceUrl: "https://equitygroupholdings.com/ke/borrow/personal/equiloancheck-off-loan/", checkedOn: CHECKED,
  },
  {
    lenderId: "absa", lender: "Absa Bank Kenya Plc", lenderType: "bank", kind: "personal",
    product: "Personal loan",
    minAmount: 20_000, maxAmount: 6_000_000, amount: "KES 20,000 to 6 million; your income sets your limit", term: "Up to 96 months",
    requirements: ["Copy of national ID (new customers)", "3 months' bank statements (new customers)", "Most recent payslip", "Your signature on a white background", "Loan statement, if you are buying out a loan elsewhere", "Credit life insurance form and declaration", "Employer verification checklist", "Permanent or contract employment"],
    costs: [{ name: "Credit life insurance", value: "Required; forms are part of the application" }],
    security: "No collateral",
    notes: ["Repayments are taken from your Absa account by debit order", "Buys out loans from other lenders"],
    sourceUrl: "https://www.absabank.co.ke/personal/get-a-personal-loan/", checkedOn: CHECKED,
  },

  // ---------- SACCOs (not in the KBA report) ----------
  {
    lenderId: "stima", lender: "Stima Sacco", lenderType: "sacco", kind: "personal",
    product: "Normal loan",
    pricing: { model: "rate", rate: 12, rateType: "reducing_annual", frequency: "monthly" },
    amount: "Up to 4 times your deposits", term: "Up to 60 months",
    requirements: ["Member of the Sacco for at least 3 months", "Minimum share capital held when you apply", "Guarantors, savings or collateral (title deed, logbook)"],
    costs: [{ name: "Interest", value: "12% a year on a reducing balance" }],
    security: "Guarantors, deposits or collateral",
    notes: ["Membership is needed first, so this is not an instant switch"],
    sourceUrl: "https://www.stima-sacco.com/credit-products/", checkedOn: CHECKED,
  },
  {
    lenderId: "mwalimu", lender: "Mwalimu National Sacco", lenderType: "sacco", kind: "personal",
    product: "Development loan",
    pricing: { model: "rate", rate: 14.5, rateType: "reducing_annual", frequency: "monthly", upfrontPct: 0.5 },
    amount: "Up to 4 times your deposits, within the one-third salary rule", term: "Up to 60 months",
    requirements: ["Sacco membership with enough deposits", "Your net pay after this loan must stay above one third of your salary"],
    costs: [{ name: "Interest", value: "14.5% a year on a reducing balance" }, { name: "Processing fee", value: "0.5% of the loan" }],
    notes: ["One development loan at a time", "Mainly for teachers"],
    sourceUrl: "https://mwalimunational.coop/development-loan/", checkedOn: CHECKED,
  },

  // ---------- Mobile loans ----------
  {
    lenderId: "mshwari", lender: "M-Shwari (NCBA and Safaricom)", lenderType: "digital", kind: "mobile",
    product: "M-Shwari loan",
    pricing: { model: "rate", rate: 7.5, rateType: "per_term", frequency: "bullet", termDays: 30, excisePct: 20 },
    minAmount: 100, maxAmount: 1_000_000, amount: "From KES 100; most limits are up to KES 50,000", term: "1 month",
    requirements: ["M-PESA customer for at least 6 months", "Save on M-Shwari", "Use other Safaricom services (calls, data, M-PESA)"],
    turnaround: "Instant, straight to M-PESA",
    costs: [{ name: "Loan fee", value: "7.5% of the loan" }, { name: "Excise duty", value: "1.5% of the loan, taken from the amount you receive" }],
    notes: ["Repay through M-PESA or from your M-Shwari savings"],
    sourceUrl: "https://www.safaricom.co.ke/main-m-pesa/m-pesa-services/credit-and-savings/m-shwari-mobile", checkedOn: CHECKED,
  },
  {
    lenderId: "kcb-mpesa", lender: "KCB M-PESA", lenderType: "digital", kind: "mobile",
    product: "KCB M-PESA loan",
    pricing: { model: "rate", rate: 8.8, rateType: "per_term", frequency: "bullet", termDays: 30 },
    minAmount: 1_000, amount: "From KES 1,000", term: "1 month",
    requirements: ["An M-PESA line with a KCB M-PESA account"],
    turnaround: "Instant",
    costs: [{ name: "Loan rate", value: "8.80% for the month" }],
    notes: ["You can take several loans within your limit"],
    sourceUrl: "https://ke.kcbgroup.com/products/kcb-mpesa-loan", checkedOn: CHECKED,
  },
  {
    lenderId: "fuliza", lender: "Fuliza M-PESA", lenderType: "digital", kind: "mobile",
    product: "Fuliza overdraft",
    pricing: { model: "daily_bands", accessPct: 1, excisePct: 20, bands: [[100, 0], [500, 2.5], [1000, 5], [1500, 18], [2500, 20], [70000, 25]] },
    maxAmount: 70_000, amount: "Up to your Fuliza limit", term: "Until repaid; fees run daily",
    requirements: ["Registered M-PESA line (Kenyan ID, passport or military ID)", "On the Safaricom network for at least 6 months", "Opt in to Fuliza"],
    turnaround: "Instant, when M-PESA balance runs short",
    costs: [{ name: "Access fee", value: "1% of each amount you Fuliza" }, { name: "Daily maintenance fee", value: "KES 0 to 25 a day depending on what you owe" }, { name: "Excise duty", value: "20% of the daily fee" }],
    notes: ["Daily fees add up: KES 3,000 left for 30 days costs about KES 930"],
    sourceUrl: "https://www.safaricom.co.ke/main-m-pesa/m-pesa-services/credit-and-savings/fuliza-mobile", checkedOn: CHECKED,
  },
  {
    lenderId: "tala", lender: "Tala", lenderType: "digital", kind: "mobile",
    product: "Tala loan",
    pricing: { model: "rate", rate: 13.5, rateMin: 9, rateMax: 18, rateType: "per_term", frequency: "bullet", termDays: 30, excisePct: 20 },
    minAmount: 1_000, maxAmount: 50_000, amount: "KES 1,000 to 50,000; first loans KES 1,000 to 2,000", term: "Short term, interest charged daily",
    requirements: ["The Tala app", "Repay earlier loans on time to unlock bigger limits"],
    costs: [{ name: "Interest", value: "0.3% to 0.6% a day (9% to 18% for 30 days)" }, { name: "Excise duty", value: "20% of the interest" }, { name: "Processing fee", value: "None" }],
    notes: ["Tala states a maximum APR of 109.5% to 219%"],
    sourceUrl: "https://tala.co.ke/loan-app-help/loan-amounts-and-fees/", checkedOn: CHECKED,
  },
  {
    lenderId: "branch-microfinance", lender: "Branch", lenderType: "digital", kind: "mobile",
    product: "Branch app loan",
    pricing: { model: "rate", rate: 9.65, rateMin: 1.7, rateMax: 17.6, rateType: "per_term", frequency: "bullet", termDays: 30 },
    requirements: ["The Branch app", "Your repayment history with Branch sets your rate"],
    turnaround: "Most loans are processed within 24 hours",
    costs: [{ name: "Interest", value: "1.7% to 17.6% a month (22% to 229% APR)" }, { name: "Late or rollover fee", value: "6%" }],
    sourceUrl: "https://branch.co/faq/ke", checkedOn: CHECKED,
  },
  {
    lenderId: "hustler", lender: "Hustler Fund", lenderType: "digital", kind: "mobile",
    product: "Personal loan",
    pricing: { model: "rate", rate: 8, rateType: "flat_annual", frequency: "bullet", termDays: 30 },
    minAmount: 100, maxAmount: 50_000, amount: "KES 100 to 50,000", term: "14 days",
    requirements: ["Kenyan citizen aged 18 or over", "Valid national ID", "Registered on M-PESA, Airtel Money or T-Kash", "SIM card active for at least 90 days"],
    turnaround: "Instant approval",
    costs: [{ name: "Interest", value: "8% a year, charged daily" }, { name: "Late rate", value: "9.5% a year after 14 days" }, { name: "Savings deduction", value: "5% of each loan goes to your Hustler savings" }],
    security: "None",
    sourceUrl: "https://www.hustlerfund.go.ke/personal-loan", checkedOn: CHECKED,
  },
  {
    lenderId: "equity", lender: "Equity Bank Kenya Limited", lenderType: "bank", kind: "mobile",
    product: "Eazzy Loan",
    minAmount: 100, maxAmount: 3_000_000, amount: "KES 100 to 3 million", term: "1 month or up to 24 monthly installments",
    requirements: ["An Equity account active for the last 6 months", "An Equitel line or the Equity app", "Your income paid into the account"],
    turnaround: "Instant, into your account",
    costs: [],
    notes: ["No guarantors or forms"],
    sourceUrl: "https://equitygroupholdings.com/ke/borrow/personal/eazzy-loan/", checkedOn: CHECKED,
  },
];

// What most Kenyan lenders of each kind ask for, shown when we haven't
// collected a lender's own page yet. Drawn from the bank pages above.
export const TYPICAL: Record<ProductKind, { requirements: string[]; turnaround: string; costs: Cost[] }> = {
  personal: {
    requirements: ["National ID", "KRA PIN", "Latest 3 months' payslips", "3 to 6 months' bank statements", "Employer letter, unless your employer has a check-off scheme", "Filled application form"],
    turnaround: "Often 2 to 3 working days once your documents are complete",
    costs: [{ name: "Processing fee", value: "Usually 1% to 3% of the loan" }, { name: "Credit life insurance", value: "Usually required, paid upfront or monthly" }, { name: "Excise duty", value: "20% of the fees" }],
  },
  mobile: {
    requirements: ["Registered mobile money line", "National ID", "The lender's app or USSD menu"],
    turnaround: "Usually instant",
    costs: [{ name: "Facility fee or interest", value: "Charged for the term, often per 30 days" }, { name: "Excise duty", value: "20% of the fee" }, { name: "Late or rollover fee", value: "Common if you miss the due date" }],
  },
  asset: {
    requirements: ["National ID and KRA PIN", "Proof of income (payslips or bank statements)", "Pro-forma invoice or sale agreement for the car or equipment", "Valuation report", "Comprehensive insurance, with the lender noted on the policy"],
    turnaround: "Usually a few days after valuation",
    costs: [{ name: "Deposit", value: "Usually part of the price, paid by you" }, { name: "Processing fee", value: "Usually 1% to 3%" }, { name: "Valuation, tracking and insurance", value: "Paid by you" }, { name: "Excise duty", value: "20% of the fees" }],
  },
  mortgage: {
    requirements: ["National ID and KRA PIN", "Proof of income", "Sale agreement and title documents", "Valuation of the property"],
    turnaround: "Usually several weeks (valuation, legal and title checks)",
    costs: [{ name: "Deposit", value: "Usually 10% or more of the price" }, { name: "Legal and valuation fees", value: "Paid by you" }, { name: "Stamp duty", value: "On the property transfer" }, { name: "Insurance", value: "Mortgage protection and buildings cover" }],
  },
  business: {
    requirements: ["Business registration documents", "KRA PIN", "6 to 12 months' business bank statements", "Security, such as a title deed, logbook or guarantees"],
    turnaround: "Usually 1 to 2 weeks",
    costs: [{ name: "Processing fee", value: "Usually 1% to 3%" }, { name: "Security registration and valuation", value: "Paid by you" }, { name: "Excise duty", value: "20% of the fees" }],
  },
};

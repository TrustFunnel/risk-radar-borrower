// Like-for-like comparison: a borrower's loan against what other lenders charge
// for the same kind of product, on the same amount and remaining term.

import { LENDER_DETAILS, TYPICAL, type LenderDetail, type Pricing } from "../data/lenderDetails";
import { lenderKey } from "./crb";
import { installment, totalCostOfCredit, type LoanTerms } from "./finance";
import { balance, monthsLeft } from "./loanView";
import { DEFAULT_FEE_PCT, kindOf, type LenderProduct, type ProductKind } from "./market";
import { typicalQuote } from "./remediation";
import type { Loan } from "./types";

// Mobile loans are compared on one 30-day term, the way they are sold.
export const MOBILE_DAYS = 30;

// A few banks report only their premium over the Central Bank Rate for some
// products, which shows up as a rate below the CBR itself. Leave those out.
export const MIN_REPORTED_RATE = 8.75;

export interface Offer {
  id: string;
  lenderId: string;
  lender: string;
  lenderType: LenderProduct["lenderType"];
  kind: ProductKind;
  product: string;
  rate: number; // headline rate: % a year for KBA rows, as the lender quotes it otherwise
  rateMin?: number;
  rateMax?: number;
  rateNote: string; // what the headline rate means, e.g. "a year, reducing balance"
  quotedRate?: number; // the rate we price at, when it differs from the headline
  pricing: Pricing;
  feesKnown: boolean; // false: we add the assumed fee % on top
  sourceUrl: string;
  rateUpdatedOn?: string;
  checkedOn: string;
  detail?: LenderDetail;
}

const detailFor = (lenderId: string, kind: ProductKind) => LENDER_DETAILS.find((d) => d.lenderId === lenderId && d.kind === kind);

function fromKba(p: LenderProduct): Offer {
  const kind = kindOf(p);
  // Quote the middle of a wide range: a low average can include secured loans.
  const rate = typicalQuote(p);
  return {
    id: `${p.lenderId}:${kind}`,
    lenderId: p.lenderId, lender: p.lender, lenderType: p.lenderType, kind, product: p.product,
    rate: p.rate, rateMin: p.rateMin, rateMax: p.rateMax,
    rateNote: kind === "mobile" ? "a year, as reported to KBA" : "a year, reducing balance",
    quotedRate: rate !== p.rate ? rate : undefined,
    pricing: { model: "rate", rate, rateType: p.rateType, frequency: kind === "mobile" ? "bullet" : "monthly", termDays: kind === "mobile" ? MOBILE_DAYS : undefined },
    feesKnown: p.feesIncluded,
    sourceUrl: p.sourceUrl, rateUpdatedOn: p.rateUpdatedOn, checkedOn: p.checkedOn,
    detail: detailFor(p.lenderId, kind),
  };
}

function fromDetail(d: LenderDetail): Offer {
  const pr = d.pricing!;
  const rate = pr.model === "rate" ? pr.rate : pr.accessPct;
  const rateNote = pr.model === "daily_bands" ? "access fee, plus a daily fee"
    : pr.rateType === "per_term" ? "for 30 days"
    : pr.rateType === "reducing_annual" ? "a year, reducing balance" : "a year";
  return {
    id: `${d.lenderId}:${d.kind}`,
    lenderId: d.lenderId, lender: d.lender, lenderType: d.lenderType, kind: d.kind, product: d.product,
    rate, rateMin: pr.model === "rate" ? pr.rateMin : undefined, rateMax: pr.model === "rate" ? pr.rateMax : undefined, rateNote,
    pricing: pr, feesKnown: true,
    sourceUrl: d.sourceUrl, checkedOn: d.checkedOn, detail: d,
  };
}

// Every offer we can price: KBA-reported rates, plus lenders outside the
// report. A lender's own page overrides its KBA row for the same product.
export function allOffers(products: LenderProduct[]): Offer[] {
  const own = LENDER_DETAILS.filter((d) => d.pricing).map(fromDetail);
  const ownIds = new Set(own.map((o) => o.id));
  const kba = products.filter((p) => p.rate >= MIN_REPORTED_RATE).map(fromKba).filter((o) => !ownIds.has(o.id));
  return [...kba, ...own];
}

export interface Quote {
  monthly: number; // per month, or the single repayment for a mobile loan
  totalCost: number; // everything paid above the amount borrowed
  overLimit: boolean; // amount is above the lender's published maximum
}

function bandFee(bands: [number, number][], owed: number) {
  return bands.find(([upTo]) => owed <= upTo)?.[1] ?? bands.at(-1)![1];
}

// What borrowing `amount` for `months` (mobile: one 30-day term) would cost.
export function quoteOffer(o: Offer, amount: number, months: number, feePct = DEFAULT_FEE_PCT): Quote {
  const overLimit = o.detail?.maxAmount != null && amount > o.detail.maxAmount;
  const p = o.pricing;
  if (p.model === "daily_bands") {
    const cost = (amount * p.accessPct) / 100 + MOBILE_DAYS * bandFee(p.bands, amount) * (1 + p.excisePct / 100);
    return { monthly: amount + cost, totalCost: cost, overLimit };
  }
  const bullet = p.frequency === "bullet";
  const terms: LoanTerms = {
    principal: amount, rate: p.rate, rateType: p.rateType, frequency: p.frequency,
    installments: bullet ? 1 : Math.max(1, months), termDays: bullet ? (p.termDays ?? MOBILE_DAYS) : undefined,
  };
  const charge = totalCostOfCredit(terms);
  const fees = o.feesKnown
    ? (amount * (p.upfrontPct ?? 0)) / 100 + (charge * (p.excisePct ?? 0)) / 100
    : (amount * feePct) / 100;
  return { monthly: installment(terms), totalCost: charge + fees, overLimit };
}

// Which kind of product a borrower's loan is, from its lender type and name.
export function loanKind(loan: Pick<Loan, "lenderType" | "lender" | "productName">): ProductKind {
  const name = `${loan.productName ?? ""} ${loan.lender}`.toLowerCase();
  if (/mortgage|home loan|house|plot/.test(name)) return "mortgage";
  if (/car|vehicle|motor|asset|logbook|boda|equipment/.test(name)) return "asset";
  if (/business|biashara|sme|trade|invoice|stock/.test(name)) return "business";
  if (loan.lenderType === "digital" || /m-?shwari|fuliza|mpesa|m-pesa|mobile|digital|app\b|eazzy|timiza|tala|branch|zenka|hustler/.test(name)) return "mobile";
  return "personal";
}

// Same lender, allowing for "KCB" vs "KCB Bank Kenya Limited" and "Co-op".
const key = (s: string) => lenderKey(s).replace(/\bco ?op(erative)?\b/g, "coop");
export const sameLender = (a: string, b: string) => {
  const x = key(a), y = key(b);
  if (!x || !y) return false;
  const [fx] = x.split(" "), [fy] = y.split(" ");
  return x === y || x.includes(y) || y.includes(x) || (fx.length >= 3 && fx === fy);
};

export interface LoanComparison {
  loan: Loan;
  kind: ProductKind;
  amount: number;
  months: number; // remaining; 1 for mobile loans
  current: { monthly: number; totalCost: number };
  rows: { offer: Offer; quote: Quote; saving: number; yours: boolean }[];
}

// One open loan against every offer for the same kind of product, cheapest
// first. Bank loans compare what's left to pay over the remaining months;
// mobile loans compare the cost of borrowing the same amount for 30 days.
export function compareLoan(loan: Loan, offers: Offer[], feePct = DEFAULT_FEE_PCT, today = new Date()): LoanComparison {
  const kind = loanKind(loan);
  const mobile = kind === "mobile";
  const amount = mobile ? loan.terms.principal : balance(loan, today);
  const months = mobile ? 1 : monthsLeft(loan, today);
  const monthly = installment(loan.terms);
  let current: LoanComparison["current"];
  if (mobile) {
    const days = loan.terms.frequency === "bullet" ? (loan.terms.termDays ?? MOBILE_DAYS) : MOBILE_DAYS;
    const cost = totalCostOfCredit(loan.terms);
    current = { monthly: amount + (cost * MOBILE_DAYS) / Math.max(days, 1), totalCost: (cost * MOBILE_DAYS) / Math.max(days, 1) };
  } else {
    // Remaining interest: what's left to pay minus the balance owed.
    current = { monthly, totalCost: Math.max(0, monthly * months - amount) };
  }
  const rows = offers
    .filter((o) => o.kind === kind)
    .map((offer) => {
      const quote = quoteOffer(offer, amount, months, feePct);
      return { offer, quote, saving: current.totalCost - quote.totalCost, yours: sameLender(offer.lender, loan.lender) };
    })
    .sort((a, b) => Number(a.quote.overLimit) - Number(b.quote.overLimit) || a.quote.totalCost - b.quote.totalCost);
  return { loan, kind, amount, months, current, rows };
}

// Requirements, turnaround and costs for an offer, falling back to what most
// lenders of that kind ask for.
export function detailsOf(o: Offer) {
  const typical = TYPICAL[o.kind];
  const d = o.detail;
  return {
    product: d?.product ?? o.product,
    amount: d?.amount,
    term: d?.term,
    security: d?.security,
    requirements: d?.requirements?.length ? d.requirements : typical.requirements,
    requirementsTypical: !d?.requirements?.length,
    turnaround: d?.turnaround ?? typical.turnaround,
    turnaroundTypical: !d?.turnaround,
    costs: d?.costs?.length ? d.costs : typical.costs,
    // Typical charges this lender's page didn't mention, to ask about.
    otherCosts: d?.costs.length ? typical.costs.filter((t) => !/interest|facility/i.test(t.name) && !d.costs.some((c) => c.name.toLowerCase() === t.name.toLowerCase())) : [],
    costsTypical: !d?.costs.length,
    notes: d?.notes ?? [],
    sourceUrl: d?.sourceUrl,
  };
}

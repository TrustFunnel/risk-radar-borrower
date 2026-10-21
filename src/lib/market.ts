import type { LoanTerms, RateType } from "./finance";
import { apr, installment, totalCostOfCredit } from "./finance";
import type { LenderType } from "./types";

// One loan product as published by a lender, written by scripts/scrape-lenders.mjs.
export interface LenderProduct {
  lenderId: string;
  lender: string;
  lenderType: LenderType;
  product: string;
  minAmount?: number;
  maxAmount?: number;
  minTermMonths?: number;
  maxTermMonths?: number;
  rate: number; // percent
  rateType: RateType;
  feePct?: number; // upfront fees as % of principal, incl. insurance and excise
  feeFlat?: number; // fixed upfront fees, KES
  collateral?: string;
  sourceUrl: string;
  checkedOn: string; // ISO date of the scrape
}

export function quote(p: LenderProduct, amount: number, months: number) {
  const digitalShortTerm = p.rateType === "per_term" && (p.maxTermMonths ?? 1) <= 1;
  const terms: LoanTerms = digitalShortTerm
    ? { principal: amount, rate: p.rate, rateType: p.rateType, frequency: "bullet", installments: 1, termDays: 30 }
    : { principal: amount, rate: p.rate, rateType: p.rateType, frequency: "monthly", installments: months };
  terms.upfrontFees = (amount * (p.feePct ?? 0)) / 100 + (p.feeFlat ?? 0);
  return { terms, apr: apr(terms), installment: installment(terms), totalCost: totalCostOfCredit(terms) };
}

export function fits(p: LenderProduct, amount: number, months: number) {
  return (p.minAmount == null || amount >= p.minAmount) && (p.maxAmount == null || amount <= p.maxAmount) &&
    (p.rateType === "per_term" || ((p.minTermMonths == null || months >= p.minTermMonths) && (p.maxTermMonths == null || months <= p.maxTermMonths)));
}

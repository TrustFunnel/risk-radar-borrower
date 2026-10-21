import type { LoanTerms, RateType } from "./finance";
import { apr, installment, totalCostOfCredit } from "./finance";
import type { LenderType } from "./types";

// One lender's published pricing, written by scripts/scrape-lenders.mjs.
export interface LenderProduct {
  lenderId: string;
  lender: string;
  lenderType: LenderType;
  product: string;
  rate: number; // percent per year
  rateMin?: number;
  rateMax?: number;
  rateType: RateType;
  feesIncluded: boolean; // KBA reports interest only
  sourceUrl: string;
  rateUpdatedOn?: string; // when the lender last updated the rate
  checkedOn: string; // when we last scraped it
}

// Typical upfront costs on a Kenyan bank personal loan (processing fee,
// credit life insurance, excise duty). An assumption the borrower can change,
// used only where the lender's fees are not published.
export const DEFAULT_FEE_PCT = 3;

export function quote(p: LenderProduct, amount: number, months: number, feePct = DEFAULT_FEE_PCT) {
  const terms: LoanTerms = {
    principal: amount, rate: p.rate, rateType: p.rateType, frequency: "monthly", installments: Math.max(1, months),
    upfrontFees: p.feesIncluded ? 0 : (amount * feePct) / 100,
  };
  return { terms, apr: apr(terms), installment: installment(terms), totalCost: totalCostOfCredit(terms) };
}

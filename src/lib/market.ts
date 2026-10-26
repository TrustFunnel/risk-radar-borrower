import type { LoanTerms, RateType } from "./finance";
import { apr, installment, totalCostOfCredit } from "./finance";
import type { LenderType } from "./types";

// The kinds of loan we compare like for like.
export type ProductKind = "personal" | "mobile" | "asset" | "mortgage" | "business";

export const KIND_LABEL: Record<ProductKind, string> = {
  personal: "Personal loan",
  mobile: "Mobile loan",
  asset: "Car or asset loan",
  mortgage: "Mortgage",
  business: "Business loan",
};

// One lender's published pricing, written by scripts/scrape-lenders.mjs.
export interface LenderProduct {
  lenderId: string;
  lender: string;
  lenderType: LenderType;
  kind?: ProductKind; // older files hold personal loans only
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

export const kindOf = (p: LenderProduct): ProductKind => p.kind ?? "personal";

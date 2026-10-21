import type { LoanTerms } from "./finance";
import type { MonthFlow } from "./remediation";

export type LenderType = "bank" | "sacco" | "mfi" | "digital" | "chama" | "other";

export const LENDER_TYPES: { value: LenderType; label: string }[] = [
  { value: "bank", label: "Bank" },
  { value: "sacco", label: "SACCO" },
  { value: "mfi", label: "Microfinance" },
  { value: "digital", label: "Digital / mobile app" },
  { value: "chama", label: "Chama / group" },
  { value: "other", label: "Other" },
];

export type LoanStatus = "current" | "late" | "defaulted" | "closed";

export interface Loan {
  id: string;
  lender: string;
  lenderType: LenderType;
  productName?: string;
  terms: LoanTerms;
  disbursedOn: string; // ISO date
  firstDueDate: string; // ISO date
  outstandingBalance?: number; // from the latest statement, if known
  arrearsDays: number;
  status: LoanStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Profile {
  displayName: string;
  monthlyIncome: number;
  phone?: string;
  incomeFlows?: MonthFlow[]; // monthly totals from statements or typed in
  incomeSource?: "statement" | "manual";
  essentials?: number; // KES per month: rent, food, transport, school fees
}

// Each purpose is consented to separately (Kenya Data Protection Act 2019,
// s.30 and s.32): storing is required to use the wallet; the rest are optional.
export type ConsentPurpose = "store" | "analyse" | "reminders" | "share_partner";

export const CONSENT_VERSION = "2026-10-21";

export const CONSENT_TEXT: Record<ConsentPurpose, { title: string; body: string; required: boolean }> = {
  store: {
    title: "Store my loan details",
    body: "Keep the loans, schedules and statements I add so I can see them in one place. Needed to use the loan wallet.",
    required: true,
  },
  analyse: {
    title: "Analyse my loans",
    body: "Calculate my true loan cost, debt-to-income and loan health score from what I add. Nothing leaves the app.",
    required: false,
  },
  reminders: {
    title: "Send me reminders",
    body: "Text me 3 days before and on the day each repayment is due.",
    required: false,
  },
  share_partner: {
    title: "Share a loan I flag for help",
    body: "When I ask for help with a specific loan, share that loan's details with the partner I choose. Asked again each time.",
    required: false,
  },
};

export interface ConsentRecord {
  purpose: ConsentPurpose;
  granted: boolean;
  version: string;
  at: string; // ISO timestamp
}

export interface DistressRequest {
  id: string;
  loanId: string;
  goal: "affordable_plan" | "refinance" | "settlement" | "advice";
  targetLender?: string; // refinance: the lender asked to buy the loan out
  proposedMonthly?: number; // affordable_plan / refinance: the payment proposed
  message: string;
  status: "submitted" | "in_review" | "closed" | "withdrawn";
  createdAt: string;
}

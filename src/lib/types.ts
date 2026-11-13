import type { LoanTerms } from "./finance";
import type { EmploymentType, Industry } from "./industry";
import type { MoneyEvent } from "./money/parse";
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
  work?: WorkDetails;
}

export interface WorkDetails {
  employmentType: EmploymentType;
  employer: string; // or business name
  jobTitle: string;
  industry: Industry;
  industrySource: "auto" | "manual";
  since?: string; // YYYY-MM, started with this employer or business
}

// ---------- Documents the borrower uploads ----------

export type DocKind = "crb" | "mpesa" | "bank";

export type CrbBureau = "Metropol" | "TransUnion" | "Creditinfo" | "Other";

export interface CrbAccount {
  lender: string;
  accountType: string; // e.g. personal loan, mobile loan, overdraft, credit card
  openedOn?: string; // YYYY-MM-DD
  principal?: number;
  balance: number;
  arrearsDays: number;
  status: "performing" | "non_performing" | "written_off" | "closed" | "settled";
  negative: boolean; // listed as a negative (default) entry
}

export interface CrbReport {
  bureau: CrbBureau;
  reportDate?: string;
  score?: number;
  scoreBand?: string;
  accounts: CrbAccount[];
}

// A document the borrower read into the app. Only what was read out is kept;
// the file itself stays on their phone.
export interface DocRecord {
  id: string;
  kind: DocKind;
  fileName: string;
  crb?: CrbReport;
  flows?: MonthFlow[];
  summary: string; // one line shown in the list, e.g. "6 months, KES 312,400 in"
  createdAt: string;
}

// Each purpose is consented to separately (Kenya Data Protection Act 2019,
// s.30 and s.32): storing is required to use the wallet; the rest are optional.
export type ConsentPurpose = "store" | "analyse" | "ai_read" | "reminders" | "share_partner" | "sms_read";

export const CONSENT_VERSION = "2026-10-29";

export const CONSENT_TEXT: Record<ConsentPurpose, { title: string; body: string; required: boolean }> = {
  store: {
    title: "Store my loan details",
    body: "Keep the loans, schedules and statements I add so I can see them in one place. Needed to use the loan wallet.",
    required: true,
  },
  analyse: {
    title: "Analyse my loans",
    body: "Calculate my true loan cost, debt-to-income and loan health score from the details I add. This happens within Risk Radar.",
    required: false,
  },
  ai_read: {
    title: "Read my documents with AI",
    body: "When I upload a CRB report or bank statement, or ask for my industry to be filled in, send that text to our AI provider, Anthropic (in the United States), to read the figures. The file stays on my phone. Only the figures are kept, and I can type them in instead.",
    required: false,
  },
  reminders: {
    title: "Send me reminders",
    body: "Text me 3 days before and on the day each repayment is due.",
    required: false,
  },
  sms_read: {
    title: "Read my money messages",
    body: "Read the SMS that M-PESA, Airtel Money, banks and lenders send me, as they arrive on the Afueni Android app or when I share or paste them. They are read on my phone: only the amount, date, type, balance and the business or lender name are kept. The message text, personal messages and the names and numbers of people I send money to are never kept or uploaded. I can switch this off at any time and what was captured is deleted.",
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

// A transaction read from a money SMS, as stored. See src/lib/money/parse.ts.
export interface MoneyRecord extends MoneyEvent {
  id: string;
  channel: "auto" | "share" | "paste";
  createdAt: string;
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

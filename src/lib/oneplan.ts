// Afueni One Plan: one affordable payment that covers all of a borrower's
// loans. Pure functions, no I/O, so they run in the browser and in tests.
// The rules follow "RR - Afueni Borrower Solution v1.2", section 5.3 C to K.

import { monthlyObligation, payoffPlan, type PlanLoan } from "./finance";
import type { CrbAccount, CrbReport, Loan } from "./types";

// ---------- C. Safe Payment ----------

// Safe Payment = slowest month's income, minus essentials, less a 20% buffer.
// Example from the strategy doc: 28,000 - 22,000 = 6,000, less 20% = 4,800.
export const SAFE_BUFFER = 0.2;

export function safePayment(slowestMonthIncome: number, essentials: number): number {
  return Math.max(0, Math.floor((slowestMonthIncome - essentials) * (1 - SAFE_BUFFER)));
}

// ---------- E. Rhythm and split ----------

export type Rhythm = "daily" | "weekly" | "monthly";
export type Split = "fair" | "small_first";

export const RHYTHM_LABEL: Record<Rhythm, string> = { daily: "every day", weekly: "every week", monthly: "every month on payday" };
const PER_YEAR: Record<Rhythm, number> = { daily: 365, weekly: 52, monthly: 12 };

// What a monthly amount comes to per payment at this rhythm.
export const perPayment = (monthly: number, rhythm: Rhythm) => Math.floor((monthly * 12) / PER_YEAR[rhythm]);

export function addPeriods(start: Date, rhythm: Rhythm, k: number): Date {
  const d = new Date(start);
  if (rhythm === "daily") d.setDate(d.getDate() + k);
  else if (rhythm === "weekly") d.setDate(d.getDate() + 7 * k);
  else d.setMonth(d.getMonth() + k);
  return d;
}

export interface PlanInput {
  loanId: string;
  lender: string;
  balance: number;
}

export interface PlanLine {
  loanId: string;
  lender: string;
  balance: number;
  firstPayment: number; // KES this lender gets on payment 1
  payments: number; // payments until this lender is cleared
  clearsOn: number; // payment number on which it clears
}

export interface PlanDraft {
  rhythm: Rhythm;
  split: Split;
  amount: number; // KES per payment, across all lenders
  totalPayments: number; // until debt free; 0 if it never clears
  lines: PlanLine[];
  total: number; // KES repaid through the plan (balances, penalties frozen)
  feasible: boolean;
}

// Every lender gets at least this share of each payment, so nobody is left
// out of the plan (the Code asks lenders to accept small regular sums).
export const MIN_SHARE = 0.05;
const MAX_PAYMENTS = 3650;

// Splits each payment across lenders until everything is cleared. "fair":
// in proportion to what each lender is still owed. "small_first": each gets
// the minimum and the rest clears the smallest balance first (quick wins,
// often clears small CRB listings in weeks). Interest and penalties are
// assumed frozen under the Creditor Code; that is what the plan asks for.
export function buildPlan(loans: PlanInput[], amount: number, rhythm: Rhythm, split: Split = "fair"): PlanDraft {
  const live = loans.filter((l) => l.balance > 0).map((l) => ({ ...l, left: l.balance, first: 0, clearsOn: 0 }));
  const total = live.reduce((s, l) => s + l.balance, 0);
  if (!live.length || amount <= 0) {
    return { rhythm, split, amount: Math.max(amount, 0), totalPayments: 0, lines: live.map((l) => line(l)), total, feasible: !live.length };
  }
  let k = 0;
  while (live.some((l) => l.left > 0.5) && k < MAX_PAYMENTS) {
    k++;
    const open = live.filter((l) => l.left > 0.5);
    const owed = open.reduce((s, l) => s + l.left, 0);
    const min = (amount * MIN_SHARE);
    let pot = amount;
    const give = new Map<string, number>();
    const pay = (l: (typeof open)[number], x: number) => {
      const y = Math.min(x, l.left - (give.get(l.loanId) ?? 0), pot);
      if (y <= 0) return;
      give.set(l.loanId, (give.get(l.loanId) ?? 0) + y);
      pot -= y;
    };
    if (split === "small_first") {
      for (const l of open) pay(l, min);
      for (const l of [...open].sort((a, b) => a.left - b.left)) pay(l, pot);
    } else {
      const w = open.map((l) => Math.max(MIN_SHARE, l.left / owed));
      const sum = w.reduce((s, x) => s + x, 0);
      open.forEach((l, i) => pay(l, (amount * w[i]) / sum));
      // Anything left over (a lender cleared mid-payment) goes to the largest.
      for (const l of [...open].sort((a, b) => b.left - a.left)) pay(l, pot);
    }
    for (const l of open) {
      const g = give.get(l.loanId) ?? 0;
      if (k === 1) l.first = Math.round(g);
      l.left -= g;
      if (l.left <= 0.5 && !l.clearsOn) { l.left = 0; l.clearsOn = k; }
    }
  }
  const feasible = live.every((l) => l.clearsOn > 0);
  return { rhythm, split, amount, totalPayments: feasible ? k : 0, lines: live.map(line), total, feasible };
}

function line(l: { loanId: string; lender: string; balance: number; first: number; clearsOn: number }): PlanLine {
  return { loanId: l.loanId, lender: l.lender, balance: l.balance, firstPayment: l.first, payments: l.clearsOn, clearsOn: l.clearsOn };
}

// Plans start a week from today unless the borrower picks another day.
export const defaultStart = (today = new Date()) => addPeriods(today, "weekly", 1);

export function freedomDate(start: Date, rhythm: Rhythm, payments: number): Date {
  return addPeriods(start, rhythm, Math.max(payments - 1, 0));
}

export const fmtMonth = (d: Date) => d.toLocaleDateString("en-KE", { month: "long", year: "numeric" });

// What the plan asks each lender to do while it runs (the Creditor Code).
export const FREEZE_ASK = [
  "Freeze interest and penalties while the plan runs",
  "Stop calls, messages and contact with family, friends or employer",
  "No new CRB listing while payments are made",
  "Report the account as settled and issue a clearance certificate at the end",
];

// ---------- Plain status (replaces the health score on screen) ----------

export type PlainStatus = "On track" | "Stretched" | "Behind";

export function plainStatus(loans: Loan[], safe: number | null, crb?: CrbReport): { status: PlainStatus; why: string } {
  const open = loans.filter((l) => l.status !== "closed");
  const behind = open.filter((l) => l.arrearsDays > 0 || l.status === "late" || l.status === "defaulted");
  const listed = (crb?.accounts ?? []).filter((a) => a.negative && a.status !== "settled" && a.status !== "closed");
  if (behind.length) return { status: "Behind", why: `${behind.length} loan${behind.length === 1 ? " is" : "s are"} behind on payments.` };
  if (listed.length) return { status: "Behind", why: `Your CRB report shows ${listed.length} negative listing${listed.length === 1 ? "" : "s"}.` };
  const monthly = open.reduce((s, l) => s + monthlyObligation(l.terms), 0);
  if (safe != null && monthly > safe) return { status: "Stretched", why: "Your loan payments are more than you can safely pay each month." };
  return { status: "On track", why: safe == null ? "No missed payments. Add your income and essentials to check what you can safely pay." : "Your payments fit what you can safely pay." };
}

// ---------- Who can be shown cheaper lenders ----------

// Banks do not refinance listed or arrears borrowers, so Compare offers are
// only shown to people who could actually get them (strategy doc, section 7).
export function canRefinance(loans: Loan[], crb?: CrbReport): { ok: boolean; reason?: string } {
  const open = loans.filter((l) => l.status !== "closed");
  if (open.some((l) => l.arrearsDays > 0 || l.status === "late" || l.status === "defaulted")) {
    return { ok: false, reason: "One of your loans is behind. Lenders do not refinance loans in arrears, so a cheaper lender is unlikely to say yes right now." };
  }
  if ((crb?.accounts ?? []).some((a) => a.negative && a.status !== "settled" && a.status !== "closed")) {
    return { ok: false, reason: "Your CRB report shows a negative listing. Lenders check this first, so a cheaper loan is unlikely until it is cleared." };
  }
  return { ok: true };
}

// ---------- D. Choosing a route ----------

export type RouteKey = "tips" | "refinance" | "one_plan" | "pause" | "clean_slate";

export interface Route {
  key: RouteKey;
  title: string;
  body: string;
  recommended: boolean;
  available: boolean;
  months?: number; // to debt free, where it can be worked out
  freedom?: Date; // the Freedom Date on this route
  totalCost?: number; // KES still to pay, where it can be worked out
  href: string;
}

export interface RouteInput {
  loans: Loan[];
  views: { id: string; lender: string; balance: number; aprPct: number; monthly: number }[];
  safe: number | null;
  crb?: CrbReport;
  shock?: boolean; // borrower says they were just hit by a shock
  refinanceSaving?: number; // best total saving across loans, if any
}

const monthsFor = (payments: number, rhythm: Rhythm) => Math.ceil((payments * 12) / PER_YEAR[rhythm]);

export function routes(r: RouteInput): Route[] {
  const monthly = r.views.reduce((s, v) => s + v.monthly, 0);
  const owed = r.views.reduce((s, v) => s + v.balance, 0);
  const behind = r.loans.some((l) => l.status !== "closed" && (l.arrearsDays > 0 || l.status === "late" || l.status === "defaulted"));
  const listed = (r.crb?.accounts ?? []).some((a) => a.negative && a.status !== "settled" && a.status !== "closed");
  const overSafe = r.safe != null && monthly > r.safe;
  const ref = canRefinance(r.loans, r.crb);

  const minimums: PlanLoan[] = r.views.map((v) => ({ id: v.id, name: v.lender, balance: v.balance, aprPct: v.aprPct, minPayment: v.monthly }));
  const keep = payoffPlan(minimums, 0, "avalanche");
  const plan = r.safe && r.safe > 0 ? buildPlan(r.views.map((v) => ({ loanId: v.id, lender: v.lender, balance: v.balance })), r.safe, "monthly") : null;

  const out: Route[] = [
    {
      key: "tips", title: "Keep paying, with tips and reminders",
      body: behind ? "You are behind on a loan, so carrying on as you are won't get you out." : overSafe ? "Your payments are more than you can safely pay, so this route risks falling behind." : "Your payments fit. We remind you before each due date and show you which loan to clear first.",
      recommended: !behind && !overSafe && !r.shock, available: !behind,
      months: keep.capped ? undefined : keep.months, freedom: keep.capped ? undefined : addPeriods(new Date(), "monthly", keep.months),
      totalCost: keep.capped ? undefined : owed + keep.totalInterest, href: "/plan?route=tips",
    },
    {
      key: "refinance", title: "Move a loan to a cheaper lender",
      body: ref.ok ? (r.refinanceSaving ? `Could save about KES ${Math.round(r.refinanceSaving).toLocaleString("en-KE")} if a lender approves you.` : "No cheaper lender beats your loans right now.") : ref.reason!,
      recommended: ref.ok && overSafe && !!r.refinanceSaving && !r.shock, available: ref.ok && !!r.refinanceSaving,
      totalCost: ref.ok && r.refinanceSaving ? owed + keep.totalInterest - r.refinanceSaving : undefined, href: "/help?tab=refinance",
    },
    {
      key: "one_plan", title: "Afueni One Plan",
      body: plan?.feasible ? "One payment you can afford, shared across all your lenders. We ask them to freeze penalties and stop the calls." : "Add your income and essentials first so we can size a payment you can afford.",
      recommended: !r.shock && (behind || (overSafe && !(ref.ok && r.refinanceSaving))), available: !!plan?.feasible,
      months: plan?.feasible ? monthsFor(plan.totalPayments, "monthly") : undefined,
      freedom: plan?.feasible ? freedomDate(defaultStart(), "monthly", plan.totalPayments) : undefined, totalCost: plan?.feasible ? plan.total : undefined, href: "/plan?route=one_plan",
    },
    {
      key: "pause", title: "Afueni Pause",
      body: "Up to 30 days' breathing space after illness, a death, job loss or another shock. Then a One Plan sized to your new income.",
      recommended: !!r.shock || r.safe === 0, available: true, href: "/plan/pause",
    },
    {
      key: "clean_slate", title: "Afueni Clean Slate",
      body: listed ? "We check every CRB listing against the rules and dispute the ones that break them. Runs alongside any plan." : "Upload your CRB report and we check every listing against the rules.",
      recommended: listed, available: true, href: "/plan/clean-slate",
    },
  ];
  return out;
}

// ---------- J. Clean Slate checks ----------

export interface ListingCheck {
  account: CrbAccount;
  problems: string[]; // rules the listing may break
  smallDebt: boolean; // clear it first in the plan
}

// CRB Regulations 2020: no negative listing under KES 1,000; 30 days' written
// notice first; a paid-up account must be updated. Notice is asked of the
// borrower because reports don't show it.
export const MIN_LISTING = 1000;
export const SMALL_DEBT = 5000;

export function checkListings(report: CrbReport | undefined, noNotice: Set<string> = new Set()): ListingCheck[] {
  return (report?.accounts ?? []).filter((a) => a.negative).map((a) => {
    const problems: string[] = [];
    if (a.balance > 0 && a.balance < MIN_LISTING) problems.push(`Listed for less than KES ${MIN_LISTING.toLocaleString("en-KE")}, which the CRB rules do not allow.`);
    if (a.status === "settled" || a.status === "closed" || a.balance <= 0) problems.push("Shown as paid or closed but still listed as negative.");
    if (noNotice.has(listingKey(a))) problems.push("You say you got no 30-day written notice before the listing.");
    return { account: a, problems, smallDebt: a.balance > 0 && a.balance <= SMALL_DEBT };
  });
}

export const listingKey = (a: CrbAccount) => `${a.lender}|${a.accountType}|${a.openedOn ?? ""}`;

// ---------- Plan references ----------

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O or 1/I
export function planRef(rand: () => number = Math.random): string {
  let s = "";
  for (let i = 0; i < 6; i++) s += ALPHABET[Math.floor(rand() * ALPHABET.length)];
  return `AFUENI-${s}`;
}

// ---------- K. Graduates (design stub) ----------

// Eligible after finishing a plan, or 12 months of on-time plan payments.
export function graduateEligible(p: { completed: boolean; monthsOnTime: number }): boolean {
  return p.completed || p.monthsOnTime >= 12;
}

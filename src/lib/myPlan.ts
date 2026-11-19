// Reads what the One Plan screens need from the borrower's data.

import products from "@/data/lender-products.json";
import { monthlyObligation } from "./finance";
import { view } from "./loanView";
import { kindOf, type LenderProduct } from "./market";
import { addPeriods, buildPlan, freedomDate, plainStatus, safePayment, type Rhythm, type Split } from "./oneplan";
import { refinanceOffers, summariseIncome } from "./remediation";
import type { Db } from "./store";
import type { CrbReport, OnePlan } from "./types";

const personal = (products as LenderProduct[]).filter((p) => kindOf(p) === "personal");

export function latestCrb(db: Db): CrbReport | undefined {
  return [...db.documents].reverse().find((d) => d.kind === "crb" && d.crb)?.crb;
}

export function money(db: Db) {
  const flows = db.profile?.incomeFlows ?? [];
  const s = summariseIncome(flows);
  // The slowest month from statements; otherwise the income they typed in.
  const slowest = s.months ? s.lowestMonth : db.profile?.monthlyIncome ?? 0;
  const essentials = db.profile?.essentials;
  const known = slowest > 0 && essentials != null;
  return { months: s.months, slowest, average: s.averageIncome, essentials, safe: known ? safePayment(slowest, essentials!) : null };
}

export function loanViews(db: Db) {
  return db.loans.filter((l) => l.status !== "closed").map((l) => {
    const v = view(l);
    return { id: l.id, lender: l.lender, balance: v.balance, aprPct: v.apr, monthly: monthlyObligation(l.terms), monthsLeft: v.monthsLeft, loan: l };
  });
}

export function bestRefinanceSaving(views: ReturnType<typeof loanViews>): number {
  return views.reduce((s, v) => s + (refinanceOffers({ balance: v.balance, aprPct: v.aprPct, monthsLeft: v.monthsLeft, currentMonthly: v.monthly }, personal)[0]?.saving ?? 0), 0);
}

export function status(db: Db) {
  return plainStatus(db.loans, money(db).safe, latestCrb(db));
}

export function draftFor(db: Db, amountPerMonth: number, rhythm: Rhythm, split: Split) {
  const views = loanViews(db);
  const per = Math.floor((amountPerMonth * 12) / (rhythm === "daily" ? 365 : rhythm === "weekly" ? 52 : 12));
  return buildPlan(views.map((v) => ({ loanId: v.id, lender: v.lender, balance: v.balance })), per, rhythm, split);
}

// Where the borrower is on a live plan.
export function progress(plan: OnePlan, today = new Date()) {
  const paid = plan.payments.filter((p) => p.status === "paid").length;
  const missed = plan.payments.filter((p) => p.status === "missed").length;
  const repaid = plan.payments.reduce((s, p) => s + (p.status === "missed" ? 0 : p.amount ?? plan.amount), 0);
  const owed = plan.lenders.reduce((s, l) => s + l.balance, 0);
  const start = new Date(plan.startDate + "T00:00:00");
  // Each missed payment pushes the Freedom Date back by one payment.
  const freedom = freedomDate(start, plan.rhythm, plan.totalPayments + missed);
  const next = addPeriods(start, plan.rhythm, plan.payments.length);
  const daysToNext = Math.ceil((next.getTime() - today.getTime()) / 86_400_000);
  const pausedDays = plan.pause?.status === "granted" ? plan.pause.days : 0;
  // Months of on-time payments, for the Graduates check.
  const monthsOnTime = missed ? 0 : Math.floor((paid * (plan.rhythm === "monthly" ? 1 : plan.rhythm === "weekly" ? 12 / 52 : 12 / 365)));
  return { paid, missed, repaid, owed, left: Math.max(owed - repaid, 0), freedom: pausedDays ? new Date(freedom.getTime() + pausedDays * 86_400_000) : freedom, next, daysToNext, monthsOnTime, pct: owed ? Math.min(100, (repaid / owed) * 100) : 0 };
}

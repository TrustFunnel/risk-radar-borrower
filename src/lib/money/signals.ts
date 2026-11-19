// Turns captured money events into (1) monthly flows for the affordable plan,
// replacing the monthly statement upload, and (2) early-warning signals the
// borrower sees on the Money screen.

import { kes } from "../finance";
import type { MonthFlow } from "../remediation";
import type { MoneyEvent } from "./parse";

const NOT_INCOME = new Set(["loan_disbursed", "reversal", "overdraft"]);
const DAY = 86_400_000;

// East Africa Time month and day for an ISO timestamp.
const eat = (iso: string) => new Date(new Date(iso).getTime() + 3 * 3_600_000).toISOString();
export const monthOf = (iso: string) => eat(iso).slice(0, 7);
const dayOf = (iso: string) => eat(iso).slice(0, 10);

// Monthly money in and out, leaving out borrowing (it isn't income) and loan
// repayments (the plan works those out itself). Only whole months are
// returned: a month counts once capture was on from its first day, so a
// half-captured month never makes income look smaller than it is.
export function monthlyFlows(events: MoneyEvent[], captureSince: string, now = new Date().toISOString()): MonthFlow[] {
  const first = monthOf(captureSince);
  const startedOnFirst = dayOf(captureSince).endsWith("-01");
  const thisMonth = monthOf(now);
  const byMonth = new Map<string, MonthFlow>();
  for (const e of events) {
    const m = monthOf(e.occurredAt);
    if (m >= thisMonth || m < first || (m === first && !startedOnFirst)) continue;
    const f = byMonth.get(m) ?? { month: m, inflow: 0, outflow: 0 };
    if (e.direction === "in" && !NOT_INCOME.has(e.kind)) f.inflow += e.amount;
    if (e.direction === "out" && e.kind !== "loan_repaid") f.outflow += e.amount + (e.fee ?? 0);
    byMonth.set(m, f);
  }
  return [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month));
}

export interface Signal {
  id: string;
  level: "good" | "watch" | "alert";
  text: string;
}

export interface Snapshot {
  days: number;
  income: number;
  spending: number;
  repaid: number;
  borrowed: number;
  betting: number;
  signals: Signal[];
}

// What happened in the last `days` days, in plain words.
export function snapshot(events: MoneyEvent[], days = 30, now = new Date().toISOString()): Snapshot {
  const since = new Date(now).getTime() - days * DAY;
  const recent = events.filter((e) => new Date(e.occurredAt).getTime() >= since && new Date(e.occurredAt).getTime() <= new Date(now).getTime() + DAY);
  const sum = (f: (e: MoneyEvent) => boolean) => recent.filter(f).reduce((s, e) => s + e.amount, 0);
  const income = sum((e) => e.direction === "in" && !NOT_INCOME.has(e.kind));
  const repaid = sum((e) => e.kind === "loan_repaid");
  const borrowed = sum((e) => e.kind === "loan_disbursed" || e.kind === "overdraft");
  const betting = sum((e) => e.category === "betting" && e.direction === "out");
  const spending = sum((e) => e.direction === "out" && e.kind !== "loan_repaid");
  const signals: Signal[] = [];

  const overdue = latestPerLender(recent.filter((e) => e.kind === "loan_overdue"));
  for (const e of overdue) {
    const paidSince = recent.some((r) => r.kind === "loan_repaid" && r.lender === e.lender && r.occurredAt > e.occurredAt);
    if (!paidSince) signals.push({ id: `overdue-${e.lender}`, level: "alert", text: `${e.lender} says a payment of ${kes(e.amount)} is overdue${e.daysOverdue ? ` by ${e.daysOverdue} days` : ""}. Talk to us before it reaches the CRB.` });
  }

  const nowMs = new Date(now).getTime();
  for (const e of latestPerLender(recent.filter((e) => e.kind === "loan_due" && e.dueDate))) {
    const due = new Date(`${e.dueDate}T23:59:00+03:00`).getTime();
    if (due >= nowMs && due - nowMs <= 7 * DAY) signals.push({ id: `due-${e.lender}`, level: "watch", text: `${e.lender}: ${kes(e.amount)} due on ${e.dueDate}.` });
  }

  const lenders = new Set(recent.filter((e) => e.kind === "loan_disbursed" && e.lender !== "Fuliza").map((e) => e.lender));
  if (lenders.size >= 2) signals.push({ id: "many-loans", level: "alert", text: `You took new loans from ${lenders.size} lenders in ${days} days (${[...lenders].join(", ")}). Borrowing to repay other loans is a sign of strain.` });
  else if (lenders.size === 1) signals.push({ id: "new-loan", level: "watch", text: `New loan from ${[...lenders][0]}. Add it to your wallet so your plan includes it.` });

  const fulizaDays = new Set(recent.filter((e) => e.kind === "overdraft").map((e) => dayOf(e.occurredAt))).size;
  if (fulizaDays >= 5) signals.push({ id: "fuliza", level: fulizaDays >= 10 ? "alert" : "watch", text: `Fuliza covered payments on ${fulizaDays} days. It costs more than most loans when used often.` });

  if (betting > 0 && income > 0 && betting / income >= 0.1) signals.push({ id: "betting", level: betting / income >= 0.25 ? "alert" : "watch", text: `${kes(betting)} went to betting, ${Math.round((betting / income) * 100)}% of the money you received.` });

  if (income > 0) {
    const ratio = repaid / income;
    if (ratio >= 0.5) signals.push({ id: "repay-ratio", level: "alert", text: `Loan repayments took ${Math.round(ratio * 100)}% of the money you received. Above 40% is hard to keep up.` });
    else if (ratio >= 0.3) signals.push({ id: "repay-ratio", level: "watch", text: `Loan repayments took ${Math.round(ratio * 100)}% of the money you received.` });
  }

  const lowDays = new Set(recent.filter((e) => e.source === "mpesa" && e.balance != null && e.balance < 100).map((e) => dayOf(e.occurredAt))).size;
  if (lowDays >= 5) signals.push({ id: "low-balance", level: "watch", text: `Your M-PESA balance fell below ${kes(100)} on ${lowDays} days.` });

  if (!signals.length && recent.length) signals.push({ id: "steady", level: "good", text: "Nothing worrying in your money messages. Keep it up." });
  return { days, income, spending, repaid, borrowed, betting, signals };
}

function latestPerLender(xs: MoneyEvent[]): MoneyEvent[] {
  const by = new Map<string, MoneyEvent>();
  for (const e of xs) {
    const k = e.lender ?? "?";
    if (!by.has(k) || by.get(k)!.occurredAt < e.occurredAt) by.set(k, e);
  }
  return [...by.values()];
}

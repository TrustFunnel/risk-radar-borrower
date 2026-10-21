import { apr, installment, schedule } from "./finance";
import type { Loan } from "./types";

const DAY = 86_400_000;

function addPeriods(iso: string, freq: Loan["terms"]["frequency"], k: number): Date {
  const d = new Date(iso + "T00:00:00");
  if (freq === "monthly") d.setMonth(d.getMonth() + k);
  else if (freq === "weekly") d.setDate(d.getDate() + 7 * k);
  return d;
}

export function dueDates(loan: Loan): Date[] {
  const n = loan.terms.frequency === "bullet" ? 1 : Math.max(loan.terms.installments, 1);
  return Array.from({ length: n }, (_, k) => addPeriods(loan.firstDueDate, loan.terms.frequency, k));
}

// Installments whose due date has passed. Assumes they were paid unless the
// borrower recorded arrears; the statement balance overrides this when known.
export function installmentsElapsed(loan: Loan, today = new Date()): number {
  return dueDates(loan).filter((d) => d.getTime() < today.getTime() - DAY / 2).length;
}

export function nextDue(loan: Loan, today = new Date()): Date | null {
  if (loan.status === "closed") return null;
  return dueDates(loan).find((d) => d.getTime() >= today.getTime() - DAY / 2) ?? null;
}

export function balance(loan: Loan, today = new Date()): number {
  if (loan.status === "closed") return 0;
  if (loan.outstandingBalance != null && loan.outstandingBalance >= 0) return loan.outstandingBalance;
  const rows = schedule(loan.terms);
  const k = installmentsElapsed(loan, today);
  if (k === 0) return loan.terms.principal;
  return rows.at(Math.min(k, rows.length) - 1)?.balance ?? 0;
}

export function monthsLeft(loan: Loan, today = new Date()): number {
  if (loan.status === "closed") return 0;
  const left = dueDates(loan).length - installmentsElapsed(loan, today);
  if (loan.terms.frequency === "weekly") return Math.max(1, Math.ceil((left * 12) / 52));
  return Math.max(1, left);
}

export function view(loan: Loan, today = new Date()) {
  return {
    monthsLeft: monthsLeft(loan, today),
    loan,
    apr: apr(loan.terms),
    installment: installment(loan.terms),
    balance: balance(loan, today),
    nextDue: nextDue(loan, today),
  };
}

export const fmtDate = (d: Date | null) =>
  d ? d.toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" }) : "-";

export const daysUntil = (d: Date, today = new Date()) => Math.ceil((d.getTime() - today.getTime()) / DAY);

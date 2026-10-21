import { installment, kes } from "./finance";
import { daysUntil, fmtDate, nextDue } from "./loanView";
import type { ConsentRecord, Loan } from "./types";

export type ReminderKind = "due_3d" | "due_today";

export interface Reminder {
  loanId: string;
  dueDate: string; // YYYY-MM-DD
  kind: ReminderKind;
  message: string;
}

const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function latestConsent(consents: ConsentRecord[], purpose: ConsentRecord["purpose"]): boolean {
  return !!consents.filter((c) => c.purpose === purpose).sort((a, b) => a.at.localeCompare(b.at)).at(-1)?.granted;
}

// The reminders due today for one borrower's loans: 3 days before and on the
// due date. `today` should be midnight in Nairobi time.
export function remindersFor(loans: Loan[], today: Date): Reminder[] {
  const out: Reminder[] = [];
  for (const l of loans) {
    if (l.status === "closed") continue;
    const due = nextDue(l, today);
    if (!due) continue;
    const d = daysUntil(due, today);
    const kind: ReminderKind | null = d === 3 ? "due_3d" : d === 0 ? "due_today" : null;
    if (!kind) continue;
    const amount = kes(installment(l.terms));
    const message = kind === "due_3d"
      ? `Risk Radar: your ${l.lender} repayment of ${amount} is due on ${fmtDate(due)}, in 3 days. Paying on time protects your CRB record.`
      : `Risk Radar: your ${l.lender} repayment of ${amount} is due today. If you can't pay, open the app and tap Get help before it goes overdue.`;
    out.push({ loanId: l.id, dueDate: isoDay(due), kind, message });
  }
  return out;
}

// Midnight today in Nairobi (UTC+3, no daylight saving), as a local Date.
export function nairobiToday(now = new Date()): Date {
  const eat = new Date(now.getTime() + 3 * 3600_000);
  return new Date(eat.getUTCFullYear(), eat.getUTCMonth(), eat.getUTCDate());
}

// Ready-made payoff plans for the Plan page, so a borrower sees what to pay
// and how long it takes before choosing anything themselves.

import { payoffPlan, type PlanLoan, type PlanResult } from "./finance";
import { affordableBudget } from "./remediation";

export interface Scenario {
  key: "minimums" | "small" | "bigger" | "budget";
  title: string;
  extra: number; // KES a month on top of the minimums
  monthly: number; // total to pay each month
  plan: PlanResult;
  recommended: boolean;
}

const roundUp = (x: number, step = 500) => Math.max(step, Math.ceil(x / step) * step);

// Minimums only, two steps up (about 10% and 25% more), and, when we know
// income and essentials, what the budget allows after a safety buffer. All
// pay the costliest loan first, which costs least in interest.
export function planScenarios(loans: PlanLoan[], money?: { income: number; essentials?: number }): Scenario[] {
  const minimums = loans.reduce((s, l) => s + (l.balance > 0 ? l.minPayment : 0), 0);
  const steps: [Scenario["key"], string, number][] = [
    ["minimums", "Keep paying the minimums", 0],
    ["small", "Add a little each month", roundUp(minimums * 0.1)],
    ["bigger", "Add more each month", roundUp(minimums * 0.25)],
  ];
  if (money && money.income > 0 && money.essentials != null) {
    const spare = Math.floor((affordableBudget(money.income, money.essentials) - minimums) / 500) * 500;
    if (spare > steps[2][2]) steps.push(["budget", "What your budget allows", spare]);
  }
  const seen = new Set<number>();
  const out = steps
    .filter(([, , extra]) => (seen.has(extra) ? false : (seen.add(extra), true)))
    .map(([key, title, extra]): Scenario => ({ key, title, extra, monthly: minimums + extra, plan: payoffPlan(loans, extra, "avalanche"), recommended: false }));
  // Recommend the biggest step the budget allows, or else the smallest step
  // that clears the loans.
  const pick = out.find((s) => s.key === "budget" && !s.plan.capped)
    ?? out.find((s) => s.extra > 0 && !s.plan.capped)
    ?? out.find((s) => !s.plan.capped);
  if (pick) pick.recommended = true;
  return out;
}

// "Mar 2029" for a plan that ends `months` from now.
export function monthsFromNow(months: number, today = new Date()) {
  const d = new Date(today.getFullYear(), today.getMonth() + months, 1);
  return d.toLocaleDateString("en-KE", { month: "short", year: "numeric" });
}

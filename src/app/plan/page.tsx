"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Gate } from "@/components/Gate";
import { kes, monthlyObligation, payoffPlan, type PlanResult, type Strategy } from "@/lib/finance";
import { view } from "@/lib/loanView";
import { summariseIncome } from "@/lib/remediation";
import { monthsFromNow, planScenarios } from "@/lib/scenarios";
import { useDb } from "@/lib/useStore";

export default function Plan() {
  return <Gate><Planner /></Gate>;
}

function Planner() {
  const { db } = useDb();
  const loans = useMemo(() => db.loans.filter((l) => l.status !== "closed").map((l) => {
    const v = view(l);
    return { id: l.id, name: l.lender, balance: v.balance, aprPct: v.apr, minPayment: monthlyObligation(l.terms) };
  }), [db.loans]);
  const profile = db.profile;
  const scenarios = useMemo(() => {
    const flows = profile?.incomeFlows ?? [];
    const income = flows.length ? summariseIncome(flows).conservativeIncome : profile?.monthlyIncome ?? 0;
    return planScenarios(loans, { income, essentials: profile?.essentials });
  }, [loans, profile]);
  const [picked, setPicked] = useState<string | null>(null);
  const chosen = scenarios.find((s) => s.key === picked) ?? scenarios.find((s) => s.recommended) ?? scenarios[0];

  if (!loans.length) return <p className="card my-2 text-sm text-muted">Add loans to build a payoff plan.</p>;

  return (
    <div className="space-y-4 py-2">
      <h1 className="text-xl font-bold">Your payoff plan</h1>
      <p className="text-sm text-muted">How long your loans take to clear at different monthly amounts. Pick one to see exactly what to pay, or build your own below.</p>

      <div className="grid gap-2 sm:grid-cols-2">
        {scenarios.map((s) => {
          const active = s.key === chosen.key;
          return (
            <button key={s.key} onClick={() => setPicked(s.key)} aria-pressed={active}
              className={`card text-left transition-colors ${active ? "border-brand bg-brand-soft/40" : "hover:border-muted"}`}>
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold">{s.title}</p>
                {s.recommended ? <span className="rounded bg-brand px-1.5 py-0.5 text-[11px] font-semibold text-[#181a20]">Recommended</span> : null}
              </div>
              <p className="num mt-1 text-sm">Pay <span className="font-semibold text-brand">{kes(s.monthly)}</span> a month{s.extra ? <span className="text-muted"> ({kes(s.extra)} extra)</span> : null}</p>
              {s.plan.capped ? (
                <p className="mt-1 text-sm font-semibold text-bad">Loans never clear at this amount</p>
              ) : (
                <p className="num mt-1 text-sm">Debt-free by <span className="font-semibold">{monthsFromNow(s.plan.months)}</span> <span className="text-muted">({s.plan.months} months) · {kes(s.plan.totalInterest)} interest</span></p>
              )}
            </button>
          );
        })}
      </div>

      <PlanDetail plan={chosen.plan} loans={loans} vsMinimums={scenarios[0].plan} />

      <CustomPlan loans={loans} />
    </div>
  );
}

// What to pay each loan now, and when each one clears.
type PlanLoans = Parameters<typeof payoffPlan>[0];

function PlanDetail({ plan, loans, vsMinimums }: { plan: PlanResult; loans: PlanLoans; vsMinimums?: PlanResult }) {
  const min = (id: string) => loans.find((l) => l.id === id)?.minPayment ?? 0;
  const target = plan.firstMonth.find((p) => p.pay > min(p.id) + 1);
  const total = plan.firstMonth.reduce((s, p) => s + p.pay, 0);
  return (
    <section className="card space-y-3">
      <div>
        <h2 className="text-sm font-semibold">Pay this month</h2>
        <ul className="mt-2 space-y-1.5 text-sm">
          {plan.firstMonth.map((p) => (
            <li key={p.id} className="flex justify-between gap-3">
              <span>{p.name}{target && p.id === target.id ? <span className="ml-1 text-xs text-brand">extra goes here</span> : null}</span>
              <span className="num font-semibold">{kes(p.pay)}</span>
            </li>
          ))}
          <li className="flex justify-between gap-3 border-t border-line pt-1.5 font-semibold"><span>Total</span><span className="num">{kes(total)}</span></li>
        </ul>
        <p className="mt-1 text-xs text-muted">{target ? `Everything above the minimums goes to ${target.name}. ` : ""}When a loan clears, keep paying the same total: its payment moves to the next loan.</p>
      </div>

      {plan.payoffOrder.length ? (
        <div>
          <h2 className="text-sm font-semibold">When each loan clears</h2>
          <ol className="mt-2 space-y-1.5 text-sm">
            {plan.payoffOrder.map((p, i) => (
              <li key={p.id} className="flex justify-between gap-3"><span>{i + 1}. {p.name}</span><span className="num text-muted">{monthsFromNow(p.month)} (month {p.month})</span></li>
            ))}
          </ol>
        </div>
      ) : null}

      {plan.capped ? (
        <div className="rounded-lg border border-bad/50 p-3 text-sm">
          <p className="font-semibold text-bad">{plan.uncleared.join(", ")} never {plan.uncleared.length === 1 ? "clears" : "clear"} at this amount.</p>
          <p className="mt-1 text-muted">The payments don&apos;t cover the interest. Pay more each month, or ask the lender for an affordable plan.</p>
          <Link href="/help" className="btn mt-2">Get help with this loan</Link>
        </div>
      ) : vsMinimums && !vsMinimums.capped && vsMinimums.totalInterest > plan.totalInterest ? (
        <p className="text-sm text-good">Saves {kes(vsMinimums.totalInterest - plan.totalInterest)} in interest{vsMinimums.months > plan.months ? ` and ${vsMinimums.months - plan.months} month${vsMinimums.months - plan.months === 1 ? "" : "s"}` : ""} versus paying only the minimums.</p>
      ) : null}
    </section>
  );
}

function CustomPlan({ loans }: { loans: PlanLoans }) {
  const [extra, setExtra] = useState("2000");
  const [strategy, setStrategy] = useState<Strategy>("avalanche");
  const x = Number(extra) || 0;
  const plan = payoffPlan(loans, x, strategy);
  const base = payoffPlan(loans, 0, strategy);
  const other = payoffPlan(loans, x, strategy === "avalanche" ? "snowball" : "avalanche");

  return (
    <section className="space-y-2 pt-2">
      <h2 className="text-lg font-bold">Build your own plan</h2>
      <div className="card space-y-3">
        <label className="block">
          <span className="label">Extra you can pay each month on top of minimums (KES)</span>
          <input className="input num" inputMode="numeric" value={extra} onChange={(e) => setExtra(e.target.value.replace(/[^\d]/g, ""))} />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button className={strategy === "avalanche" ? "btn" : "btn-ghost"} onClick={() => setStrategy("avalanche")}>Costliest first</button>
          <button className={strategy === "snowball" ? "btn" : "btn-ghost"} onClick={() => setStrategy("snowball")}>Smallest first</button>
        </div>
        <p className="text-xs text-muted">
          {strategy === "avalanche" ? "Pays the highest-interest loan first. Saves the most money." : "Clears the smallest balance first. Quick wins keep you motivated."}
        </p>
        {!plan.capped ? (
          <div className="grid grid-cols-2 gap-3 border-t border-line pt-3">
            <div><p className="text-xs text-muted">Debt-free by</p><p className="num text-lg font-bold">{monthsFromNow(plan.months)}</p><p className="num text-xs text-muted">{plan.months} months</p></div>
            <div><p className="text-xs text-muted">Interest you&apos;ll pay</p><p className="num text-lg font-bold">{kes(plan.totalInterest)}</p></div>
            {!other.capped && other.totalInterest !== plan.totalInterest ? (
              <p className="col-span-2 text-xs text-muted">The other order would cost {kes(other.totalInterest)} in interest over {other.months} months.</p>
            ) : null}
          </div>
        ) : null}
      </div>
      <PlanDetail plan={plan} loans={loans} vsMinimums={base} />
    </section>
  );
}

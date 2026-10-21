"use client";

import { useState } from "react";
import { Gate } from "@/components/Gate";
import { kes, monthlyObligation, payoffPlan, type Strategy } from "@/lib/finance";
import { view } from "@/lib/loanView";
import { useDb } from "@/lib/useStore";

export default function Plan() {
  return <Gate><Planner /></Gate>;
}

function Planner() {
  const { db } = useDb();
  const [extra, setExtra] = useState("2000");
  const [strategy, setStrategy] = useState<Strategy>("avalanche");
  const loans = db.loans.filter((l) => l.status !== "closed").map((l) => {
    const v = view(l);
    return { id: l.id, name: l.lender, balance: v.balance, aprPct: v.apr, minPayment: monthlyObligation(l.terms) };
  });
  const x = Number(extra) || 0;
  const base = payoffPlan(loans, 0, strategy);
  const plan = payoffPlan(loans, x, strategy);
  const other = payoffPlan(loans, x, strategy === "avalanche" ? "snowball" : "avalanche");

  if (!loans.length) return <p className="card my-2 text-sm text-muted">Add loans to build a payoff plan.</p>;

  return (
    <div className="space-y-4 py-2">
      <h1 className="text-xl font-bold">Payoff plan</h1>
      <section className="card space-y-3">
        <label className="block">
          <span className="label">Extra you can pay each month on top of minimums (KES)</span>
          <input className="input num" inputMode="numeric" value={extra} onChange={(e) => setExtra(e.target.value.replace(/[^\d]/g, ""))} />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button className={strategy === "avalanche" ? "btn" : "btn-ghost"} onClick={() => setStrategy("avalanche")}>Costliest first</button>
          <button className={strategy === "snowball" ? "btn" : "btn-ghost"} onClick={() => setStrategy("snowball")}>Smallest first</button>
        </div>
        <p className="text-xs text-muted">
          {strategy === "avalanche" ? "Pays the highest-APR loan first. Saves the most money." : "Clears the smallest balance first. Quick wins keep you motivated."}
        </p>
      </section>

      {plan.capped ? (
        <section className="card border-bad text-sm">
          <p className="font-semibold text-bad">At this pace the loans never clear.</p>
          <p className="mt-1 text-muted">Payments don&apos;t cover the interest. Pay more each month, or ask for help restructuring the costliest loan.</p>
        </section>
      ) : (
        <section className="card grid grid-cols-2 gap-3">
          <div><p className="text-xs text-muted">Debt-free in</p><p className="num text-lg font-bold">{plan.months} months</p></div>
          <div><p className="text-xs text-muted">Interest you&apos;ll pay</p><p className="num text-lg font-bold">{kes(plan.totalInterest)}</p></div>
          {!base.capped ? <p className="col-span-2 text-sm text-good">Saves {kes(base.totalInterest - plan.totalInterest)} and {base.months - plan.months} months versus minimums only.</p> : null}
          {!other.capped && other.totalInterest !== plan.totalInterest ? (
            <p className="col-span-2 text-xs text-muted">The other order would cost {kes(other.totalInterest)} in interest over {other.months} months.</p>
          ) : null}
        </section>
      )}

      <section className="card">
        <h2 className="mb-2 text-sm font-medium text-muted">Order to clear them</h2>
        <ol className="space-y-1.5 text-sm">
          {plan.payoffOrder.map((p, i) => (
            <li key={p.id} className="flex justify-between"><span>{i + 1}. {p.name}</span><span className="num text-muted">month {p.month}</span></li>
          ))}
        </ol>
      </section>
    </div>
  );
}

"use client";

import Link from "next/link";
import { use, useState } from "react";
import { Gate } from "@/components/Gate";
import { LoanForm } from "@/components/LoanForm";
import { kes, schedule } from "@/lib/finance";
import { dueDates, fmtDate, view } from "@/lib/loanView";
import { useDb } from "@/lib/useStore";

export default function LoanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <Gate><LoanDetail id={id} /></Gate>;
}

function LoanDetail({ id }: { id: string }) {
  const { db } = useDb();
  const [editing, setEditing] = useState(false);
  const loan = db.loans.find((l) => l.id === id);
  if (!loan) return <p className="py-10 text-center text-sm text-muted">Loan not found. <Link className="text-brand underline" href="/loans">Back to loans</Link></p>;
  if (editing) return <div className="space-y-3 py-2"><h1 className="text-xl font-bold">Edit {loan.lender}</h1><LoanForm loan={loan} /></div>;

  const v = view(loan);
  const rows = schedule(loan.terms);
  const dates = dueDates(loan);
  return (
    <div className="space-y-4 py-2">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold">{loan.lender}</h1>
          <p className="text-sm text-muted">{loan.productName ?? "Loan"} · received {fmtDate(new Date(loan.disbursedOn + "T00:00:00"))}</p>
        </div>
        <button className="btn-ghost" onClick={() => setEditing(true)}>Edit</button>
      </div>
      <section className="grid grid-cols-2 gap-3">
        <div className="card"><p className="text-xs text-muted">Balance</p><p className="num text-lg font-bold">{kes(v.balance)}</p></div>
        <div className="card"><p className="text-xs text-muted">True APR</p><p className={`num text-lg font-bold ${v.apr > 100 ? "text-bad" : ""}`}>{v.apr.toFixed(1)}%</p></div>
        <div className="card"><p className="text-xs text-muted">Next payment</p><p className="num font-bold">{kes(v.installment)}</p><p className="text-xs text-muted">{fmtDate(v.nextDue)}</p></div>
        <div className="card"><p className="text-xs text-muted">Days overdue</p><p className={`num text-lg font-bold ${loan.arrearsDays > 0 ? "text-warn" : ""}`}>{loan.arrearsDays}</p></div>
      </section>
      <section className="card overflow-x-auto">
        <h2 className="mb-2 text-sm font-medium text-muted">Repayment schedule (estimated)</h2>
        <table className="num w-full text-sm">
          <thead className="text-left text-xs text-muted"><tr><th className="py-1">#</th><th>Due</th><th className="text-right">Payment</th><th className="text-right">Interest</th><th className="text-right">Balance</th></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.n} className="border-t border-line">
                <td className="py-1.5">{r.n}</td><td>{fmtDate(dates.at(i) ?? null)}</td>
                <td className="text-right">{kes(r.payment)}</td><td className="text-right">{kes(r.interest)}</td><td className="text-right">{kes(r.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-muted">Interest is split at the loan&apos;s true rate. Your lender&apos;s statement may differ slightly; add the statement balance to override.</p>
      </section>
      {loan.status !== "closed" ? <Link href={`/help?loan=${loan.id}`} className="btn-ghost w-full">Get help with this loan</Link> : null}
    </div>
  );
}

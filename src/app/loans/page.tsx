"use client";

import Link from "next/link";
import { Gate } from "@/components/Gate";
import { kes } from "@/lib/finance";
import { fmtDate, view } from "@/lib/loanView";
import { LENDER_TYPES } from "@/lib/types";
import { useDb } from "@/lib/useStore";

const STATUS: Record<string, string> = { current: "Up to date", late: "Behind", defaulted: "Defaulted", closed: "Paid off" };

export default function Loans() {
  return <Gate><LoanList /></Gate>;
}

function LoanList() {
  const { db } = useDb();
  const views = db.loans.map((l) => view(l)).sort((a, b) => b.apr - a.apr);
  return (
    <div className="space-y-3 py-2">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">My loans</h1>
        <Link href="/loans/new" className="btn">Add loan</Link>
      </div>
      {views.length === 0 ? <p className="card text-sm text-muted">No loans yet.</p> : null}
      <p className="text-xs text-muted">Sorted by true cost, most expensive first.</p>
      <ul className="space-y-2">
        {views.map((v) => (
          <li key={v.loan.id}>
            <Link href={`/loans/${v.loan.id}`} className="card block">
              <div className="flex items-baseline justify-between gap-2">
                <p className="truncate font-semibold">{v.loan.lender}</p>
                <p className="num font-bold">{kes(v.balance)}</p>
              </div>
              <div className="mt-1 flex justify-between text-xs text-muted">
                <span>{LENDER_TYPES.find((t) => t.value === v.loan.lenderType)?.label} · {STATUS[v.loan.status]}{v.loan.arrearsDays ? ` · ${v.loan.arrearsDays} days overdue` : ""}</span>
                <span className={v.apr > 100 ? "font-semibold text-bad" : ""}>APR {v.apr.toFixed(0)}%</span>
              </div>
              {v.nextDue ? <p className="mt-1 text-xs text-muted">Next: {kes(v.installment)} on {fmtDate(v.nextDue)}</p> : null}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

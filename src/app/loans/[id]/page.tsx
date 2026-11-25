"use client";

import Link from "next/link";
import { use, useState } from "react";
import { Gate } from "@/components/Gate";
import { LoanForm } from "@/components/LoanForm";
import { kes, schedule } from "@/lib/finance";
import { dueDates, fmtDate, view } from "@/lib/loanView";
import { useDb } from "@/lib/useStore";
import { AlertIcon, CalendarIcon, ClockIcon, CoinsIcon, EditIcon, HelpIcon, TrendDownIcon, WalletIcon } from "@/components/Icons";
import { More, PageHeader, Stat } from "@/components/ui";

export default function LoanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <Gate><LoanDetail id={id} /></Gate>;
}

function LoanDetail({ id }: { id: string }) {
  const { db } = useDb();
  const [editing, setEditing] = useState(false);
  const loan = db.loans.find((l) => l.id === id);
  if (!loan) return <p className="py-16 text-center text-sm text-muted">Loan not found. <Link className="link" href="/loans">Back to loans</Link></p>;
  if (editing) return <div className="mx-auto max-w-3xl space-y-5 py-2"><PageHeader back={{ href: `/loans/${loan.id}`, label: loan.lender }} title={`Edit ${loan.lender}`} icon={EditIcon} /><LoanForm loan={loan} /></div>;

  const v = view(loan);
  const rows = schedule(loan.terms);
  const dates = dueDates(loan);
  return (
    <div className="space-y-5 py-2">
      <PageHeader back={{ href: "/loans", label: "My loans" }} icon={WalletIcon} title={loan.lender}
        sub={`${loan.productName ?? "Loan"} · received ${fmtDate(new Date(loan.disbursedOn + "T00:00:00"))}`}
        action={<button className="btn-ghost" aria-label="Edit" onClick={() => setEditing(true)}><EditIcon className="h-5 w-5" /><span className="hidden sm:inline">Edit</span></button>} />
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={CoinsIcon} label="Left to pay" value={kes(v.balance)} />
        <Stat icon={TrendDownIcon} label="Costs a year" value={`${v.apr.toFixed(1)}%`} tone={v.apr > 100 ? "bad" : undefined} sub="True APR" />
        <Stat icon={CalendarIcon} label="Next payment" value={kes(v.installment)} sub={fmtDate(v.nextDue)} />
        <Stat icon={loan.arrearsDays > 0 ? AlertIcon : ClockIcon} label="Days overdue" value={loan.arrearsDays} tone={loan.arrearsDays > 0 ? "warn" : "good"} />
      </section>
      <section className="card !p-0">
        <div className="flex items-center justify-between gap-3 px-4 pt-4">
          <h2 className="font-semibold">Payment schedule</h2>
          <span className="badge">Estimate</span>
        </div>
        <div className="mt-2 max-h-[28rem] overflow-auto px-1 pb-2">
          <table className="table num">
            <thead><tr><th>#</th><th>Due</th><th className="!text-right">Payment</th><th className="!text-right">Interest</th><th className="!text-right">Balance</th></tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.n}>
                  <td className="text-muted">{r.n}</td><td>{fmtDate(dates.at(i) ?? null)}</td>
                  <td className="text-right font-medium">{kes(r.payment)}</td><td className="text-right text-muted">{kes(r.interest)}</td><td className="text-right">{kes(r.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-line px-4 py-3">
          <More label="About this estimate">Interest is split at the loan&apos;s true rate. Your lender&apos;s statement may differ slightly; add the statement balance to override.</More>
        </div>
      </section>
      {loan.status !== "closed" ? <Link href={`/help?loan=${loan.id}`} className="btn-ghost w-full sm:w-auto"><HelpIcon className="h-5 w-5" />Get help with this loan</Link> : null}
    </div>
  );
}

"use client";

import Link from "next/link";
import { Gate } from "@/components/Gate";
import { kes } from "@/lib/finance";
import { fmtDate, view } from "@/lib/loanView";
import { LENDER_TYPES } from "@/lib/types";
import { useDb } from "@/lib/useStore";
import { BankIcon, CompareIcon, DocIcon, PhoneIcon, PlusIcon, WalletIcon, ChevronRight, UserIcon, CoinsIcon } from "@/components/Icons";
import { PageHeader, RowLink } from "@/components/ui";
import type { LenderType } from "@/lib/types";

const STATUS: Record<string, string> = { current: "Up to date", late: "Behind", defaulted: "Defaulted", closed: "Paid off" };

export default function Loans() {
  return <Gate><LoanList /></Gate>;
}

const TYPE_ICON: Record<LenderType, typeof BankIcon> = { bank: BankIcon, sacco: UserIcon, mfi: CoinsIcon, digital: PhoneIcon, chama: UserIcon, other: WalletIcon };
const STATUS_BADGE: Record<string, string> = { current: "badge-good", late: "badge-warn", defaulted: "badge-bad", closed: "" };

function LoanList() {
  const { db } = useDb();
  const views = db.loans.map((l) => view(l)).sort((a, b) => b.apr - a.apr);
  const owed = views.filter((v) => v.loan.status !== "closed").reduce((s, v) => s + v.balance, 0);
  return (
    <div className="space-y-5 py-2">
      <PageHeader title="My loans" sub={views.length ? <>Most expensive first · <span className="num font-semibold text-foreground">{kes(owed)}</span> owed</> : undefined}
        action={<Link href="/loans/new" className="btn"><PlusIcon className="h-5 w-5" /><span className="hidden sm:inline">Add loan</span><span className="sm:hidden">Add</span></Link>} />
      {views.length === 0 ? (
        <div className="space-y-3">
          <p className="text-[0.9375rem] text-muted">No loans yet. The quickest way to find them all:</p>
          <RowLink href="/profile#crb" icon={DocIcon} title="CRB report" sub="Finds every loan and listing" />
          <RowLink href="/profile#mpesa" icon={PhoneIcon} title="M-PESA statement" sub="Fuliza, M-Shwari and loan apps" />
        </div>
      ) : null}
      <ul className="grid gap-3 md:grid-cols-2">
        {views.map((v) => {
          const Icon = TYPE_ICON[v.loan.lenderType] ?? WalletIcon;
          const costly = v.apr > 100;
          return (
            <li key={v.loan.id}>
              <Link href={`/loans/${v.loan.id}`} className="card block h-full">
                <div className="flex items-center gap-3">
                  <span className={`tile ${v.loan.status === "closed" ? "tile-plain" : ""}`}><Icon className="h-[22px] w-[22px]" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{v.loan.lender}</p>
                    <p className="text-xs text-muted">{LENDER_TYPES.find((t) => t.value === v.loan.lenderType)?.label}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="num text-lg font-bold leading-tight">{kes(v.balance)}</p>
                    <p className="text-xs text-muted">left to pay</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <span className={`badge ${STATUS_BADGE[v.loan.status]}`}>{STATUS[v.loan.status]}{v.loan.arrearsDays ? ` · ${v.loan.arrearsDays} days overdue` : ""}</span>
                  <span className={`badge num ${costly ? "badge-bad" : ""}`}>Costs {v.apr.toFixed(0)}% a year</span>
                </div>
                {v.nextDue ? (
                  <p className="mt-3 flex items-center justify-between border-t border-line pt-3 text-sm">
                    <span className="text-muted">Next · {fmtDate(v.nextDue)}</span>
                    <span className="num flex items-center gap-1 font-semibold">{kes(v.installment)}<ChevronRight className="h-4 w-4 text-muted" /></span>
                  </p>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
      {views.length ? <RowLink href="/compare" icon={CompareIcon} tone="plain" title="Compare prices" sub="What other lenders charge for the same loan" /> : null}
    </div>
  );
}

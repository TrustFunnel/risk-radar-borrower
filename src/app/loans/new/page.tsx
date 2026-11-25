"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Gate } from "@/components/Gate";
import { LoanForm, type LoanDraft } from "@/components/LoanForm";
import { PlusIcon, SparkleIcon } from "@/components/Icons";
import { PageHeader } from "@/components/ui";
import { LENDER_TYPES, type LenderType, type LoanStatus } from "@/lib/types";

export default function NewLoan() {
  return (
    <Gate>
      <div className="mx-auto max-w-3xl space-y-5 py-2">
        <PageHeader back={{ href: "/loans", label: "My loans" }} icon={PlusIcon} title="Add a loan" />
        <Suspense fallback={null}><Form /></Suspense>
      </div>
    </Gate>
  );
}

// A loan found on the borrower's CRB report arrives with what the report
// showed; they fill in the repayment terms.
function Form() {
  const q = useSearchParams();
  const fromCrb = q.get("from") === "crb";
  const type = q.get("lenderType");
  const status = q.get("status");
  const draft: LoanDraft | undefined = fromCrb ? {
    lender: q.get("lender") ?? "",
    lenderType: LENDER_TYPES.some((t) => t.value === type) ? (type as LenderType) : "other",
    principal: q.get("principal") ?? q.get("balance") ?? "",
    outstandingBalance: q.get("balance") ?? "",
    arrearsDays: q.get("arrears") ?? "0",
    status: status === "late" || status === "defaulted" ? (status as LoanStatus) : "current",
    ...(q.get("disbursedOn") ? { disbursedOn: q.get("disbursedOn")! } : {}),
    notes: "Found on my CRB report",
  } : undefined;
  return (
    <>
      {!fromCrb ? (
        <div className="card-flat flex items-center gap-3 text-sm">
          <SparkleIcon className="h-5 w-5 shrink-0 text-brand" />
          <span>Faster: add your <Link className="link" href="/profile#crb">CRB report</Link> or <Link className="link" href="/profile#mpesa">M-PESA statement</Link>. We find your loans.</span>
        </div>
      ) : null}
      <p className="text-[0.9375rem] text-muted">
        {fromCrb ? "We filled in what your CRB report shows. Add the repayment terms from your loan agreement or the lender's SMS."
          : "Copy the figures from your loan agreement, statement or the lender's SMS."}
      </p>
      <LoanForm draft={draft} />
    </>
  );
}

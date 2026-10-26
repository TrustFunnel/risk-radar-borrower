"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Gate } from "@/components/Gate";
import { LoanForm, type LoanDraft } from "@/components/LoanForm";
import { LENDER_TYPES, type LenderType, type LoanStatus } from "@/lib/types";

export default function NewLoan() {
  return (
    <Gate>
      <div className="space-y-3 py-2">
        <h1 className="text-xl font-bold">Add a loan</h1>
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
      <p className="text-sm text-muted">
        {fromCrb ? "We filled in what your CRB report shows. Add the repayment terms from your loan agreement or the lender's SMS."
          : "Copy the figures from your loan agreement, statement or the lender's SMS."}
      </p>
      <LoanForm draft={draft} />
    </>
  );
}

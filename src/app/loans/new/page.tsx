"use client";

import { Gate } from "@/components/Gate";
import { LoanForm } from "@/components/LoanForm";

export default function NewLoan() {
  return (
    <Gate>
      <div className="space-y-3 py-2">
        <h1 className="text-xl font-bold">Add a loan</h1>
        <p className="text-sm text-muted">Copy the figures from your loan agreement, statement or the lender&apos;s SMS. Statement upload is coming next.</p>
        <LoanForm />
      </div>
    </Gate>
  );
}

"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Gate } from "@/components/Gate";
import { kes } from "@/lib/finance";
import { view } from "@/lib/loanView";
import { store } from "@/lib/store";
import type { DistressRequest } from "@/lib/types";
import { useDb } from "@/lib/useStore";

const GOALS: { value: DistressRequest["goal"]; label: string; body: string }[] = [
  { value: "restructure", label: "Lower my repayments", body: "Ask the lender for a longer term or a payment holiday." },
  { value: "settlement", label: "Settle for less", body: "Negotiate a one-off discounted payment to close the loan." },
  { value: "advice", label: "Just advise me", body: "Talk through my options, including my CRB listing." },
];

export default function Help() {
  return <Gate><Suspense><HelpInner /></Suspense></Gate>;
}

function HelpInner() {
  const { db } = useDb();
  const params = useSearchParams();
  const open = db.loans.filter((l) => l.status !== "closed");
  const [loanId, setLoanId] = useState(params.get("loan") ?? open.find((l) => l.arrearsDays > 0)?.id ?? open[0]?.id ?? "");
  const [goal, setGoal] = useState<DistressRequest["goal"]>("restructure");
  const [message, setMessage] = useState("");
  const [share, setShare] = useState(false);
  const [sent, setSent] = useState(false);

  function submit() {
    store.setConsent("share_partner", true);
    store.addRequest({ loanId, goal, message });
    setSent(true);
  }

  const loan = open.find((l) => l.id === loanId);
  return (
    <div className="space-y-4 py-2">
      <h1 className="text-xl font-bold">Get help with a loan</h1>
      <p className="text-sm text-muted">
        A loan belongs to your lender, so it can&apos;t be sold by you. What we can do is put you in touch with a vetted partner who
        negotiates with the lender for you: a lower repayment, a discounted settlement, or a plan to clear arrears before the account goes to debt collectors.
      </p>

      {sent ? (
        <section className="card border-good">
          <p className="font-semibold text-good">Request sent</p>
          <p className="mt-1 text-sm text-muted">During the pilot, the Risk Radar team reviews every request and calls you on your registered number before anything is shared with a partner.</p>
        </section>
      ) : open.length === 0 ? (
        <p className="card text-sm text-muted">You have no open loans.</p>
      ) : (
        <section className="card space-y-3">
          <label className="block"><span className="label">Which loan?</span>
            <select className="input" value={loanId} onChange={(e) => setLoanId(e.target.value)}>
              {open.map((l) => <option key={l.id} value={l.id}>{l.lender} · {kes(view(l).balance)}{l.arrearsDays ? ` · ${l.arrearsDays} days overdue` : ""}</option>)}
            </select>
          </label>
          <div className="space-y-2">
            <span className="label">What would help most?</span>
            {GOALS.map((g) => (
              <label key={g.value} className={`flex gap-3 rounded-xl border p-3 ${goal === g.value ? "border-brand bg-brand-soft" : "border-line"}`}>
                <input type="radio" name="goal" className="mt-1" checked={goal === g.value} onChange={() => setGoal(g.value)} />
                <span><span className="block text-sm font-medium">{g.label}</span><span className="block text-xs text-muted">{g.body}</span></span>
              </label>
            ))}
          </div>
          <label className="block"><span className="label">Anything we should know? (optional)</span>
            <textarea className="input min-h-20" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="e.g. I lost my job in August and can pay KES 3,000 a month" />
          </label>
          <label className="flex gap-3 rounded-xl border border-line p-3 text-sm">
            <input type="checkbox" className="mt-1" checked={share} onChange={(e) => setShare(e.target.checked)} />
            <span>I agree to share <b>this loan&apos;s details</b>{loan ? ` (${loan.lender})` : ""}, my name and phone number with a Risk Radar resolution partner for this request only. My other loans stay private.</span>
          </label>
          <button className="btn w-full" disabled={!loanId || !share} onClick={submit}>Ask for help</button>
        </section>
      )}
    </div>
  );
}

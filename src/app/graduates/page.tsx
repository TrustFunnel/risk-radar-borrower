"use client";

import Link from "next/link";
import { Gate } from "@/components/Gate";
import { progress } from "@/lib/myPlan";
import { graduateEligible } from "@/lib/oneplan";
import { store } from "@/lib/store";
import { CONSENT_TEXT } from "@/lib/types";
import { useDb } from "@/lib/useStore";
import { CheckCircle, CheckIcon, ClockIcon, GradIcon, PlanIcon, TrashIcon } from "@/components/Icons";
import { PageHeader } from "@/components/ui";

export default function GraduatesPage() {
  return <Gate><Graduates /></Gate>;
}

// Afueni Graduates: DESIGN STUB. Shows eligibility and lets a borrower opt in
// or leave. Referrals, the bank request inbox and the Risk Radar EWS bank
// portal are not built yet (process map v1.1, page 8). Pending counsel's view
// on whether referrals need a licence or CBK approval.
function Graduates() {
  const { db } = useDb();
  const plans = db.plans.filter((p) => p.status !== "draft");
  const completed = plans.some((p) => p.status === "completed");
  const best = Math.max(0, ...plans.map((p) => progress(p).monthsOnTime));
  const eligible = graduateEligible({ completed, monthsOnTime: best });
  const inPool = store.hasConsent("graduates", db);

  return (
    <div className="mx-auto max-w-3xl space-y-5 py-2">
      <PageHeader icon={GradIcon} title="Afueni Graduates" sub="Finished your plan? Show partner banks you pay, and borrow fairly again." />
      <section className="card space-y-3 text-sm">
        <p className="font-semibold">How it works</p>
        <ul className="space-y-2.5 text-foreground/80">
          {["You choose to join. Nothing is shared until you ask for a referral or approve a bank's request.",
            "You approve each bank separately, and see what is shared before you agree.",
            "The bank decides on the loan and checks you can afford it.",
            "The bank pays Afueni a referral fee only if it approves a loan. It is the same for every bank and never depends on the loan size. You never pay.",
            "Leave at any time, and your Graduate profile is deleted."].map((t) => <li key={t} className="flex gap-2.5"><CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-good" />{t}</li>)}
        </ul>
        <p className="text-xs text-muted">For people who finished their plan, or paid on time for 12 months.</p>
      </section>

      {!eligible ? (
        <section className="card text-sm">
          <p className="flex items-center gap-2 text-lg font-bold"><ClockIcon className="h-5 w-5 text-warn" />Not yet</p>
          <p className="mt-1 text-muted">You can join once you finish your One Plan, or after 12 months of on-time plan payments{best ? ` (you have ${best})` : ""}.</p>
          <Link href="/plan" className="btn-ghost mt-4"><PlanIcon className="h-5 w-5" />My plan</Link>
        </section>
      ) : inPool ? (
        <section className="card space-y-3 !border-good/40 !bg-good-soft text-sm">
          <p className="flex items-center gap-2 text-lg font-bold text-good"><CheckCircle className="h-6 w-6" />You are an Afueni Graduate</p>
          <p className="text-muted">Asking for a referral and seeing bank requests are coming soon. We&apos;ll message you when they open.</p>
          <button className="btn-danger" onClick={() => store.setConsent("graduates", false)}><TrashIcon className="h-5 w-5" />Leave and delete my Graduate profile</button>
        </section>
      ) : (
        <section className="card space-y-3 text-sm">
          <p className="text-muted">{CONSENT_TEXT.graduates.body}</p>
          <button className="btn w-full" onClick={() => store.setConsent("graduates", true)}><GradIcon className="h-5 w-5" />Join Afueni Graduates</button>
        </section>
      )}
      <p className="text-center text-xs text-muted"><span className="badge mr-1">Preview</span>Referrals to banks are not live yet.</p>
    </div>
  );
}

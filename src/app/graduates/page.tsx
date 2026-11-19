"use client";

import Link from "next/link";
import { Gate } from "@/components/Gate";
import { progress } from "@/lib/myPlan";
import { graduateEligible } from "@/lib/oneplan";
import { store } from "@/lib/store";
import { CONSENT_TEXT } from "@/lib/types";
import { useDb } from "@/lib/useStore";

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
    <div className="space-y-4 py-2">
      <h1 className="text-xl font-bold">Afueni Graduates</h1>
      <p className="text-sm text-muted">For people who finished their plan, or paid on time for 12 months. If you choose, partner banks can see that you pay, so you can borrow fairly again.</p>
      <section className="card space-y-1 text-sm">
        <p className="font-semibold">How it works</p>
        <ul className="space-y-1 text-muted">
          <li>• You choose to join. Nothing is shared until you ask for a referral or approve a bank&apos;s request.</li>
          <li>• You approve each bank separately, and see what is shared before you agree.</li>
          <li>• The bank decides on the loan and checks you can afford it.</li>
          <li>• The bank pays Afueni a referral fee only if it approves a loan. It is the same for every bank and never depends on the loan size. You never pay.</li>
          <li>• Leave at any time, and your Graduate profile is deleted.</li>
        </ul>
      </section>

      {!eligible ? (
        <section className="card text-sm">
          <p className="font-semibold">Not yet</p>
          <p className="mt-1 text-muted">You can join once you finish your One Plan, or after 12 months of on-time plan payments{best ? ` (you have ${best})` : ""}.</p>
          <Link href="/plan" className="btn-ghost mt-3">My plan</Link>
        </section>
      ) : inPool ? (
        <section className="card space-y-2 border-good text-sm">
          <p className="font-semibold text-good">You are an Afueni Graduate</p>
          <p className="text-muted">Asking for a referral and seeing bank requests are coming soon. We&apos;ll message you when they open.</p>
          <button className="btn-ghost" onClick={() => store.setConsent("graduates", false)}>Leave and delete my Graduate profile</button>
        </section>
      ) : (
        <section className="card space-y-3 text-sm">
          <p className="text-muted">{CONSENT_TEXT.graduates.body}</p>
          <button className="btn w-full" onClick={() => store.setConsent("graduates", true)}>Join Afueni Graduates</button>
        </section>
      )}
      <p className="text-center text-xs text-muted">Preview: referrals to banks are not live yet.</p>
    </div>
  );
}

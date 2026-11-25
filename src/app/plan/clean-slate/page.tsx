"use client";

import Link from "next/link";
import { useState } from "react";
import { BrandText } from "@/components/BrandText";
import { Gate } from "@/components/Gate";
import { kes } from "@/lib/finance";
import { latestCrb } from "@/lib/myPlan";
import { checkListings, listingKey } from "@/lib/oneplan";
import { store } from "@/lib/store";
import { CONSENT_TEXT } from "@/lib/types";
import { useDb } from "@/lib/useStore";
import { AlertIcon, CheckCircle, DocIcon, InfoIcon, SparkleIcon, UploadIcon } from "@/components/Icons";
import { More, PageHeader } from "@/components/ui";

export default function CleanSlatePage() {
  return <Gate><CleanSlate /></Gate>;
}

// Afueni Clean Slate: explain every listing, check it against the CRB
// Regulations, dispute the ones that fail, and clear small debts first
// (strategy doc, process J). Unresolved disputes go to Tatua Center.
function CleanSlate() {
  const { db } = useDb();
  const report = latestCrb(db);
  const [noNotice, setNoNotice] = useState<Set<string>>(new Set());
  const [authority, setAuthority] = useState(store.hasConsent("act_for_me", db));
  const [sent, setSent] = useState<Set<string>>(new Set());
  const checks = checkListings(report, noNotice);
  const plan = store.livePlan(db);
  const anyLoan = plan?.lenders[0]?.loanId ?? db.loans[0]?.id;

  function dispute(key: string, msg: string) {
    store.setConsent("act_for_me", true);
    if (anyLoan) store.addRequest({ loanId: anyLoan, goal: "clean_slate", message: msg });
    setSent(new Set(sent).add(key));
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 py-2">
      <PageHeader back={{ href: "/plan", label: "My plan" }} icon={SparkleIcon} title="Afueni Clean Slate" sub="We check every CRB listing and fix the wrong ones." />
      <More label="How it works">We explain every listing on your CRB report in plain words, check it against the CRB rules, and ask the bureau to fix the ones that break them. Once a debt is cleared we get your clearance certificate (the first one is free).</More>

      {!report ? (
        <section className="card">
          <p className="flex items-center gap-2 text-lg font-bold"><DocIcon className="h-5 w-5 text-brand" />Add your CRB report first</p>
          <p className="mt-1 text-sm text-muted">You can get one free report a year from Metropol, TransUnion and Creditinfo.</p>
          <Link href="/profile#crb" className="btn mt-4"><UploadIcon className="h-5 w-5" />Add my CRB report</Link>
        </section>
      ) : !checks.length ? (
        <section className="card !border-good/40 !bg-good-soft"><p className="flex items-center gap-2 text-lg font-bold text-good"><CheckCircle className="h-6 w-6" />No negative listings on your {report.bureau} report</p><p className="mt-1 text-sm text-muted">Check the other two bureaus too: each can hold different records.</p></section>
      ) : (
        <>
          {checks.map((c) => {
            const key = listingKey(c.account);
            return (
              <section key={key} className="card space-y-3">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-semibold">{c.account.lender}</p>
                  <p className="num text-lg font-bold">{kes(c.account.balance)}</p>
                </div>
                <p className="text-sm text-muted">{c.account.lender} listed your {c.account.accountType} with {report.bureau} as negative{c.account.openedOn ? `, on a loan opened ${c.account.openedOn}` : ""}{c.account.arrearsDays ? `, ${c.account.arrearsDays} days late` : ""}.</p>
                <label className="choice items-center text-sm">
                  <input type="checkbox" checked={noNotice.has(key)} onChange={(e) => { const n = new Set(noNotice); if (e.target.checked) n.add(key); else n.delete(key); setNoNotice(n); }} />
                  I did not get a 30-day written notice before this listing
                </label>
                {c.problems.length ? (
                  <div className="rounded-2xl bg-bad-soft p-3.5 text-sm">
                    <p className="flex items-center gap-2 font-semibold text-bad"><AlertIcon className="h-5 w-5" />This listing may break the rules</p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-foreground/80">{c.problems.map((p) => <li key={p}>{p}</li>)}</ul>
                    {sent.has(key) ? <p className="mt-3 flex items-start gap-1.5 font-medium text-good"><CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />Dispute requested. We file it with {report.bureau} and keep you updated until they reply.</p> : (
                      <button className="btn mt-3 w-full sm:w-auto" disabled={!authority} onClick={() => dispute(key, `Dispute ${report.bureau} listing by ${c.account.lender} (${kes(c.account.balance)}): ${c.problems.join(" ")}`)}>Dispute this listing</button>
                    )}
                  </div>
                ) : (
                  <p className="flex gap-2 text-sm text-muted"><InfoIcon className="mt-0.5 h-4 w-4 shrink-0" />{c.smallDebt ? "This is a small debt. Put it first in your plan (choose \"Small debts first\") and it can clear within weeks. We then ask for the clearance certificate." : "This listing looks correct. It clears when the debt is paid through your plan, and we then ask for the clearance certificate."}</p>
                )}
              </section>
            );
          })}
          <label className="choice">
            <input type="checkbox" className="mt-0.5" checked={authority} onChange={(e) => setAuthority(e.target.checked)} />
            <span><span className="block text-sm font-medium">{CONSENT_TEXT.act_for_me.title}</span><span className="block text-xs text-muted">Needed for us to file disputes for you. <BrandText>{CONSENT_TEXT.act_for_me.body}</BrandText></span></span>
          </label>
          <p className="text-xs text-muted">If a bureau or lender does not fix a wrong listing, we refer it to Tatua Center, the independent credit-dispute centre at the Kenya School of Monetary Studies. It is free for you.</p>
        </>
      )}
    </div>
  );
}

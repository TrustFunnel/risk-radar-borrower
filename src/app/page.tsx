"use client";

import Link from "next/link";
import { Gate } from "@/components/Gate";
import { HealthCard } from "@/components/HealthCard";
import { healthScore, kes, monthlyObligation } from "@/lib/finance";
import { daysUntil, fmtDate, view } from "@/lib/loanView";
import { store } from "@/lib/store";
import { useDb } from "@/lib/useStore";

export default function Home() {
  return <Gate><Dashboard /></Gate>;
}

function Dashboard() {
  const { db } = useDb();
  const active = db.loans.filter((l) => l.status !== "closed");
  const views = active.map((l) => view(l));
  const owed = views.reduce((s, v) => s + v.balance, 0);
  const monthly = active.reduce((s, l) => s + monthlyObligation(l.terms), 0);
  const analyse = store.hasConsent("analyse", db);
  const h = healthScore({
    monthlyIncome: db.profile?.monthlyIncome ?? 0,
    loans: db.loans.map((l) => ({ terms: l.terms, arrearsDays: l.arrearsDays, lenderType: l.lenderType, closed: l.status === "closed" })),
  });
  const upcoming = views.filter((v) => v.nextDue).sort((a, b) => a.nextDue!.getTime() - b.nextDue!.getTime()).slice(0, 4);

  return (
    <div className="space-y-4 py-2">
      <h1 className="text-xl font-bold">Hi {db.profile?.displayName}</h1>

      {!db.profile?.work || !db.documents.length ? (
        <Link href="/profile" className="card block border-brand">
          <p className="font-semibold">Complete your details</p>
          <p className="mt-1 text-sm text-muted">Add your work, CRB report and M-PESA or bank statements so we can spot trouble early and check your loans are listed correctly.</p>
        </Link>
      ) : null}

      {active.length === 0 ? (
        <section className="card text-center">
          <p className="font-semibold">Add your first loan</p>
          <p className="mt-1 text-sm text-muted">Bank, SACCO, microfinance, Fuliza, M-Shwari, Tala, Branch, chama: add them all to see the full picture.</p>
          <Link href="/loans/new" className="btn mt-3">Add a loan</Link>
        </section>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3">
            <div className="card"><p className="text-xs text-muted">Total owed</p><p className="num text-lg font-bold">{kes(owed)}</p></div>
            <div className="card"><p className="text-xs text-muted">Repayments per month</p><p className="num text-lg font-bold">{kes(monthly)}</p></div>
          </section>

          {analyse ? <HealthCard h={h} /> : (
            <section className="card text-sm text-muted">Turn on “Analyse my loans” in <Link className="text-brand underline" href="/account">Account</Link> to see your loan health score.</section>
          )}

          <section className="card">
            <h2 className="mb-2 text-sm font-medium text-muted">Next payments</h2>
            <ul className="divide-y divide-line">
              {upcoming.map((v) => {
                const d = daysUntil(v.nextDue!);
                return (
                  <li key={v.loan.id} className="flex items-center justify-between py-2.5">
                    <Link href={`/loans/${v.loan.id}`} className="min-w-0">
                      <p className="truncate font-medium">{v.loan.lender}</p>
                      <p className="text-xs text-muted">
                        {v.loan.arrearsDays > 0 ? <span className="font-semibold text-bad">{v.loan.arrearsDays} days overdue · </span> : null}
                        {fmtDate(v.nextDue)} · {d <= 0 ? "due today" : `in ${d} day${d === 1 ? "" : "s"}`}
                      </p>
                    </Link>
                    <span className={`num font-semibold ${d <= 3 ? "text-warn" : ""}`}>{kes(v.installment)}</span>
                  </li>
                );
              })}
            </ul>
          </section>

          {analyse && h.band !== "Healthy" ? (
            <section className="card border-warn">
              <p className="font-semibold">Struggling with a loan?</p>
              <p className="mt-1 text-sm text-muted">Get matched with a partner who can help you restructure or settle it, before it hurts your CRB record further.</p>
              <Link href="/help" className="btn-ghost mt-3">Get help</Link>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}

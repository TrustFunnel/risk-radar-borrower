"use client";

import Link from "next/link";
import { Gate } from "@/components/Gate";
import { HelpIcon, PlanIcon, PlusIcon, WalletIcon } from "@/components/Icons";
import { StatusCard } from "@/components/StatusCard";
import { kes } from "@/lib/finance";
import { daysUntil, fmtDate, view } from "@/lib/loanView";
import { draftFor, loanViews, money, progress, status } from "@/lib/myPlan";
import { defaultStart, fmtMonth, freedomDate } from "@/lib/oneplan";
import { store } from "@/lib/store";
import { useDb } from "@/lib/useStore";

const ACTIONS = [
  { href: "/plan", label: "My plan", Icon: PlanIcon },
  { href: "/loans", label: "Loans", Icon: WalletIcon },
  { href: "/loans/new", label: "Add loan", Icon: PlusIcon },
  { href: "/help", label: "Get help", Icon: HelpIcon },
];

export default function Home() {
  return <Gate><Dashboard /></Gate>;
}

function Dashboard() {
  const { db } = useDb();
  const active = db.loans.filter((l) => l.status !== "closed");
  const views = active.map((l) => view(l));
  const owed = views.reduce((s, v) => s + v.balance, 0);
  const upcoming = views.filter((v) => v.nextDue).sort((a, b) => a.nextDue!.getTime() - b.nextDue!.getTime()).slice(0, 4);
  const plan = store.livePlan(db);

  return (
    <div className="space-y-4 py-2">
      <h1 className="text-lg font-semibold">Hi {db.profile?.displayName}</h1>

      {active.length === 0 && !plan ? <FindLoans /> : <WayOut />}

      {active.length ? (
        <>
          <nav className="grid grid-cols-4 gap-2 text-center text-xs font-medium" aria-label="Quick actions">
            {ACTIONS.map(({ href, label, Icon }) => (
              <Link key={href} href={href} className="flex flex-col items-center gap-1.5 rounded-xl py-2 hover:bg-card">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-raised text-brand"><Icon /></span>
                {label}
              </Link>
            ))}
          </nav>

          <StatusCard s={status(db)} owed={owed} loans={active.length} />

          {!plan ? (
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
          ) : null}
        </>
      ) : null}

      {!db.profile?.work || !db.documents.length ? (
        <Link href="/profile" className="card block">
          <p className="font-semibold">Complete your details</p>
          <p className="mt-1 text-sm text-muted">Add your CRB report and M-PESA or bank statements. We find loans you may have forgotten and check every listing is correct.</p>
        </Link>
      ) : null}

      {!store.hasConsent("sms_read", db) ? (
        <Link href="/money" className="card block">
          <p className="font-semibold">Read my money messages</p>
          <p className="mt-1 text-sm text-muted">Let Afueni read your M-PESA, bank and lender SMS as they arrive, so your plan stays up to date without a monthly statement.</p>
        </Link>
      ) : (
        <Link href="/money" className="card flex items-center justify-between text-sm">
          <span><span className="block font-medium">Money messages</span><span className="text-xs text-muted">{db.money.length} transactions captured</span></span>
          <span className="text-brand">Open</span>
        </Link>
      )}
    </div>
  );
}

// The first thing a borrower sees: the day they will be debt free, and the
// way to get there. Strategy doc section 7: "Lead with the Freedom Date and
// 'Your way out', not a list of loans and a score."
function WayOut() {
  const { db } = useDb();
  const plan = store.livePlan(db);

  if (plan && plan.status !== "draft") {
    const p = progress(plan);
    return (
      <Link href="/plan" className="card block border-brand">
        <p className="text-sm text-muted">{plan.status === "completed" ? "You did it" : plan.status === "paused" ? "Your plan is paused" : "Your Freedom Date"}</p>
        <p className="num mt-1 text-4xl font-bold tracking-tight text-brand">{plan.status === "completed" ? "Debt free" : fmtMonth(p.freedom)}</p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-line" aria-hidden><div className="h-full rounded-full bg-brand" style={{ width: `${p.pct}%` }} /></div>
        <p className="num mt-2 text-sm text-muted">{kes(p.repaid)} of {kes(p.owed)} repaid · plan {plan.ref}</p>
        {plan.status === "active" ? (
          <p className="num mt-2 text-sm">Next: <b>{kes(plan.amount)}</b> {p.daysToNext <= 0 ? "due today" : `in ${p.daysToNext} day${p.daysToNext === 1 ? "" : "s"}`}</p>
        ) : null}
      </Link>
    );
  }

  const m = money(db);
  const views = loanViews(db);
  const owed = views.reduce((s, v) => s + v.balance, 0);
  const draft = m.safe ? draftFor(db, m.safe, "monthly", "fair") : null;
  return (
    <section className="card border-brand">
      <p className="text-sm text-muted">Your way out</p>
      {draft?.feasible ? (
        <>
          <p className="mt-1 text-sm">With one payment of <b className="num">{kes(m.safe!)}</b> a month across all your lenders, you could be debt free by</p>
          <p className="num mt-1 text-4xl font-bold tracking-tight text-brand">{fmtMonth(freedomDate(defaultStart(), "monthly", draft.totalPayments))}</p>
          <Link href="/plan" className="btn mt-3">{plan ? "Finish my One Plan" : "Build my One Plan"}</Link>
        </>
      ) : m.safe === 0 ? (
        <>
          <p className="mt-1 text-sm">Right now there is nothing left after your essentials to pay your loans of <b className="num">{kes(owed)}</b>. That is not your fault, and a plan that fails won&apos;t help.</p>
          <Link href="/plan/pause" className="btn mt-3">Ask for breathing space</Link>
        </>
      ) : (
        <>
          <p className="mt-1 text-sm">You owe <b className="num">{kes(owed)}</b>. Tell us what comes in and what you must spend, and we&apos;ll show the day you can be debt free with one payment you can afford.</p>
          <Link href="/plan" className="btn mt-3">See my Freedom Date</Link>
        </>
      )}
    </section>
  );
}

// No loans yet: fill the list from documents first, typing is the fallback.
function FindLoans() {
  return (
    <section className="card space-y-3 border-brand">
      <div>
        <p className="font-semibold">Let&apos;s find all your loans</p>
        <p className="mt-1 text-sm text-muted">Send us your documents and we build the list for you. You only confirm each loan.</p>
      </div>
      <Link href="/profile#crb" className="flex items-center justify-between rounded-xl border border-line p-3 text-sm"><span><b>CRB report</b><span className="block text-xs text-muted">Finds every loan and listing, even ones you forgot</span></span><span className="text-brand">Add</span></Link>
      <Link href="/profile#mpesa" className="flex items-center justify-between rounded-xl border border-line p-3 text-sm"><span><b>M-PESA statement</b><span className="block text-xs text-muted">Shows Fuliza, M-Shwari and loan apps, and your income</span></span><span className="text-brand">Add</span></Link>
      <Link href="/money" className="flex items-center justify-between rounded-xl border border-line p-3 text-sm"><span><b>Loan SMS</b><span className="block text-xs text-muted">Balances and due dates from your lenders&apos; messages</span></span><span className="text-brand">Add</span></Link>
      <Link href="/loans/new" className="block text-center text-xs text-muted underline">Or type a loan in yourself</Link>
    </section>
  );
}

"use client";

import Link from "next/link";
import { Gate } from "@/components/Gate";
import { ArrowRight, CalendarIcon, DocIcon, HeartIcon, HelpIcon, MessageIcon, PauseIcon, PhoneIcon, PlanIcon, PlusIcon, WalletIcon } from "@/components/Icons";
import { IconTile, Meter, RowLink } from "@/components/ui";
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
    <div className="space-y-5 py-2">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h1 className="text-[1.75rem] font-bold leading-tight md:text-3xl">Hi {db.profile?.displayName}</h1>
        <p className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand lg:hidden">
          <HeartIcon className="h-3.5 w-3.5" />We care. We&apos;re on your side.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:items-start">
        <div className="space-y-5">
          {active.length === 0 && !plan ? <FindLoans /> : <WayOut />}

          {active.length && !plan ? (
            <section className="card">
              <h2 className="mb-1 flex items-center gap-2 font-semibold"><CalendarIcon className="h-5 w-5 text-brand" />Next payments</h2>
              <ul className="divide-y divide-line">
                {upcoming.map((v) => {
                  const d = daysUntil(v.nextDue!);
                  return (
                    <li key={v.loan.id}>
                      <Link href={`/loans/${v.loan.id}`} className="-mx-2 flex items-center justify-between gap-3 rounded-xl px-2 py-3 hover:bg-raised">
                        <span className="min-w-0">
                          <span className="block truncate font-semibold">{v.loan.lender}</span>
                          <span className="block text-xs text-muted">
                            {v.loan.arrearsDays > 0 ? <span className="font-semibold text-bad">{v.loan.arrearsDays} days overdue · </span> : null}
                            {fmtDate(v.nextDue)} · {d <= 0 ? "due today" : `in ${d} day${d === 1 ? "" : "s"}`}
                          </span>
                        </span>
                        <span className={`num shrink-0 font-bold ${d <= 3 ? "text-warn" : ""}`}>{kes(v.installment)}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}
        </div>

        <div className="space-y-5">
          {active.length ? (
            <>
              <nav className="grid grid-cols-4 gap-2" aria-label="Quick actions">
                {ACTIONS.map(({ href, label, Icon }) => (
                  <Link key={href} href={href} className="group flex flex-col items-center gap-2 rounded-2xl py-2 text-center text-xs font-semibold">
                    <span className="flex h-14 w-14 items-center justify-center rounded-[1.1rem] border border-line bg-card text-brand shadow-[var(--shadow-card)] transition-transform group-hover:-translate-y-0.5 group-active:scale-95">
                      <Icon className="h-6 w-6" />
                    </span>
                    {label}
                  </Link>
                ))}
              </nav>
              <StatusCard s={status(db)} owed={owed} loans={active.length} />
            </>
          ) : null}

          <div className="space-y-3">
            {!db.profile?.work || !db.documents.length ? (
              <RowLink href="/profile" icon={DocIcon} title="Complete your details" sub="CRB report and statements find forgotten loans" />
            ) : null}
            {!store.hasConsent("sms_read", db) ? (
              <RowLink href="/money" icon={MessageIcon} title="Read my money messages" sub="Your plan stays up to date by itself" />
            ) : (
              <RowLink href="/money" icon={MessageIcon} tone="plain" title="Money messages" sub={`${db.money.length} transactions captured`} />
            )}
          </div>
        </div>
      </div>
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
      <Link href="/plan" className="hero block transition-transform hover:-translate-y-0.5">
        <div className="flex items-center justify-between gap-2">
          <p className="hero-muted text-sm font-medium">{plan.status === "completed" ? "You did it" : plan.status === "paused" ? "Your plan is paused" : "Your Freedom Date"}</p>
          <span className="hero-chip num whitespace-nowrap">{plan.ref}</span>
        </div>
        <p className="num hero-gold mt-2 text-[2.6rem] font-bold leading-none tracking-tight md:text-5xl">{plan.status === "completed" ? "Debt free" : fmtMonth(p.freedom)}</p>
        <div className="mt-5"><Meter pct={p.pct} label="Repaid so far" /></div>
        <p className="num hero-muted mt-2 text-sm">{kes(p.repaid)} of {kes(p.owed)} repaid</p>
        {plan.status === "active" ? (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-white/[0.07] px-4 py-3 ring-1 ring-white/10">
            <span className="hero-muted text-sm">Next payment</span>
            <span className="num text-right font-bold">{kes(plan.amount)} <span className="hero-muted text-sm font-medium">· {p.daysToNext <= 0 ? "due today" : `in ${p.daysToNext} day${p.daysToNext === 1 ? "" : "s"}`}</span></span>
          </div>
        ) : null}
      </Link>
    );
  }

  const m = money(db);
  const views = loanViews(db);
  const owed = views.reduce((s, v) => s + v.balance, 0);
  const draft = m.safe ? draftFor(db, m.safe, "monthly", "fair") : null;
  return (
    <section className="hero">
      <p className="hero-muted text-sm font-medium">Your way out</p>
      {draft?.feasible ? (
        <>
          <p className="hero-muted mt-3 text-sm">Debt free by</p>
          <p className="num hero-gold text-[2.6rem] font-bold leading-none tracking-tight md:text-5xl">{fmtMonth(freedomDate(defaultStart(), "monthly", draft.totalPayments))}</p>
          <p className="mt-3 text-[0.9375rem]">One payment of <b className="num">{kes(m.safe!)}</b> a month, shared across all your lenders.</p>
          <Link href="/plan" className="btn mt-5 w-full sm:w-auto">{plan ? "Finish my One Plan" : "Build my One Plan"}<ArrowRight className="h-5 w-5" /></Link>
        </>
      ) : m.safe === 0 ? (
        <>
          <p className="num mt-2 text-3xl font-bold tracking-tight">{kes(owed)}</p>
          <p className="mt-2 text-[0.9375rem]">Right now nothing is left after essentials to pay your loans. That is not your fault, and a plan that fails won&apos;t help.</p>
          <Link href="/plan/pause" className="btn mt-5 w-full sm:w-auto"><PauseIcon className="h-5 w-5" />Ask for breathing space</Link>
        </>
      ) : (
        <>
          <p className="hero-muted mt-3 text-sm">You owe</p>
          <p className="num hero-gold text-[2.6rem] font-bold leading-none tracking-tight md:text-5xl">{kes(owed)}</p>
          <p className="mt-3 text-[0.9375rem]">Tell us what comes in and what you must spend. We show the day you can be debt free.</p>
          <Link href="/plan" className="btn mt-5 w-full sm:w-auto">See my Freedom Date<ArrowRight className="h-5 w-5" /></Link>
        </>
      )}
    </section>
  );
}

// No loans yet: fill the list from documents first, typing is the fallback.
function FindLoans() {
  return (
    <section className="space-y-3">
      <div className="hero">
        <IconTile icon={WalletIcon} />
        <p className="mt-4 text-2xl font-bold tracking-tight">Let&apos;s find all your loans</p>
        <p className="hero-muted mt-1 text-[0.9375rem]">Send a document. We build the list. You only confirm.</p>
      </div>
      <RowLink href="/profile#crb" icon={DocIcon} title="CRB report" sub="Finds every loan, even forgotten ones" />
      <RowLink href="/profile#mpesa" icon={PhoneIcon} title="M-PESA statement" sub="Fuliza, M-Shwari, loan apps and income" />
      <RowLink href="/money" icon={MessageIcon} title="Loan SMS" sub="Balances and due dates from lender messages" />
      <Link href="/loans/new" className="btn-ghost w-full"><PlusIcon className="h-5 w-5" />Type a loan in myself</Link>
    </section>
  );
}

"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Gate } from "@/components/Gate";
import { BrandText } from "@/components/BrandText";
import { WhatsAppLink } from "@/components/WhatsAppLink";
import products from "@/data/lender-products.json";
import { kes, monthlyObligation } from "@/lib/finance";
import { latestCrb } from "@/lib/myPlan";
import { canRefinance } from "@/lib/oneplan";
import { view } from "@/lib/loanView";
import { DEFAULT_FEE_PCT, kindOf, type LenderProduct } from "@/lib/market";
import { MIN_REFINANCE_BALANCE, MIN_REFINANCE_MONTHS, refinanceOffers } from "@/lib/remediation";
import { store } from "@/lib/store";
import type { DistressRequest, Loan } from "@/lib/types";
import { useDb } from "@/lib/useStore";

// Refinance offers are priced as bank personal loans.
const personalProducts = (products as LenderProduct[]).filter((p) => kindOf(p) === "personal");

type Tab = "plan" | "refinance" | "talk";

export default function Help() {
  return <Gate><Suspense><HelpInner /></Suspense></Gate>;
}

function HelpInner() {
  const params = useSearchParams();
  const [tab, setTab] = useState<Tab>((params.get("tab") as Tab) ?? "plan");
  const [sent, setSent] = useState<string | null>(null);
  return (
    <div className="space-y-4 py-2">
      <h1 className="text-xl font-bold">Get help with your loans</h1>
      <WhatsAppLink />
      <div className="grid grid-cols-3 gap-1 rounded-xl border border-line bg-card p-1 text-sm">
        {([["plan", "One Plan"], ["refinance", "Cheaper lender"], ["talk", "Talk to us"]] as const).map(([k, label]) => (
          <button key={k} onClick={() => { setTab(k); setSent(null); }} className={`rounded-lg py-2 font-medium ${tab === k ? "bg-brand text-[#181a20]" : "text-muted"}`}>{label}</button>
        ))}
      </div>
      {sent ? (
        <section className="card border-good">
          <p className="font-semibold text-good">Request sent</p>
          <p className="mt-1 text-sm text-muted"><BrandText>{sent}</BrandText></p>
        </section>
      ) : tab === "plan" ? <OnePlanTab /> : tab === "refinance" ? <RefinanceTab onSent={setSent} preselect={params.get("loan")} /> : <TalkTab onSent={setSent} preselect={params.get("loan")} />}
    </div>
  );
}

const PILOT_NOTE = "During the pilot, the Afueni by Risk Radar team reviews every request and calls you on your registered number before anything is shared with a lender or partner.";

function ShareConsent({ checked, onChange, who }: { checked: boolean; onChange: (v: boolean) => void; who: string }) {
  return (
    <label className="flex gap-3 rounded-xl border border-line p-3 text-sm">
      <input type="checkbox" className="mt-1" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span><BrandText>{`I agree to share the details of the loans named here, my name and phone number with ${who} for this request only. My other loans stay private.`}</BrandText></span>
    </label>
  );
}

// ---------- 1. One Plan, Pause and Clean Slate ----------

function OnePlanTab() {
  const { db } = useDb();
  const plan = store.livePlan(db);
  return (
    <div className="space-y-2">
      <Link href="/plan" className="card block border-brand">
        <p className="font-semibold">Afueni One Plan</p>
        <p className="mt-1 text-sm text-muted">{plan && plan.status !== "draft" ? `You are on plan ${plan.ref}. See your Freedom Date and next payment.` : "One payment you can afford, shared across all your lenders. We ask them to freeze penalties and stop the calls, and you see the day you'll be debt free. It costs you nothing."}</p>
      </Link>
      <Link href="/plan/pause" className="card block"><p className="font-semibold">Afueni Pause</p><p className="mt-1 text-sm text-muted">Up to 30 days&apos; breathing space after illness, a death, job loss or another shock.</p></Link>
      <Link href="/plan/clean-slate" className="card block"><p className="font-semibold">Afueni Clean Slate</p><p className="mt-1 text-sm text-muted">We check every CRB listing against the rules and dispute the ones that break them.</p></Link>
    </div>
  );
}

// ---------- 2. Refinance with a cheaper lender ----------

function RefinanceTab({ onSent, preselect }: { onSent: (s: string) => void; preselect: string | null }) {
  const { db } = useDb();
  const [feePct, setFeePct] = useState(String(DEFAULT_FEE_PCT));
  const [chosen, setChosen] = useState<{ loan: Loan; lender: string; monthly: number } | null>(null);
  const [share, setShare] = useState(false);
  const loans = db.loans.filter((l) => l.status !== "closed").sort((a, b) => (a.id === preselect ? -1 : b.id === preselect ? 1 : 0));
  const eligible = canRefinance(db.loans, latestCrb(db));

  const withOffers = loans.map((l) => {
    const v = view(l);
    return { loan: l, v, offers: refinanceOffers({ balance: v.balance, aprPct: v.apr, monthsLeft: v.monthsLeft, currentMonthly: monthlyObligation(l.terms) }, personalProducts, Number(feePct) || 0) };
  });

  function send() {
    if (!chosen) return;
    store.setConsent("share_partner", true);
    store.addRequest({ loanId: chosen.loan.id, goal: "refinance", targetLender: chosen.lender, proposedMonthly: Math.round(chosen.monthly), message: `Refinance ${chosen.loan.lender} with ${chosen.lender}` });
    onSent(`We'll ask ${chosen.lender} for a quote to refinance your ${chosen.loan.lender} loan. If they approve, they pay off ${chosen.loan.lender} directly and you repay them instead, at a lower cost. ${PILOT_NOTE}`);
  }

  if (!loans.length) return <p className="card text-sm text-muted">Add your loans first.</p>;
  if (!eligible.ok) {
    return (
      <section className="card space-y-2">
        <p className="font-semibold">A cheaper lender is unlikely right now</p>
        <p className="text-sm text-muted">{eligible.reason}</p>
        <p className="text-sm text-muted">Afueni One Plan works whether or not you are behind or listed, and Clean Slate can fix a wrong listing.</p>
        <Link href="/plan" className="btn">See my One Plan</Link>
      </section>
    );
  }
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        A cheaper lender can pay off your current loan, and you repay them at a lower rate instead. Savings below are over your remaining term, after an assumed {feePct}% in new-loan fees.
      </p>
      <label className="card block"><span className="label">Assumed fees on the new loan (% of balance)</span>
        <input className="input num" inputMode="decimal" value={feePct} onChange={(e) => setFeePct(e.target.value.replace(/[^\d.]/g, ""))} />
      </label>
      {withOffers.map(({ loan, v, offers }) => (
        <section key={loan.id} className="card space-y-2">
          <div className="flex items-baseline justify-between">
            <p className="font-semibold">{loan.lender}</p>
            <p className="num text-sm text-muted">{kes(v.balance)} at {v.apr.toFixed(1)}% · {v.monthsLeft} months left</p>
          </div>
          {offers.length === 0 ? (
            <p className="text-sm text-muted">
              {v.balance < MIN_REFINANCE_BALANCE || v.monthsLeft < MIN_REFINANCE_MONTHS
                ? `Banks rarely refinance loans under ${kes(MIN_REFINANCE_BALANCE)} or with under ${MIN_REFINANCE_MONTHS} months left. Use Afueni One Plan instead.`
                : "No reporting lender beats this loan after fees."}
            </p>
          ) : offers.map((o) => (
            <label key={o.lender.lenderId} className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-3 ${chosen?.loan.id === loan.id && chosen.lender === o.lender.lender ? "border-brand bg-brand-soft" : "border-line"}`}>
              <input type="radio" name="offer" className="sr-only" onChange={() => setChosen({ loan, lender: o.lender.lender, monthly: o.newMonthly })} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{o.lender.lender}</span>
                <span className="block text-xs text-muted">about {o.rate.toFixed(1)}% · {kes(o.newMonthly)}/month</span>
              </span>
              <span className="num shrink-0 text-sm font-bold text-good">Save {kes(o.saving)}</span>
            </label>
          ))}
        </section>
      ))}
      {chosen ? (
        <section className="card space-y-3">
          <p className="text-sm">Ask <b>{chosen.lender}</b> to refinance your <b>{chosen.loan.lender}</b> loan at about {kes(chosen.monthly)} a month.</p>
          <p className="text-xs text-muted">The new lender will check your credit as usual. Offers are priced at the middle of the rates each bank reports to KBA; your actual quote depends on your credit record.</p>
          <ShareConsent checked={share} onChange={setShare} who={`Afueni by Risk Radar and ${chosen.lender}`} />
          <button className="btn w-full" disabled={!share} onClick={send}>Ask for a refinance quote</button>
        </section>
      ) : null}
      <p className="text-center text-xs text-muted">Rates from the <Link className="underline" href="/compare">Compare</Link> page.</p>
    </div>
  );
}

// ---------- 3. Talk to someone (settlement, advice) ----------

const GOALS: { value: DistressRequest["goal"]; label: string; body: string }[] = [
  { value: "settlement", label: "Settle for less", body: "Negotiate a one-off discounted payment to close a loan that is already in default." },
  { value: "advice", label: "Just advise me", body: "Talk through my options, including my CRB listing." },
];

function TalkTab({ onSent, preselect }: { onSent: (s: string) => void; preselect: string | null }) {
  const { db } = useDb();
  const open = db.loans.filter((l) => l.status !== "closed");
  const [loanId, setLoanId] = useState(preselect ?? open.find((l) => l.arrearsDays > 0)?.id ?? open[0]?.id ?? "");
  const [goal, setGoal] = useState<DistressRequest["goal"]>("advice");
  const [message, setMessage] = useState("");
  const [share, setShare] = useState(false);

  if (!open.length) return <p className="card text-sm text-muted">You have no open loans.</p>;
  return (
    <section className="card space-y-3">
      <label className="block"><span className="label">Which loan?</span>
        <select className="input" value={loanId} onChange={(e) => setLoanId(e.target.value)}>
          {open.map((l) => <option key={l.id} value={l.id}>{l.lender} · {kes(view(l).balance)}{l.arrearsDays ? ` · ${l.arrearsDays} days overdue` : ""}</option>)}
        </select>
      </label>
      {GOALS.map((g) => (
        <label key={g.value} className={`flex gap-3 rounded-xl border p-3 ${goal === g.value ? "border-brand bg-brand-soft" : "border-line"}`}>
          <input type="radio" name="goal" className="mt-1" checked={goal === g.value} onChange={() => setGoal(g.value)} />
          <span><span className="block text-sm font-medium">{g.label}</span><span className="block text-xs text-muted">{g.body}</span></span>
        </label>
      ))}
      <label className="block"><span className="label">Anything we should know? (optional)</span>
        <textarea className="input min-h-20" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="e.g. I lost my job in August and can pay KES 3,000 a month" />
      </label>
      <ShareConsent checked={share} onChange={setShare} who="an Afueni by Risk Radar resolution partner" />
      <button className="btn w-full" disabled={!loanId || !share} onClick={() => { store.setConsent("share_partner", true); store.addRequest({ loanId, goal, message }); onSent(PILOT_NOTE); }}>Ask for help</button>
    </section>
  );
}

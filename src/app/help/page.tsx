"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { Gate } from "@/components/Gate";
import products from "@/data/lender-products.json";
import { kes, monthlyObligation } from "@/lib/finance";
import { view } from "@/lib/loanView";
import { DEFAULT_FEE_PCT, kindOf, type LenderProduct } from "@/lib/market";
import { affordableBudget, affordablePlan, MIN_REFINANCE_BALANCE, MIN_REFINANCE_MONTHS, parseStatementCsv, refinanceOffers, summariseIncome, type MonthFlow } from "@/lib/remediation";
import { store } from "@/lib/store";
import type { DistressRequest, Loan } from "@/lib/types";
import { useDb } from "@/lib/useStore";

// Buyouts are priced as bank personal loans.
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
      <div className="grid grid-cols-3 gap-1 rounded-xl border border-line bg-card p-1 text-sm">
        {([["plan", "Affordable plan"], ["refinance", "Cheaper lender"], ["talk", "Talk to us"]] as const).map(([k, label]) => (
          <button key={k} onClick={() => { setTab(k); setSent(null); }} className={`rounded-lg py-2 font-medium ${tab === k ? "bg-brand text-[#181a20]" : "text-muted"}`}>{label}</button>
        ))}
      </div>
      {sent ? (
        <section className="card border-good">
          <p className="font-semibold text-good">Request sent</p>
          <p className="mt-1 text-sm text-muted">{sent}</p>
        </section>
      ) : tab === "plan" ? <AffordablePlanTab onSent={setSent} /> : tab === "refinance" ? <RefinanceTab onSent={setSent} preselect={params.get("loan")} /> : <TalkTab onSent={setSent} preselect={params.get("loan")} />}
    </div>
  );
}

const PILOT_NOTE = "During the pilot, the Risk Radar team reviews every request and calls you on your registered number before anything is shared with a lender or partner.";

function ShareConsent({ checked, onChange, who }: { checked: boolean; onChange: (v: boolean) => void; who: string }) {
  return (
    <label className="flex gap-3 rounded-xl border border-line p-3 text-sm">
      <input type="checkbox" className="mt-1" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>I agree to share the details of the loans named here, my name and phone number with {who} for this request only. My other loans stay private.</span>
    </label>
  );
}

// ---------- 1. Affordable plan from income ----------

function AffordablePlanTab({ onSent }: { onSent: (s: string) => void }) {
  const { db } = useDb();
  const profile = db.profile!;
  const [flows, setFlows] = useState<MonthFlow[]>(profile.incomeFlows ?? []);
  const [manual, setManual] = useState(() => (profile.incomeFlows?.length ? profile.incomeFlows.map((f) => String(Math.round(f.inflow))) : ["", "", ""]));
  const [essentials, setEssentials] = useState(String(profile.essentials ?? ""));
  const [csvError, setCsvError] = useState("");
  const [share, setShare] = useState(false);

  const loans = db.loans.filter((l) => l.status !== "closed");
  const income = summariseIncome(flows);
  const budget = affordableBudget(income.conservativeIncome, Number(essentials) || 0);
  const plan = useMemo(() => affordablePlan(loans.map((l) => {
    const v = view(l);
    return { id: l.id, name: l.lender, balance: v.balance, aprPct: v.apr, currentMonthly: monthlyObligation(l.terms) };
  }), budget), [loans, budget]);

  async function onFile(file: File) {
    setCsvError("");
    const parsed = parseStatementCsv(await file.text());
    if (!parsed.length) { setCsvError("We couldn't read that file. Export your statement as CSV with a date column and amounts, or type your monthly income below."); return; }
    setFlows(parsed);
    setManual(parsed.map((f) => String(Math.round(f.inflow))));
    store.saveProfile({ ...profile, incomeFlows: parsed, incomeSource: "statement" });
  }

  function applyManual(values: string[]) {
    setManual(values);
    const f = values.map((v, i) => ({ month: `m${i + 1}`, inflow: Number(v) || 0, outflow: 0 })).filter((x) => x.inflow > 0);
    setFlows(f);
    store.saveProfile({ ...profile, incomeFlows: f, incomeSource: "manual" });
  }

  function send() {
    store.setConsent("share_partner", true);
    for (const p of plan.proposed.filter((x) => x.ask !== "keep")) {
      store.addRequest({ loanId: p.id, goal: "affordable_plan", message: `Proposed KES ${p.proposedMonthly}/month${p.months ? ` over ${p.months} months` : " with a rate reduction"}`, proposedMonthly: p.proposedMonthly });
    }
    onSent(`We'll take your plan to each lender and ask them to restructure. ${PILOT_NOTE}`);
  }

  if (!loans.length) return <p className="card text-sm text-muted">Add your loans first.</p>;

  return (
    <div className="space-y-4">
      <section className="card space-y-3">
        <h2 className="font-semibold">1. Your income</h2>
        <p className="text-xs text-muted">Upload 3 to 6 months of M-Pesa or bank statements as CSV, or your business sales records. We read the money coming in each month. The file is read on your phone and never uploaded. For PDF statements, use <Link className="text-brand underline" href="/profile">My details</Link>.</p>
        <input type="file" accept=".csv,text/csv" className="block w-full text-sm" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        {csvError ? <p className="text-xs text-bad">{csvError}</p> : null}
        <div>
          <span className="label">Or type money received each month (KES)</span>
          <div className="grid grid-cols-3 gap-2">
            {manual.map((v, i) => (
              <input key={i} aria-label={`Month ${i + 1} income`} className="input num" inputMode="numeric" value={v} placeholder={`Month ${i + 1}`} onChange={(e) => { const next = [...manual]; next[i] = e.target.value.replace(/[^\d]/g, ""); applyManual(next); }} />
            ))}
          </div>
          <button type="button" className="mt-2 text-xs text-brand underline" onClick={() => applyManual([...manual, ""])}>Add a month</button>
        </div>
        <label className="block"><span className="label">Essential spending per month: rent, food, transport, school fees (KES)</span>
          <input className="input num" inputMode="numeric" value={essentials} onChange={(e) => { const v = e.target.value.replace(/[^\d]/g, ""); setEssentials(v); store.saveProfile({ ...profile, essentials: Number(v) || 0 }); }} />
        </label>
      </section>

      {income.months > 0 ? (
        <section className="card space-y-3">
          <h2 className="font-semibold">2. What you can afford</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><p className="text-xs text-muted">Average income</p><p className="num font-bold">{kes(income.averageIncome)}</p></div>
            <div><p className="text-xs text-muted">Plan built on (slow months)</p><p className="num font-bold">{kes(income.conservativeIncome)}</p></div>
            <div><p className="text-xs text-muted">Loan repayments today</p><p className="num font-bold">{kes(plan.currentTotal)}</p></div>
            <div><p className="text-xs text-muted">Affordable for loans</p><p className={`num font-bold ${plan.fitsToday ? "text-good" : "text-warn"}`}>{kes(budget)}</p></div>
          </div>
          <p className="text-xs text-muted">We plan on your slower months and keep 20% of what&apos;s left after essentials as a buffer, so one bad month doesn&apos;t put you in arrears.</p>
        </section>
      ) : null}

      {income.months > 0 ? (
        <section className="card space-y-3">
          <h2 className="font-semibold">3. Your plan</h2>
          {plan.fitsToday ? (
            <p className="text-sm text-good">Your current repayments fit your income. Keep paying as scheduled, and use the Plan tab to clear the costliest loan first.</p>
          ) : (
            <p className="text-sm">Your repayments are {kes(plan.currentTotal - budget)} a month more than you can safely afford. Here is what to ask each lender for:</p>
          )}
          <ul className="divide-y divide-line">
            {plan.proposed.map((p) => (
              <li key={p.id} className="py-2.5 text-sm">
                <div className="flex justify-between"><span className="font-medium">{p.name}</span><span className="num">{kes(p.currentMonthly)} → <b>{kes(p.proposedMonthly)}</b></span></div>
                <p className="text-xs text-muted">
                  {p.ask === "keep" ? "No change needed." : p.ask === "extend" ? `Ask to extend the term: cleared in ${p.months} months.` : "This payment can't clear the loan at its current rate. Ask for a rate reduction, or move it to a cheaper lender."}
                </p>
              </li>
            ))}
          </ul>
          {!plan.fitsToday && plan.maxMonths ? <p className="text-xs text-muted">Debt-free in about {plan.maxMonths} months on this plan.</p> : null}
          {!plan.fitsToday ? (
            <>
              <ShareConsent checked={share} onChange={setShare} who="Risk Radar and the lenders named above" />
              <button className="btn w-full" disabled={!share} onClick={send}>Ask my lenders for this plan</button>
            </>
          ) : null}
        </section>
      ) : null}
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

  const withOffers = loans.map((l) => {
    const v = view(l);
    return { loan: l, v, offers: refinanceOffers({ balance: v.balance, aprPct: v.apr, monthsLeft: v.monthsLeft, currentMonthly: monthlyObligation(l.terms) }, personalProducts, Number(feePct) || 0) };
  });

  function send() {
    if (!chosen) return;
    store.setConsent("share_partner", true);
    store.addRequest({ loanId: chosen.loan.id, goal: "refinance", targetLender: chosen.lender, proposedMonthly: Math.round(chosen.monthly), message: `Refinance ${chosen.loan.lender} with ${chosen.lender}` });
    onSent(`We'll ask ${chosen.lender} to quote for buying out your ${chosen.loan.lender} loan. If they approve, they pay ${chosen.loan.lender} directly and you repay them instead. ${PILOT_NOTE}`);
  }

  if (!loans.length) return <p className="card text-sm text-muted">Add your loans first.</p>;
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        A cheaper lender can pay off (buy out) your current loan, and you repay them at a lower rate instead. Savings below are over your remaining term, after an assumed {feePct}% in new-loan fees.
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
                ? `Banks rarely buy out loans under ${kes(MIN_REFINANCE_BALANCE)} or with under ${MIN_REFINANCE_MONTHS} months left. Use the affordable plan instead.`
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
          <p className="text-sm">Ask <b>{chosen.lender}</b> to buy out your <b>{chosen.loan.lender}</b> loan at about {kes(chosen.monthly)} a month.</p>
          <p className="text-xs text-muted">The new lender will check your credit as usual. Offers are priced at the middle of the rates each bank reports to KBA; your actual quote depends on your credit record.</p>
          <ShareConsent checked={share} onChange={setShare} who={`Risk Radar and ${chosen.lender}`} />
          <button className="btn w-full" disabled={!share} onClick={send}>Request a buyout quote</button>
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
      <ShareConsent checked={share} onChange={setShare} who="a Risk Radar resolution partner" />
      <button className="btn w-full" disabled={!loanId || !share} onClick={() => { store.setConsent("share_partner", true); store.addRequest({ loanId, goal, message }); onSent(PILOT_NOTE); }}>Ask for help</button>
    </section>
  );
}

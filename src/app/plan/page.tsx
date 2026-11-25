"use client";

import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { BrandText } from "@/components/BrandText";
import { Gate } from "@/components/Gate";
import { SignWithCode } from "@/components/SignWithCode";
import { kes } from "@/lib/finance";
import { bestRefinanceSaving, draftFor, latestCrb, loanViews, money, progress } from "@/lib/myPlan";
import { addPeriods, defaultStart, FREEZE_ASK, fmtMonth, freedomDate, graduateEligible, planRef, RHYTHM_LABEL, routes, SAFE_BUFFER, type Rhythm, type Split } from "@/lib/oneplan";
import { newId, store } from "@/lib/store";
import { CONSENT_TEXT, type OnePlan, type ProposalStatus } from "@/lib/types";
import { useDb } from "@/lib/useStore";
import { AlertIcon, BoltIcon, CalendarIcon, ChatIcon, CheckCircle, CheckIcon, ClockIcon, CompareIcon, DocIcon, GradIcon, LockIcon, PauseIcon, PlanIcon, SendIcon, ShieldIcon, SparkleIcon, TrendDownIcon } from "@/components/Icons";
import { IconTile, Meter, More, PageHeader, RowLink, Segmented, StepTitle } from "@/components/ui";
import type { RouteKey } from "@/lib/oneplan";

const ROUTE_ICON: Record<RouteKey, typeof PlanIcon> = { tips: TrendDownIcon, refinance: CompareIcon, one_plan: PlanIcon, pause: PauseIcon, clean_slate: SparkleIcon };

export default function PlanPage() {
  return <Gate><Suspense><PlanInner /></Suspense></Gate>;
}

function PlanInner() {
  const { db } = useDb();
  const plan = store.livePlan(db);
  if (plan && plan.status !== "draft") return <Tracker plan={plan} />;
  if (!db.loans.some((l) => l.status !== "closed")) {
    return (
      <div className="mx-auto max-w-3xl space-y-5 py-2">
        <PageHeader icon={PlanIcon} title="Afueni One Plan" sub="Add your loans first." />
        <RowLink href="/profile#crb" icon={DocIcon} title="CRB report" sub="The quickest way to find every loan" />
        <RowLink href="/profile#mpesa" icon={DocIcon} title="M-PESA statement" sub="Fuliza, M-Shwari and loan apps" />
      </div>
    );
  }
  return <Builder />;
}

// ---------- Before a plan: money, routes, building and signing ----------

function Builder() {
  const { db } = useDb();
  const m = money(db);
  const views = useMemo(() => loanViews(db), [db]);
  const [shock, setShock] = useState(false);
  const rs = useMemo(() => routes({ loans: db.loans, views, safe: m.safe, crb: latestCrb(db), shock, refinanceSaving: bestRefinanceSaving(views) }), [db, views, m.safe, shock]);

  return (
    <div className="mx-auto max-w-4xl space-y-8 py-2">
      <PageHeader icon={PlanIcon} title="Your way out" sub="One payment you can afford, shared across all your lenders. We talk to them. Free." />

      <MoneyCard />

      <section className="space-y-4">
        <StepTitle n={2} title="Choose your route" />
        <label className="choice items-center" data-on={shock}>
          <input type="checkbox" checked={shock} onChange={(e) => setShock(e.target.checked)} />
          <BoltIcon className="h-5 w-5 shrink-0 text-warn" />
          <span className="text-[0.9375rem]">Something just happened: illness, a death, job loss, a stolen motorbike or a failed harvest.</span>
        </label>
        <div className="grid gap-3 md:grid-cols-2">
          {rs.map((r) => {
            const Icon = ROUTE_ICON[r.key] ?? PlanIcon;
            return (
              <Link key={r.key} href={r.key === "one_plan" ? "#build" : r.key === "tips" ? "/plan/payoff" : r.href}
                className={`card block ${r.recommended ? "!border-gold ring-4 ring-gold/15 md:col-span-2" : ""} ${r.available ? "" : "opacity-60"}`}>
                <div className="flex items-start gap-3">
                  <IconTile icon={Icon} tone={r.recommended ? "gold" : "plain"} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold leading-snug">{r.title}</p>
                      {r.recommended ? <span className="badge badge-solid"><CheckIcon className="h-3 w-3" />Best fit</span> : null}
                    </div>
                    <p className="mt-1 text-sm text-muted">{r.body}</p>
                    {r.freedom || r.totalCost != null ? (
                      <div className="num mt-2 flex flex-wrap gap-1.5">
                        {r.freedom ? <span className="badge badge-gold"><CalendarIcon className="h-3 w-3" />Free by {fmtMonth(r.freedom)}</span> : null}
                        {r.totalCost != null ? <span className="badge">Total {kes(r.totalCost)}</span> : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
        <More>One Plan totals assume lenders freeze interest and penalties under the Afueni Creditor Code. A coach can explain any route by voice note or call.</More>
      </section>

      {m.safe ? <BuildPlan safe={m.safe} /> : null}
    </div>
  );
}

function MoneyCard() {
  const { db } = useDb();
  const profile = db.profile!;
  const m = money(db);
  const [slow, setSlow] = useState(m.months ? "" : String(profile.monthlyIncome || ""));
  const [ess, setEss] = useState(profile.essentials != null ? String(profile.essentials) : "");

  return (
    <section className="space-y-4">
      <StepTitle n={1} title="Your money" />
      <div className="grid gap-4 md:grid-cols-2">
      <div className="card space-y-4">
      {m.months ? (
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="eyebrow">Slowest month in</p>
            <p className="num text-xl font-bold">{kes(m.slowest)}</p>
            <p className="num text-xs text-muted">Average {kes(m.average)}, from your statements</p>
          </div>
          <Link className="btn-ghost btn-sm" href="/profile#mpesa">Update</Link>
        </div>
      ) : (
        <label className="block"><span className="label">Money in during your slowest recent month (KES)</span>
          <input className="input num" inputMode="numeric" value={slow} placeholder="e.g. 28000" onChange={(e) => {
            const v = e.target.value.replace(/[^\d]/g, ""); setSlow(v);
            store.saveProfile({ ...profile, incomeFlows: Number(v) ? [{ month: "m1", inflow: Number(v), outflow: 0 }] : [], incomeSource: "manual" });
          }} />
          <span className="mt-1.5 block text-xs text-muted">Or <Link className="link" href="/profile#mpesa">add your M-PESA statement</Link> and we work it out.</span>
        </label>
      )}
      <label className="block"><span className="label">Essentials each month (KES)</span>
        <span className="-mt-1 mb-1.5 block text-xs text-muted">Rent, food, school fees, transport, medicine, family support</span>
        <input className="input num" inputMode="numeric" value={ess} placeholder="e.g. 22000" onChange={(e) => {
          const v = e.target.value.replace(/[^\d]/g, ""); setEss(v);
          store.saveProfile({ ...profile, essentials: v === "" ? undefined : Number(v) });
        }} />
      </label>
      </div>
      {m.safe != null ? (
        m.safe > 0 ? (
          <div className="hero flex flex-col justify-between">
            <div className="flex items-center justify-between gap-2">
              <p className="hero-muted text-sm font-medium">Your Safe Payment</p>
              <ShieldIcon className="h-6 w-6 text-[#ffcf3f]" />
            </div>
            <div className="mt-4">
              <p className="num hero-gold text-4xl font-bold tracking-tight">{kes(m.safe)}</p>
              <p className="hero-muted text-sm">a month</p>
            </div>
            <p className="num hero-muted mt-4 border-t border-white/10 pt-3 text-xs">{kes(m.slowest)} slowest month − {kes(m.essentials!)} essentials, less a {SAFE_BUFFER * 100}% buffer for surprises.</p>
          </div>
        ) : (
          <div className="card space-y-3 !border-warn/50 !bg-warn-soft">
            <p className="flex items-center gap-2 font-semibold text-warn"><AlertIcon className="h-5 w-5" />Nothing is left for loans right now</p>
            <p className="text-sm text-foreground/80">A plan you can&apos;t keep would only make things worse. Start with breathing space, and a coach will look at ways to raise income or cut costs with you.</p>
            <Link href="/plan/pause" className="btn w-full"><PauseIcon className="h-5 w-5" />Ask for an Afueni Pause</Link>
          </div>
        )
      ) : (
        <div className="card-flat flex flex-col items-center justify-center gap-2 py-8 text-center text-sm text-muted">
          <ShieldIcon className="h-8 w-8 text-brand" />Fill in both numbers to see your Safe Payment.
        </div>
      )}
      </div>
    </section>
  );
}

function BuildPlan({ safe }: { safe: number }) {
  const { db } = useDb();
  const [rhythm, setRhythm] = useState<Rhythm>("monthly");
  const [split, setSplit] = useState<Split>("fair");
  const [monthly, setMonthly] = useState(safe);
  const [start, setStart] = useState(() => defaultStart().toISOString().slice(0, 10));
  const [sharePlan, setSharePlan] = useState(store.hasConsent("share_plan", db));
  const [actForMe, setActForMe] = useState(store.hasConsent("act_for_me", db));
  const [readCharter, setReadCharter] = useState(false);
  const amount = Math.min(monthly, safe);
  const draft = draftFor(db, amount, rhythm, split);
  const startDate = new Date(start + "T00:00:00");

  function sign() {
    store.setConsent("share_plan", sharePlan);
    store.setConsent("act_for_me", actForMe);
    const now = new Date().toISOString();
    const plan: OnePlan = {
      id: newId(), ref: planRef(), status: "active", rhythm, split, safePayment: safe, amount: draft.amount, startDate: start,
      totalPayments: draft.totalPayments, payments: [], signedAt: now, createdAt: now, updatedAt: now,
      lenders: draft.lines.map((l) => ({ loanId: l.loanId, lender: l.lender, balance: Math.round(l.balance), amountPerPayment: l.firstPayment, payments: l.payments, proposal: sharePlan ? "sent" : "not_sent", proposalAt: sharePlan ? now : undefined })),
    };
    store.savePlan(plan);
    if (sharePlan) {
      for (const l of plan.lenders) {
        store.addRequest({ loanId: l.loanId, goal: "one_plan", proposedMonthly: Math.round((l.amountPerPayment * (rhythm === "monthly" ? 12 : rhythm === "weekly" ? 52 : 365)) / 12), message: `${plan.ref}: Plan Proposal, KES ${l.amountPerPayment} ${RHYTHM_LABEL[rhythm]} for ${l.payments} payments` });
      }
    }
    window.scrollTo({ top: 0 });
  }

  return (
    <section id="build" className="scroll-mt-24 space-y-4">
      <StepTitle n={3} title="Build your One Plan" />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start">
      <div className="card space-y-5">
        <div>
          <span className="label">How often do you get paid?</span>
          <Segmented label="How often do you get paid?" value={rhythm} onChange={setRhythm}
            options={(["daily", "weekly", "monthly"] as Rhythm[]).map((r) => ({ value: r, label: r === "daily" ? "Daily" : r === "weekly" ? "Weekly" : "Monthly" }))} />
          <p className="mt-1.5 text-xs text-muted">Traders and boda riders often pay best daily or weekly. Salaried people pay on payday.</p>
        </div>
        <div>
          <span className="label">How to share each payment</span>
          <Segmented label="How to share each payment" value={split} onChange={setSplit}
            options={[{ value: "fair", label: "Fair share" }, { value: "small_first", label: "Small debts first" }]} />
          <p className="mt-1.5 text-xs text-muted">{split === "fair" ? "Each lender gets a share in line with what you owe them." : "Every lender gets something, and the smallest debts clear first. Quick wins, and small CRB listings often clear within weeks."}</p>
        </div>
        <label className="block">
          <span className="label">Pay a month (up to {kes(safe)})</span>
          <span className="num block text-2xl font-bold tracking-tight">{kes(draft.amount)} <span className="text-sm font-medium text-muted">{RHYTHM_LABEL[rhythm]}</span></span>
          <input type="range" min={Math.max(100, Math.round(safe * 0.3))} max={safe} step={50} value={amount} onChange={(e) => setMonthly(Number(e.target.value))} className="mt-1 w-full" />
          <span className="num block text-xs text-muted">{kes(amount)} a month</span>
        </label>
        <label className="block"><span className="label">First payment</span>
          <input type="date" className="input" value={start} onChange={(e) => setStart(e.target.value)} />
        </label>
      </div>

      {draft.feasible ? (
        <div className="space-y-4 lg:sticky lg:top-6">
          <div className="hero">
            <div className="grid grid-cols-2 gap-3">
              <div><p className="hero-muted text-xs font-medium">Your Freedom Date</p><p className="num hero-gold mt-1 text-2xl font-bold tracking-tight">{fmtMonth(freedomDate(startDate, rhythm, draft.totalPayments))}</p></div>
              <div><p className="hero-muted text-xs font-medium">Total through the plan</p><p className="num mt-1 text-2xl font-bold tracking-tight">{kes(draft.total)}</p></div>
            </div>
          </div>
          <div className="card space-y-4">
          <ul className="divide-y divide-line text-sm">
            {draft.lines.map((l) => (
              <li key={l.loanId} className="flex items-start justify-between gap-3 py-2.5 first:pt-0">
                <span className="min-w-0"><span className="block truncate font-semibold">{l.lender}</span><span className="num block text-xs text-muted">owed {kes(l.balance)} · cleared {fmtMonth(addPeriods(startDate, rhythm, l.clearsOn - 1))}</span></span>
                <span className="num shrink-0 text-right"><b>{kes(l.firstPayment)}</b><span className="block text-xs text-muted">× {l.payments} payments</span></span>
              </li>
            ))}
          </ul>
          <div className="card-flat">
            <p className="flex items-center gap-2 text-sm font-semibold"><ShieldIcon className="h-5 w-5 text-brand" />What we ask every lender</p>
            <ul className="mt-2 space-y-1.5 text-sm text-foreground/80">{FREEZE_ASK.map((f) => <li key={f} className="flex gap-2"><CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-good" />{f}</li>)}</ul>
          </div>
          </div>
        </div>
      ) : (
        <div className="alert alert-warn"><AlertIcon className="h-5 w-5 shrink-0 text-warn" /><span>This amount is too small to clear your loans. Raise it, or talk to a coach.</span></div>
      )}
      </div>

      {draft.feasible ? (
        <div className="space-y-4 pt-4">
          <StepTitle n={4} title="Agree and sign" />
          <div className="card space-y-3">
          {(["share_plan", "act_for_me"] as const).map((p) => (
            <label key={p} className="choice">
              <input type="checkbox" className="mt-0.5" checked={p === "share_plan" ? sharePlan : actForMe} onChange={(e) => (p === "share_plan" ? setSharePlan : setActForMe)(e.target.checked)} />
              <span><span className="block text-sm font-medium">{CONSENT_TEXT[p].title}</span><span className="block text-xs text-muted"><BrandText>{CONSENT_TEXT[p].body}</BrandText></span></span>
            </label>
          ))}
          <details className="card-flat text-sm">
            <summary className="flex items-center justify-between gap-2 font-semibold"><span className="flex items-center gap-2"><ShieldIcon className="h-5 w-5 text-brand" />Afueni Borrower Charter</span><span className="text-xs font-semibold text-brand">Read</span></summary>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-muted">
              <li>You never pay Afueni. Not for plans, Pause, Clean Slate or coaching.</li>
              <li>You pay each lender directly. Afueni never holds your money.</li>
              <li>Afueni never asks for your contacts or photos, never lends, and never contacts your family, friends or employer about a debt.</li>
              <li>You can change your mind before any proposal is sent, and leave the plan at any time.</li>
              <li>Complaints go to your coach, then the Afueni lead within 5 working days. You can also go to the ODPC (your data) or CBK (how a lender treats you).</li>
            </ul>
          </details>
          <label className="choice items-center">
            <input type="checkbox" checked={readCharter} onChange={(e) => setReadCharter(e.target.checked)} />
            <span className="text-sm font-medium">I have read my plan and the Borrower Charter.</span>
          </label>
          {!sharePlan ? <p className="flex gap-2 text-xs text-muted"><LockIcon className="h-4 w-4 shrink-0" />Without the first permission your plan is saved for you only, and no lender is asked. You can send it later.</p> : null}
          <div className="border-t border-line pt-3"><SignWithCode disabled={!readCharter} label="Sign my plan" onSigned={sign} /></div>
          <p className="text-xs text-muted">During the pilot a coach checks every plan before proposals go to lenders, and calls you first.</p>
          </div>
        </div>
      ) : null}
    </section>
  );
}

// ---------- A live plan ----------

const PROPOSAL: Record<ProposalStatus, { label: string; tone: string }> = {
  not_sent: { label: "Not sent", tone: "" },
  sent: { label: "Waiting for reply", tone: "badge-warn" },
  accepted: { label: "Accepted", tone: "badge-good" },
  countered: { label: "Asked for changes", tone: "badge-warn" },
  declined: { label: "Declined", tone: "badge-bad" },
};

function Tracker({ plan }: { plan: OnePlan }) {
  const { db } = useDb();
  const p = progress(plan);
  const [missing, setMissing] = useState(false);
  const done = plan.status === "completed";
  const save = (patch: Partial<OnePlan>) => store.savePlan({ ...plan, ...patch });

  function record(status: "paid" | "missed") {
    const n = plan.payments.length + 1;
    const payments = [...plan.payments, { n, due: addPeriods(new Date(plan.startDate + "T00:00:00"), plan.rhythm, n - 1).toISOString().slice(0, 10), status, amount: status === "paid" ? plan.amount : 0, at: new Date().toISOString() }];
    const paid = payments.filter((x) => x.status === "paid").length;
    save({ payments, status: paid >= plan.totalPayments ? "completed" : plan.status });
    if (status === "missed" && store.hasConsent("act_for_me", db)) {
      store.addRequest({ loanId: plan.lenders[0].loanId, goal: "missed_payment", message: `${plan.ref}: payment ${n} missed. A coach will call within 3 days.` });
    }
  }

  function sendProposals() {
    store.setConsent("share_plan", true);
    const now = new Date().toISOString();
    for (const l of plan.lenders.filter((x) => x.proposal === "not_sent")) {
      store.addRequest({ loanId: l.loanId, goal: "one_plan", message: `${plan.ref}: Plan Proposal, KES ${l.amountPerPayment} ${RHYTHM_LABEL[plan.rhythm]} for ${l.payments} payments` });
    }
    save({ lenders: plan.lenders.map((l) => (l.proposal === "not_sent" ? { ...l, proposal: "sent", proposalAt: now } : l)) });
  }

  return (
    <div className="space-y-5 py-2">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-start">
      <div className="space-y-5">
      <section className="hero">
        <div className="flex items-center justify-between gap-2">
          <p className="hero-muted text-sm font-medium"><span className="block text-xs opacity-80">Afueni One Plan</span>{done ? "You are" : "Your Freedom Date"}</p>
          <span className="hero-chip num whitespace-nowrap">{plan.ref}</span>
        </div>
        <p className="num hero-gold mt-2 text-[2.6rem] font-bold leading-none tracking-tight md:text-5xl">{done ? "Debt free" : fmtMonth(p.freedom)}</p>
        <div className="mt-5"><Meter pct={p.pct} label="Repaid so far" /></div>
        <div className="num hero-muted mt-2 flex flex-wrap justify-between gap-x-3 text-sm">
          <span>{kes(p.repaid)} of {kes(p.owed)}</span>
          <span>{p.paid} of {plan.totalPayments} payments{p.missed ? ` · ${p.missed} missed` : ""}</span>
        </div>
        {plan.status === "paused" ? <p className="mt-3 flex items-center gap-2 rounded-xl bg-white/[0.07] px-3 py-2 text-sm text-[#ffc078]"><PauseIcon className="h-4 w-4" />Paused: {plan.pause?.status === "granted" ? `${plan.pause.days} days of breathing space agreed.` : "we have asked your lenders for breathing space."}</p> : null}
      </section>

      {!done ? (
        <section className="card space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-lg font-bold"><CalendarIcon className="h-5 w-5 text-brand" />Next payment</h2>
            <span className="badge badge-gold num">{p.next.toLocaleDateString("en-KE", { weekday: "short", day: "numeric", month: "short" })}</span>
          </div>
          <ul className="space-y-2 text-[0.9375rem]">
            {plan.lenders.filter((l) => l.payments > p.paid).map((l) => (
              <li key={l.loanId} className="flex justify-between gap-3"><span>{l.lender}</span><span className="num font-semibold">{kes(l.amountPerPayment)}</span></li>
            ))}
            <li className="flex justify-between gap-3 border-t border-line pt-2 text-lg font-bold"><span>Total</span><span className="num">{kes(plan.amount)}</span></li>
          </ul>
          <p className="flex gap-2 text-xs text-muted"><LockIcon className="h-4 w-4 shrink-0" />Pay each lender&apos;s paybill directly, as you do today. Afueni never holds your money.</p>
          {!missing ? (
            <div className="grid grid-cols-2 gap-2">
              <button className="btn" onClick={() => record("paid")}><CheckCircle className="h-5 w-5" />I&apos;ve paid</button>
              <button className="btn-ghost" onClick={() => setMissing(true)}>I can&apos;t pay</button>
            </div>
          ) : (
            <div className="space-y-2 rounded-2xl bg-warn-soft p-3 text-sm">
              <p className="flex items-center gap-2 font-semibold"><HeartBadge />That&apos;s OK. Choose what helps</p>
              <button className="btn-ghost w-full" onClick={() => { setMissing(false); }}>I&apos;ll catch up within 7 days</button>
              <button className="btn-ghost w-full" onClick={() => { record("missed"); setMissing(false); }}>Skip this one: my Freedom Date moves back one payment</button>
              <Link className="btn-ghost w-full" href="/plan/pause">Something happened: ask for a Pause</Link>
              <button className="btn-ghost w-full" onClick={() => { if (confirm("Rebuild your plan on a new amount? Your lenders will get the new proposal.")) save({ status: "ended" }); }}>My income changed: resize my plan</button>
              <p className="text-xs text-muted">We tell your lenders before they notice. Afueni never adds a fee, threatens you or contacts anyone else.</p>
            </div>
          )}
        </section>
      ) : (
        <Finished plan={plan} save={save} />
      )}

      </div>
      <div className="space-y-5">
      <section className="card space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold">Your lenders</h2>
          {plan.lenders.some((l) => l.proposal === "not_sent") ? <button className="btn-ghost btn-sm" onClick={sendProposals}><SendIcon className="h-4 w-4" />Send my plan</button> : null}
        </div>
        <ul className="divide-y divide-line text-sm">
          {plan.lenders.map((l, i) => (
            <li key={l.loanId} className="space-y-1.5 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold">{l.lender}</span>
                <span className={`badge ${PROPOSAL[l.proposal].tone}`}>{PROPOSAL[l.proposal].label}</span>
              </div>
              <p className="num text-xs text-muted">{kes(l.amountPerPayment)} {RHYTHM_LABEL[plan.rhythm]} × {l.payments} · owed {kes(l.balance)}</p>
              {l.proposal !== "not_sent" ? (
                <label className="flex items-center gap-2 text-xs text-muted">Their reply:
                  <select className="input !min-h-0 !w-auto !rounded-lg !py-1 !pl-2 !text-xs" value={l.proposal} onChange={(e) => save({ lenders: plan.lenders.map((x, j) => (j === i ? { ...x, proposal: e.target.value as ProposalStatus } : x)) })}>
                    {(["sent", "accepted", "countered", "declined"] as ProposalStatus[]).map((s) => <option key={s} value={s}>{PROPOSAL[s].label}</option>)}
                  </select>
                </label>
              ) : null}
              {l.proposal === "declined" ? <p className="text-xs text-muted">The rest of your plan goes ahead. Keep paying this lender what you can, and talk to your coach: a lender may not shame you or contact your family, friends or employer about the debt.</p> : null}
              {l.proposal === "countered" ? <p className="text-xs text-muted">Your coach will rebalance the plan and check it with you before anything changes.</p> : null}
            </li>
          ))}
        </ul>
        <p className="flex gap-2 text-xs text-muted"><ClockIcon className="h-4 w-4 shrink-0" />Lenders on the Creditor Code reply within 5 working days. We follow up the others on day 5 and day 10.</p>
      </section>

      <section className="card flex gap-3.5 text-sm">
        <IconTile icon={ChatIcon} tone="plain" />
        <div>
          <p className="font-semibold">If a collector calls, say:</p>
          <p className="mt-1 text-[0.9375rem] font-semibold text-foreground">&ldquo;I am on an Afueni plan, reference <span className="num text-brand">{plan.ref}</span>.&rdquo;</p>
          <p className="mt-1 text-muted">Or forward their message to us on WhatsApp.</p>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <RowLink href="/plan/pause" icon={PauseIcon} title="Afueni Pause" sub="Breathing space after a shock" />
        <RowLink href="/plan/clean-slate" icon={SparkleIcon} title="Afueni Clean Slate" sub="Check and fix your CRB record" />
      </div>
      </div>
      </div>

      {!done ? (
        <button className="mx-auto block rounded-full px-3 py-2 text-xs font-medium text-muted underline hover:text-bad" onClick={() => { if (confirm("Leave your One Plan? We will tell your lenders the plan has ended.")) save({ status: "ended" }); }}>Leave my plan</button>
      ) : null}
    </div>
  );
}

// ---------- K. Finishing: Afueni Keep and Graduates ----------

function Finished({ plan, save }: { plan: OnePlan; save: (p: Partial<OnePlan>) => void }) {
  const p = progress(plan);
  return (
    <>
      <section className="card space-y-2 !border-good/40 !bg-good-soft">
        <p className="flex items-center gap-2 text-lg font-bold text-good"><CheckCircle className="h-6 w-6" />Every loan in your plan is paid</p>
        <p className="text-sm text-foreground/80">We are asking each lender to report your account as settled and to send your clearance certificate. We pull your CRB report again in a month to check.</p>
      </section>
      <section className="card space-y-3">
        <p className="flex items-center gap-2 font-semibold"><LockIcon className="h-5 w-5 text-brand" />Afueni Keep</p>
        <p className="text-sm text-muted">Keep paying <b className="num text-foreground">{kes(plan.amount)}</b> {RHYTHM_LABEL[plan.rhythm]}, but into your own locked savings. The habit that got you out becomes the buffer that keeps you out. Optional, and you can stop any time.</p>
        <p className="badge badge-warn !whitespace-normal">Coming soon: we are choosing a regulated savings partner. Tick below and we&apos;ll tell you when it opens.</p>
        <label className="choice items-center text-sm font-medium">
          <input type="checkbox" checked={!!plan.keep?.optedIn} onChange={(e) => save({ keep: { optedIn: e.target.checked, at: new Date().toISOString() } })} />
          Tell me when Afueni Keep opens
        </label>
      </section>
      {graduateEligible({ completed: true, monthsOnTime: p.monthsOnTime }) ? (
        <RowLink href="/graduates" icon={GradIcon} tone="good" title="You can join Afueni Graduates" sub="Show partner banks you pay, on your terms" />
      ) : null}
    </>
  );
}

function HeartBadge() {
  return <span className="tile tile-warn !h-7 !w-7 !rounded-lg"><ClockIcon className="h-4 w-4" /></span>;
}

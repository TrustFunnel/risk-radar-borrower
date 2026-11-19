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

export default function PlanPage() {
  return <Gate><Suspense><PlanInner /></Suspense></Gate>;
}

function PlanInner() {
  const { db } = useDb();
  const plan = store.livePlan(db);
  if (plan && plan.status !== "draft") return <Tracker plan={plan} />;
  if (!db.loans.some((l) => l.status !== "closed")) {
    return (
      <div className="space-y-4 py-2">
        <h1 className="text-xl font-bold">Afueni One Plan</h1>
        <p className="card text-sm text-muted">Add your loans first. The quickest way is your <Link className="text-brand underline" href="/profile#crb">CRB report</Link> or <Link className="text-brand underline" href="/profile#mpesa">M-PESA statement</Link>.</p>
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
    <div className="space-y-4 py-2">
      <section>
        <h1 className="text-xl font-bold">Your way out</h1>
        <p className="mt-1 text-sm text-muted">One payment you can afford, shared across all your lenders. We talk to them for you. It costs you nothing.</p>
      </section>

      <MoneyCard />

      <section className="space-y-2">
        <h2 className="text-lg font-bold">Choose your route</h2>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" className="mt-1" checked={shock} onChange={(e) => setShock(e.target.checked)} />
          <span>Something just happened: illness, a death, job loss, a stolen motorbike or a failed harvest.</span>
        </label>
        {rs.map((r) => (
          <Link key={r.key} href={r.key === "one_plan" ? "#build" : r.key === "tips" ? "/plan/payoff" : r.href}
            className={`card block ${r.recommended ? "border-brand" : ""} ${r.available ? "" : "opacity-70"}`}>
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold">{r.title}</p>
              {r.recommended ? <span className="rounded bg-brand px-1.5 py-0.5 text-[11px] font-semibold text-[#181a20]">Best fit</span> : null}
            </div>
            <p className="mt-1 text-sm text-muted">{r.body}</p>
            {r.freedom || r.totalCost != null ? (
              <p className="num mt-1 text-sm">
                {r.freedom ? <>Debt free by <b>{fmtMonth(r.freedom)}</b></> : null}
                {r.freedom && r.totalCost != null ? " · " : null}
                {r.totalCost != null ? <>total to pay <b>{kes(r.totalCost)}</b></> : null}
              </p>
            ) : null}
          </Link>
        ))}
        <p className="text-xs text-muted">One Plan totals assume lenders freeze interest and penalties under the Afueni Creditor Code. A coach can explain any route by voice note or call.</p>
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
    <section className="card space-y-3">
      <h2 className="font-semibold">1. Your money</h2>
      {m.months ? (
        <p className="text-sm">From your statements, your slowest month brought in <b className="num">{kes(m.slowest)}</b> (average {kes(m.average)}).
          {" "}<Link className="text-xs text-brand underline" href="/profile#mpesa">Update</Link></p>
      ) : (
        <label className="block"><span className="label">Money in during your slowest recent month (KES)</span>
          <input className="input num" inputMode="numeric" value={slow} placeholder="e.g. 28000" onChange={(e) => {
            const v = e.target.value.replace(/[^\d]/g, ""); setSlow(v);
            store.saveProfile({ ...profile, incomeFlows: Number(v) ? [{ month: "m1", inflow: Number(v), outflow: 0 }] : [], incomeSource: "manual" });
          }} />
          <span className="mt-1 block text-xs text-muted">Or <Link className="text-brand underline" href="/profile#mpesa">add your M-PESA statement</Link> and we work it out.</span>
        </label>
      )}
      <label className="block"><span className="label">Essentials each month: rent, food, school fees, transport, medicine, family support (KES)</span>
        <input className="input num" inputMode="numeric" value={ess} placeholder="e.g. 22000" onChange={(e) => {
          const v = e.target.value.replace(/[^\d]/g, ""); setEss(v);
          store.saveProfile({ ...profile, essentials: v === "" ? undefined : Number(v) });
        }} />
      </label>
      {m.safe != null ? (
        m.safe > 0 ? (
          <div className="rounded-xl bg-raised p-3">
            <p className="text-xs text-muted">Your Safe Payment</p>
            <p className="num text-2xl font-bold text-brand">{kes(m.safe)} <span className="text-sm font-normal text-muted">a month</span></p>
            <p className="num mt-1 text-xs text-muted">{kes(m.slowest)} slowest month − {kes(m.essentials!)} essentials, less a {SAFE_BUFFER * 100}% buffer for surprises.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-warn/60 p-3 text-sm">
            <p className="font-semibold text-warn">Nothing is left for loans right now</p>
            <p className="mt-1 text-muted">A plan you can&apos;t keep would only make things worse. Start with breathing space, and a coach will look at ways to raise income or cut costs with you.</p>
            <Link href="/plan/pause" className="btn mt-2">Ask for an Afueni Pause</Link>
          </div>
        )
      ) : null}
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
    <section id="build" className="scroll-mt-4 space-y-3">
      <h2 className="text-lg font-bold">2. Build your One Plan</h2>
      <div className="card space-y-3">
        <div>
          <span className="label">How often do you get paid?</span>
          <div className="grid grid-cols-3 gap-2">
            {(["daily", "weekly", "monthly"] as Rhythm[]).map((r) => (
              <button key={r} className={rhythm === r ? "btn" : "btn-ghost"} onClick={() => setRhythm(r)}>{r === "daily" ? "Daily" : r === "weekly" ? "Weekly" : "Monthly"}</button>
            ))}
          </div>
          <p className="mt-1 text-xs text-muted">Traders and boda riders often pay best daily or weekly. Salaried people pay on payday.</p>
        </div>
        <div>
          <span className="label">How to share each payment</span>
          <div className="grid grid-cols-2 gap-2">
            <button className={split === "fair" ? "btn" : "btn-ghost"} onClick={() => setSplit("fair")}>Fair share</button>
            <button className={split === "small_first" ? "btn" : "btn-ghost"} onClick={() => setSplit("small_first")}>Small debts first</button>
          </div>
          <p className="mt-1 text-xs text-muted">{split === "fair" ? "Each lender gets a share in line with what you owe them." : "Every lender gets something, and the smallest debts clear first. Quick wins, and small CRB listings often clear within weeks."}</p>
        </div>
        <label className="block">
          <span className="label">Pay a month (up to your Safe Payment of {kes(safe)})</span>
          <input type="range" min={Math.max(100, Math.round(safe * 0.3))} max={safe} step={50} value={amount} onChange={(e) => setMonthly(Number(e.target.value))} className="w-full accent-[var(--brand)]" />
          <span className="num block text-sm"><b>{kes(draft.amount)}</b> {RHYTHM_LABEL[rhythm]} ({kes(amount)} a month)</span>
        </label>
        <label className="block"><span className="label">First payment</span>
          <input type="date" className="input" value={start} onChange={(e) => setStart(e.target.value)} />
        </label>
      </div>

      {draft.feasible ? (
        <div className="card space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><p className="text-xs text-muted">Your Freedom Date</p><p className="num text-xl font-bold text-brand">{fmtMonth(freedomDate(startDate, rhythm, draft.totalPayments))}</p></div>
            <div><p className="text-xs text-muted">Total through the plan</p><p className="num text-xl font-bold">{kes(draft.total)}</p></div>
          </div>
          <ul className="divide-y divide-line text-sm">
            {draft.lines.map((l) => (
              <li key={l.loanId} className="flex items-start justify-between gap-3 py-2">
                <span className="min-w-0"><span className="block truncate font-medium">{l.lender}</span><span className="num block text-xs text-muted">owed {kes(l.balance)} · cleared {fmtMonth(addPeriods(startDate, rhythm, l.clearsOn - 1))}</span></span>
                <span className="num shrink-0 text-right"><b>{kes(l.firstPayment)}</b><span className="block text-xs text-muted">× {l.payments} payments</span></span>
              </li>
            ))}
          </ul>
          <div>
            <p className="text-sm font-semibold">What we ask every lender</p>
            <ul className="mt-1 space-y-1 text-sm text-muted">{FREEZE_ASK.map((f) => <li key={f} className="flex gap-2"><span className="text-brand">•</span>{f}</li>)}</ul>
          </div>
        </div>
      ) : (
        <p className="card text-sm text-warn">This amount is too small to clear your loans. Raise it, or talk to a coach.</p>
      )}

      {draft.feasible ? (
        <div className="card space-y-3">
          <h3 className="font-semibold">3. Agree and sign</h3>
          {(["share_plan", "act_for_me"] as const).map((p) => (
            <label key={p} className="flex items-start gap-3 rounded-xl border border-line p-3">
              <input type="checkbox" className="mt-1" checked={p === "share_plan" ? sharePlan : actForMe} onChange={(e) => (p === "share_plan" ? setSharePlan : setActForMe)(e.target.checked)} />
              <span><span className="block text-sm font-medium">{CONSENT_TEXT[p].title}</span><span className="block text-xs text-muted"><BrandText>{CONSENT_TEXT[p].body}</BrandText></span></span>
            </label>
          ))}
          <details className="rounded-xl border border-line p-3 text-sm">
            <summary className="font-medium">Afueni Borrower Charter</summary>
            <ul className="mt-2 space-y-1 text-muted">
              <li>You never pay Afueni. Not for plans, Pause, Clean Slate or coaching.</li>
              <li>You pay each lender directly. Afueni never holds your money.</li>
              <li>Afueni never asks for your contacts or photos, never lends, and never contacts your family, friends or employer about a debt.</li>
              <li>You can change your mind before any proposal is sent, and leave the plan at any time.</li>
              <li>Complaints go to your coach, then the Afueni lead within 5 working days. You can also go to the ODPC (your data) or CBK (how a lender treats you).</li>
            </ul>
          </details>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" className="mt-1" checked={readCharter} onChange={(e) => setReadCharter(e.target.checked)} />
            <span>I have read my plan and the Borrower Charter.</span>
          </label>
          {!sharePlan ? <p className="text-xs text-muted">Without the first permission your plan is saved for you only, and no lender is asked. You can send it later.</p> : null}
          <SignWithCode disabled={!readCharter} label="Sign my plan" onSigned={sign} />
          <p className="text-xs text-muted">During the pilot a coach checks every plan before proposals go to lenders, and calls you first.</p>
        </div>
      ) : null}
    </section>
  );
}

// ---------- A live plan ----------

const PROPOSAL: Record<ProposalStatus, { label: string; tone: string }> = {
  not_sent: { label: "Not sent", tone: "text-muted" },
  sent: { label: "Waiting for reply", tone: "text-warn" },
  accepted: { label: "Accepted", tone: "text-good" },
  countered: { label: "Asked for changes", tone: "text-warn" },
  declined: { label: "Declined", tone: "text-bad" },
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
    <div className="space-y-4 py-2">
      <section className="card border-brand">
        <p className="text-xs text-muted">Afueni One Plan · {plan.ref}</p>
        <p className="mt-1 text-sm text-muted">{done ? "You are" : "Your Freedom Date"}</p>
        <p className="num text-4xl font-bold tracking-tight text-brand">{done ? "Debt free" : fmtMonth(p.freedom)}</p>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-line" aria-hidden><div className="h-full rounded-full bg-brand" style={{ width: `${p.pct}%` }} /></div>
        <p className="num mt-2 text-sm text-muted">{kes(p.repaid)} of {kes(p.owed)} · {p.paid} of {plan.totalPayments} payments{p.missed ? ` · ${p.missed} missed` : ""}</p>
        {plan.status === "paused" ? <p className="mt-2 text-sm text-warn">Paused: {plan.pause?.status === "granted" ? `${plan.pause.days} days of breathing space agreed.` : "we have asked your lenders for breathing space."}</p> : null}
      </section>

      {!done ? (
        <section className="card space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="font-semibold">Next payment</h2>
            <span className="num text-sm text-muted">{p.next.toLocaleDateString("en-KE", { weekday: "short", day: "numeric", month: "short" })}</span>
          </div>
          <ul className="space-y-1.5 text-sm">
            {plan.lenders.filter((l) => l.payments > p.paid).map((l) => (
              <li key={l.loanId} className="flex justify-between gap-3"><span>{l.lender}</span><span className="num font-semibold">{kes(l.amountPerPayment)}</span></li>
            ))}
            <li className="flex justify-between gap-3 border-t border-line pt-1.5 font-semibold"><span>Total</span><span className="num">{kes(plan.amount)}</span></li>
          </ul>
          <p className="text-xs text-muted">Pay each lender&apos;s paybill directly, as you do today. Afueni never holds your money.</p>
          {!missing ? (
            <div className="grid grid-cols-2 gap-2">
              <button className="btn" onClick={() => record("paid")}>I&apos;ve paid</button>
              <button className="btn-ghost" onClick={() => setMissing(true)}>I can&apos;t pay this time</button>
            </div>
          ) : (
            <div className="space-y-2 rounded-xl border border-warn/60 p-3 text-sm">
              <p className="font-semibold">That&apos;s OK. Choose what helps</p>
              <button className="btn-ghost w-full" onClick={() => { setMissing(false); }}>I&apos;ll catch up within 7 days</button>
              <button className="btn-ghost w-full" onClick={() => { record("missed"); setMissing(false); }}>Skip this one: my Freedom Date moves back one payment</button>
              <Link className="btn-ghost block w-full text-center" href="/plan/pause">Something happened: ask for a Pause</Link>
              <button className="btn-ghost w-full" onClick={() => { if (confirm("Rebuild your plan on a new amount? Your lenders will get the new proposal.")) save({ status: "ended" }); }}>My income changed: resize my plan</button>
              <p className="text-xs text-muted">We tell your lenders before they notice. Afueni never adds a fee, threatens you or contacts anyone else.</p>
            </div>
          )}
        </section>
      ) : (
        <Finished plan={plan} save={save} />
      )}

      <section className="card space-y-2">
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold">Your lenders</h2>
          {plan.lenders.some((l) => l.proposal === "not_sent") ? <button className="text-xs text-brand underline" onClick={sendProposals}>Send my plan to them</button> : null}
        </div>
        <ul className="divide-y divide-line text-sm">
          {plan.lenders.map((l, i) => (
            <li key={l.loanId} className="space-y-1 py-2">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-medium">{l.lender}</span>
                <span className={`text-xs font-semibold ${PROPOSAL[l.proposal].tone}`}>{PROPOSAL[l.proposal].label}</span>
              </div>
              <p className="num text-xs text-muted">{kes(l.amountPerPayment)} {RHYTHM_LABEL[plan.rhythm]} × {l.payments} · owed {kes(l.balance)}</p>
              {l.proposal !== "not_sent" ? (
                <label className="flex items-center gap-2 text-xs text-muted">Their reply:
                  <select className="rounded border border-line bg-card px-1 py-0.5" value={l.proposal} onChange={(e) => save({ lenders: plan.lenders.map((x, j) => (j === i ? { ...x, proposal: e.target.value as ProposalStatus } : x)) })}>
                    {(["sent", "accepted", "countered", "declined"] as ProposalStatus[]).map((s) => <option key={s} value={s}>{PROPOSAL[s].label}</option>)}
                  </select>
                </label>
              ) : null}
              {l.proposal === "declined" ? <p className="text-xs text-muted">The rest of your plan goes ahead. Keep paying this lender what you can, and talk to your coach: a lender may not shame you or contact your family, friends or employer about the debt.</p> : null}
              {l.proposal === "countered" ? <p className="text-xs text-muted">Your coach will rebalance the plan and check it with you before anything changes.</p> : null}
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted">Lenders on the Creditor Code reply within 5 working days. We follow up the others on day 5 and day 10.</p>
      </section>

      <section className="card text-sm">
        <p className="font-semibold">If a collector calls</p>
        <p className="mt-1 text-muted">Say: <b className="text-foreground">&ldquo;I am on an Afueni plan, reference {plan.ref}.&rdquo;</b> Or forward their message to us on WhatsApp.</p>
      </section>

      <div className="grid grid-cols-2 gap-2">
        <Link href="/plan/pause" className="card block text-sm"><b>Afueni Pause</b><span className="block text-xs text-muted">Breathing space after a shock</span></Link>
        <Link href="/plan/clean-slate" className="card block text-sm"><b>Afueni Clean Slate</b><span className="block text-xs text-muted">Check and fix your CRB record</span></Link>
      </div>

      {!done ? (
        <button className="w-full text-xs text-muted underline" onClick={() => { if (confirm("Leave your One Plan? We will tell your lenders the plan has ended.")) save({ status: "ended" }); }}>Leave my plan</button>
      ) : null}
    </div>
  );
}

// ---------- K. Finishing: Afueni Keep and Graduates ----------

function Finished({ plan, save }: { plan: OnePlan; save: (p: Partial<OnePlan>) => void }) {
  const p = progress(plan);
  return (
    <>
      <section className="card space-y-2 border-good">
        <p className="font-semibold text-good">Every loan in your plan is paid</p>
        <p className="text-sm text-muted">We are asking each lender to report your account as settled and to send your clearance certificate. We pull your CRB report again in a month to check.</p>
      </section>
      <section className="card space-y-2">
        <p className="font-semibold">Afueni Keep</p>
        <p className="text-sm text-muted">Keep paying <b className="num text-foreground">{kes(plan.amount)}</b> {RHYTHM_LABEL[plan.rhythm]}, but into your own locked savings. The habit that got you out becomes the buffer that keeps you out. Optional, and you can stop any time.</p>
        <p className="text-xs text-warn">Coming soon: we are choosing a regulated savings partner. Tick below and we&apos;ll tell you when it opens.</p>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={!!plan.keep?.optedIn} onChange={(e) => save({ keep: { optedIn: e.target.checked, at: new Date().toISOString() } })} />
          Tell me when Afueni Keep opens
        </label>
      </section>
      {graduateEligible({ completed: true, monthsOnTime: p.monthsOnTime }) ? (
        <Link href="/graduates" className="card block text-sm"><b>You can join Afueni Graduates</b><span className="block text-xs text-muted">Show partner banks you pay, on your terms</span></Link>
      ) : null}
    </>
  );
}

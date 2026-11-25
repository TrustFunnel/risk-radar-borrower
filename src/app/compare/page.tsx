"use client";

import Link from "next/link";
import { Fragment, useMemo, useState } from "react";
import products from "@/data/lender-products.json";
import { allOffers, compareLoan, detailsOf, quoteOffer, type LoanComparison, type Offer, type Quote } from "@/lib/compare";
import { kes } from "@/lib/finance";
import { DEFAULT_FEE_PCT, KIND_LABEL, type LenderProduct, type ProductKind } from "@/lib/market";
import { latestCrb } from "@/lib/myPlan";
import { canRefinance } from "@/lib/oneplan";
import { useDb } from "@/lib/useStore";
import { ChevronDown, CompareIcon, InfoIcon, PlanIcon, PlusIcon, ScaleIcon, SearchIcon, SparkleIcon } from "@/components/Icons";
import { IconTile, More, PageHeader } from "@/components/ui";

const offers = allOffers(products as LenderProduct[]);
const lastChecked = offers.map((o) => o.checkedOn).sort().at(-1);
const KINDS = Object.keys(KIND_LABEL) as ProductKind[];
const SHOWN = 5;

export default function Compare() {
  const { db, ready } = useDb();
  const [feePct, setFeePct] = useState(String(DEFAULT_FEE_PCT));
  const f = Number(feePct) || 0;
  const comparisons = useMemo(
    () => db.loans.filter((l) => l.status !== "closed").map((l) => compareLoan(l, offers, f)),
    [db.loans, f],
  );

  const eligible = canRefinance(db.loans, latestCrb(db));

  // Cheaper lenders are only shown to borrowers who could get them: banks do
  // not refinance listed or arrears borrowers, and showing them raises false
  // hope (strategy doc, section 7).
  if (ready && !eligible.ok) {
    return (
      <div className="mx-auto max-w-3xl space-y-5 py-2">
        <PageHeader icon={CompareIcon} title="Compare prices" />
        <section className="card space-y-4">
          <div className="flex items-start gap-3">
            <IconTile icon={ScaleIcon} tone="warn" />
            <div>
              <p className="text-lg font-bold">A cheaper loan is unlikely right now</p>
              <p className="mt-1 text-sm text-muted">{eligible.reason}</p>
            </div>
          </div>
          <More>Taking a new loan to pay an old one usually makes things worse. Afueni One Plan works with the lenders you already have, and Clean Slate can fix a wrong listing. Lender prices open here again once you are up to date.</More>
          <div className="grid gap-2 sm:grid-cols-2"><Link href="/plan" className="btn"><PlanIcon className="h-5 w-5" />See my One Plan</Link><Link href="/plan/clean-slate" className="btn-ghost"><SparkleIcon className="h-5 w-5" />Clean Slate</Link></div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6 py-2">
      <PageHeader icon={CompareIcon} title="Compare prices" sub="Other lenders, same kind of loan. Tap one to see every cost." />

      {!ready ? null : comparisons.length ? (
        comparisons.map((c) => <LoanCompare key={c.loan.id} c={c} />)
      ) : (
        <section className="card">
          <p className="font-semibold">Add your loans to compare them</p>
          <p className="mt-1 text-sm text-muted">Once your loans are in your wallet, we show how each one compares with the same product at other lenders.</p>
          <Link href="/loans/new" className="btn mt-3"><PlusIcon className="h-5 w-5" />Add a loan</Link>
        </section>
      )}

      <Shop feePct={feePct} setFeePct={setFeePct} />

      <p className="mx-auto flex max-w-2xl gap-2 text-xs text-muted">
        <InfoIcon className="h-4 w-4 shrink-0" />Bank rates from the Kenya Bankers Association Total Cost of Credit report{lastChecked ? `, collected ${lastChecked}` : ""}. Mobile lender and SACCO prices are from each lender&apos;s own page. Always confirm the final quote with the lender.
      </p>
    </div>
  );
}

function LoanCompare({ c }: { c: LoanComparison }) {
  const [all, setAll] = useState(false);
  const mobile = c.kind === "mobile";
  const usable = c.rows.filter((r) => !r.quote.overLimit && !r.yours);
  // Lead with a lender anyone can apply to; SACCOs need membership first.
  const best = usable.find((r) => r.offer.lenderType !== "sacco");
  const sacco = usable[0]?.offer.lenderType === "sacco" && usable[0].saving > (best?.saving ?? 0) ? usable[0] : undefined;
  const rows = all ? c.rows : c.rows.slice(0, SHOWN);

  return (
    <section className="space-y-3">
      <div className="hero">
        <div className="flex items-center justify-between gap-2">
          <p className="min-w-0 truncate text-lg font-bold">{c.loan.lender}</p>
          <span className="hero-chip shrink-0">{KIND_LABEL[c.kind]}</span>
        </div>
        <p className="num hero-muted mt-1 text-sm">
          {mobile
            ? `Borrowing ${kes(c.amount)} for 30 days costs you ${kes(c.current.totalCost)}.`
            : `${kes(c.amount)} left over ${c.months} month${c.months === 1 ? "" : "s"} at ${kes(c.current.monthly)}/month, about ${kes(c.current.totalCost)} still to pay in interest and charges.`}
        </p>
        {best ? (
          best.saving > 0 ? (
            <p className="mt-3 rounded-2xl bg-white/[0.07] px-4 py-3 text-[0.9375rem] ring-1 ring-white/10">
              <span className="font-semibold text-[#5ee0a6]">{best.offer.lender}</span> would cost about <span className="num font-bold text-[#5ee0a6]">{kes(best.saving)} less</span>{mobile ? " for the same 30 days." : " over the same months."}
              {sacco ? <> If you can join <span className="font-semibold">{sacco.offer.lender}</span>, it could save <span className="num">{kes(sacco.saving)}</span>.</> : null}
            </p>
          ) : (
            <p className="mt-3 text-sm text-[#5ee0a6]">You already have one of the cheapest {KIND_LABEL[c.kind].toLowerCase()}s we track.</p>
          )
        ) : <p className="hero-muted mt-2 text-sm">We don&apos;t track other lenders for this kind of loan yet.</p>}
      </div>

      <ul className="grid gap-3 lg:grid-cols-2">
        {rows.map((r, i) => (
          <OfferRow key={r.offer.id} offer={r.offer} quote={r.quote} amount={c.amount} months={c.months} rank={i}
            saving={r.yours ? undefined : r.saving} yours={r.yours} />
        ))}
      </ul>
      {c.rows.length > SHOWN ? (
        <button className="btn-ghost w-full" onClick={() => setAll(!all)}>
          {all ? "Show fewer" : `Show all ${c.rows.length} lenders`}
        </button>
      ) : null}
    </section>
  );
}

function Shop({ feePct, setFeePct }: { feePct: string; setFeePct: (v: string) => void }) {
  const [kind, setKind] = useState<ProductKind>("personal");
  const [amount, setAmount] = useState("200000");
  const [months, setMonths] = useState("24");
  const [all, setAll] = useState(false);
  const a = Number(amount) || 0;
  const m = kind === "mobile" ? 1 : Math.max(1, Number(months) || 1);
  const f = Number(feePct) || 0;
  const rows = useMemo(
    () => offers
      .filter((o) => o.kind === kind)
      .map((offer) => ({ offer, quote: quoteOffer(offer, a, m, f) }))
      .sort((x, y) => Number(x.quote.overLimit) - Number(y.quote.overLimit) || x.quote.totalCost - y.quote.totalCost),
    [kind, a, m, f],
  );
  const shown = all ? rows : rows.slice(0, SHOWN);

  return (
    <section className="space-y-3 border-t border-line pt-6">
      <h2 className="flex items-center gap-2 text-xl font-bold"><SearchIcon className="h-5 w-5 text-brand" />Shopping for a new loan?</h2>
      <div className="glass grid grid-cols-2 gap-3 rounded-[1.25rem] p-4 sm:grid-cols-4">
        <label className="block"><span className="label">Loan type</span>
          <select className="input" value={kind} onChange={(e) => { setKind(e.target.value as ProductKind); setAll(false); }}>
            {KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
          </select>
        </label>
        <label className="block"><span className="label">I need (KES)</span><input className="input num" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))} /></label>
        {kind === "mobile" ? (
          <label className="block"><span className="label">Repay over</span><input className="input" value="30 days" disabled /></label>
        ) : (
          <label className="block"><span className="label">Repay over (months)</span><input className="input num" inputMode="numeric" value={months} onChange={(e) => setMonths(e.target.value.replace(/[^\d]/g, ""))} /></label>
        )}
        <label className="block"><span className="label">Bank fees (% of loan)</span><input className="input num" inputMode="decimal" value={feePct} onChange={(e) => setFeePct(e.target.value.replace(/[^\d.]/g, ""))} /></label>
      </div>
      <More label="About fees">
        Banks report interest only, so we add {f}% for processing, insurance and excise duty; change it if your lender quotes differently. This applies to your loans above too.
        Lenders with their own published fees use those instead.
      </More>
      <ul className="grid gap-3 lg:grid-cols-2">
        {shown.map(({ offer, quote }, i) => <OfferRow key={offer.id} offer={offer} quote={quote} amount={a} months={m} rank={i} />)}
      </ul>
      {rows.length > SHOWN ? (
        <button className="btn-ghost w-full" onClick={() => setAll(!all)}>{all ? "Show fewer" : `Show all ${rows.length} lenders`}</button>
      ) : null}
    </section>
  );
}

const pct = (x: number) => `${x.toFixed(x < 10 ? 2 : 1).replace(/\.?0+$/, "")}%`;

function OfferRow({ offer, quote, amount, months, rank, saving, yours }: {
  offer: Offer; quote: Quote; amount: number; months: number; rank: number; saving?: number; yours?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const mobile = offer.kind === "mobile";
  const range = offer.rateMin != null && offer.rateMax != null && offer.rateMin !== offer.rateMax ? `${pct(offer.rateMin)} to ${pct(offer.rateMax)}` : null;

  return (
    <li className={`card !p-4 ${open ? "!border-gold lg:col-span-2" : ""}`}>
      <button className="block w-full text-left" onClick={() => setOpen(!open)} aria-expanded={open}>
        <div className="flex items-baseline justify-between gap-2">
          <p className="min-w-0 truncate font-semibold">
            {yours ? <span className="badge mr-1.5 align-middle">Your lender</span>
              : rank === 0 && !quote.overLimit ? <span className="badge badge-solid mr-1.5 align-middle">Cheapest</span> : null}
            {offer.lender}
          </p>
          <p className="num shrink-0 font-bold">{pct(offer.rate)}</p>
        </div>
        <p className="mt-0.5 text-xs text-muted">{offer.detail?.product ?? offer.product} · {pct(offer.rate)} {offer.rateNote}{range ? `, range ${range}` : ""}</p>
        <div className="num mt-3 grid grid-cols-2 rounded-xl bg-raised px-3 py-2 text-sm font-medium">
          <span>{mobile ? `Repay ${kes(quote.monthly)}` : `${kes(quote.monthly)}/month`}</span>
          <span className="text-right">Cost {kes(quote.totalCost)}</span>
        </div>
        <div className="mt-1 flex items-center justify-between gap-2 text-xs">
          {quote.overLimit ? <span className="badge badge-warn">Above this lender&apos;s limit</span>
            : saving == null ? <span />
            : saving > 0 ? <span className="badge badge-good num">Save {kes(saving)}</span>
            : <span className="badge badge-bad num">{kes(-saving)} more than now</span>}
          <span className="inline-flex items-center gap-1 font-semibold text-brand">{open ? "Hide" : "Details"}<ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} /></span>
        </div>
      </button>
      {open ? <OfferDetails offer={offer} quote={quote} amount={amount} months={months} /> : null}
    </li>
  );
}

function OfferDetails({ offer, quote, amount, months }: { offer: Offer; quote: Quote; amount: number; months: number }) {
  const d = detailsOf(offer);
  const mobile = offer.kind === "mobile";
  const facts = [
    ["Product", d.product],
    ["Amount", d.amount],
    ["Repayment period", d.term],
    ["Security", d.security],
    ["Turnaround", d.turnaround + (d.turnaroundTypical ? " (typical, not confirmed for this lender)" : "")],
  ].filter(([, v]) => v) as [string, string][];

  return (
    <div className="mt-3 space-y-3 border-t border-line pt-3 text-sm">
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        {facts.map(([k, v]) => <Fragment key={k}><dt className="text-muted">{k}</dt><dd>{v}</dd></Fragment>)}
      </dl>

      <div>
        <p className="font-semibold">What you&apos;ll need</p>
        {d.requirementsTypical ? <p className="text-xs text-muted">We haven&apos;t checked this lender&apos;s own list yet. Most lenders of this kind ask for:</p> : null}
        <ul className="mt-1 list-disc space-y-0.5 pl-5">{d.requirements.map((r) => <li key={r}>{r}</li>)}</ul>
      </div>

      <div>
        <p className="font-semibold">Costs</p>
        <ul className="mt-1 space-y-1">
          {d.costs.some((c) => /^interest$|loan rate|loan fee/i.test(c.name)) ? null : (
            <li className="flex justify-between gap-3"><span className="text-muted">Interest rate</span><span className="num text-right">{pct(offer.rate)} {offer.rateNote}{offer.quotedRate ? `; we price at ${pct(offer.quotedRate)}, the middle of the range` : ""}</span></li>
          )}
          {d.costs.map((c) => <li key={c.name} className="flex justify-between gap-3"><span className="text-muted">{c.name}</span><span className="text-right">{c.value}</span></li>)}
          <li className="flex justify-between gap-3 border-t border-line pt-1 font-semibold">
            <span>Total cost on {kes(amount)}{mobile ? " for 30 days" : ` over ${months} months`}</span><span className="num">{kes(quote.totalCost)}</span>
          </li>
        </ul>
        {!offer.feesKnown ? <p className="mt-1 text-xs text-muted">Includes our assumed fees for processing, insurance and excise duty.</p> : null}
        {d.costsTypical ? <p className="mt-1 text-xs text-muted">Fees above are what lenders of this kind usually charge; we haven&apos;t checked this lender&apos;s own fees yet.</p> : null}
        {d.otherCosts.length ? (
          <p className="mt-2 text-xs text-muted">Also ask about: {d.otherCosts.map((c) => `${c.name.toLowerCase()} (${c.value.charAt(0).toLowerCase()}${c.value.slice(1)})`).join("; ")}.</p>
        ) : null}
      </div>

      {d.notes.length ? (
        <div>
          <p className="font-semibold">Good to know</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">{d.notes.map((n) => <li key={n}>{n}</li>)}</ul>
        </div>
      ) : null}

      <p className="text-[11px] text-muted">
        <a href={offer.sourceUrl} target="_blank" rel="noreferrer" className="underline">{offer.feesKnown ? "Lender's page" : "KBA report"}</a>
        {offer.rateUpdatedOn ? `, rate updated by the lender ${offer.rateUpdatedOn}` : ""}
        {d.sourceUrl && d.sourceUrl !== offer.sourceUrl ? <>{" · "}<a href={d.sourceUrl} target="_blank" rel="noreferrer" className="underline">Lender&apos;s product page</a></> : null}
        {`, checked ${offer.detail?.checkedOn ?? offer.checkedOn}`}
      </p>
    </div>
  );
}

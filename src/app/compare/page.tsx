"use client";

import Link from "next/link";
import { Fragment, useMemo, useState } from "react";
import products from "@/data/lender-products.json";
import { allOffers, compareLoan, detailsOf, quoteOffer, type LoanComparison, type Offer, type Quote } from "@/lib/compare";
import { kes } from "@/lib/finance";
import { DEFAULT_FEE_PCT, KIND_LABEL, type LenderProduct, type ProductKind } from "@/lib/market";
import { useDb } from "@/lib/useStore";

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

  return (
    <div className="space-y-4 py-2">
      <h1 className="text-xl font-bold">Compare your loans</h1>
      <p className="text-sm text-muted">
        How other lenders price the same kind of loan you hold, on what you still owe. Tap a lender to see what they ask for, how fast they pay out, and every cost.
      </p>

      {!ready ? null : comparisons.length ? (
        comparisons.map((c) => <LoanCompare key={c.loan.id} c={c} />)
      ) : (
        <section className="card">
          <p className="font-semibold">Add your loans to compare them</p>
          <p className="mt-1 text-sm text-muted">Once your loans are in your wallet, we show how each one compares with the same product at other lenders.</p>
          <Link href="/loans/new" className="btn mt-3">Add a loan</Link>
        </section>
      )}

      <Shop feePct={feePct} setFeePct={setFeePct} />

      <p className="text-center text-xs text-muted">
        Bank rates from the Kenya Bankers Association Total Cost of Credit report{lastChecked ? `, collected ${lastChecked}` : ""}. Mobile lender and SACCO prices are from each lender&apos;s own page. Always confirm the final quote with the lender.
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
    <section className="space-y-2">
      <div className="card border-brand/40">
        <div className="flex items-baseline justify-between gap-2">
          <p className="min-w-0 truncate font-semibold">{c.loan.lender}</p>
          <span className="shrink-0 rounded bg-brand-soft px-1.5 py-0.5 text-xs text-brand">{KIND_LABEL[c.kind]}</span>
        </div>
        <p className="num mt-1 text-sm text-muted">
          {mobile
            ? `Borrowing ${kes(c.amount)} for 30 days costs you ${kes(c.current.totalCost)}.`
            : `${kes(c.amount)} left over ${c.months} month${c.months === 1 ? "" : "s"} at ${kes(c.current.monthly)}/month, about ${kes(c.current.totalCost)} still to pay in interest and charges.`}
        </p>
        {best ? (
          best.saving > 0 ? (
            <p className="mt-2 text-sm">
              <span className="font-semibold text-good">{best.offer.lender}</span> would cost about <span className="num font-semibold text-good">{kes(best.saving)} less</span>{mobile ? " for the same 30 days." : " over the same months."}
              {sacco ? <> If you can join <span className="font-semibold">{sacco.offer.lender}</span>, it could save <span className="num">{kes(sacco.saving)}</span>.</> : null}
            </p>
          ) : (
            <p className="mt-2 text-sm text-good">You already have one of the cheapest {KIND_LABEL[c.kind].toLowerCase()}s we track.</p>
          )
        ) : <p className="mt-2 text-sm text-muted">We don&apos;t track other lenders for this kind of loan yet.</p>}
      </div>

      <ul className="space-y-2">
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
    <section className="space-y-2 pt-2">
      <h2 className="text-lg font-bold">Shopping for a new loan?</h2>
      <div className="card grid grid-cols-2 gap-3 sm:grid-cols-4">
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
      <p className="text-xs text-muted">
        Banks report interest only, so we add {f}% for processing, insurance and excise duty; change it if your lender quotes differently. This applies to your loans above too.
        Lenders with their own published fees use those instead.
      </p>
      <ul className="space-y-2">
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
    <li className={`card ${open ? "border-brand/60" : ""}`}>
      <button className="block w-full text-left" onClick={() => setOpen(!open)} aria-expanded={open}>
        <div className="flex items-baseline justify-between gap-2">
          <p className="min-w-0 truncate font-semibold">
            {yours ? <span className="mr-1 rounded bg-raised px-1.5 py-0.5 text-xs text-muted">Your lender</span>
              : rank === 0 && !quote.overLimit ? <span className="mr-1 rounded bg-brand-soft px-1.5 py-0.5 text-xs text-brand">Cheapest</span> : null}
            {offer.lender}
          </p>
          <p className="num shrink-0 font-bold">{pct(offer.rate)}</p>
        </div>
        <p className="text-xs text-muted">{offer.detail?.product ?? offer.product} · {pct(offer.rate)} {offer.rateNote}{range ? `, range ${range}` : ""}</p>
        <div className="num mt-2 grid grid-cols-2 text-sm">
          <span>{mobile ? `Repay ${kes(quote.monthly)}` : `${kes(quote.monthly)}/month`}</span>
          <span className="text-right">Cost {kes(quote.totalCost)}</span>
        </div>
        <div className="mt-1 flex items-center justify-between gap-2 text-xs">
          {quote.overLimit ? <span className="text-warn">Above this lender&apos;s limit</span>
            : saving == null ? <span />
            : saving > 0 ? <span className="num font-semibold text-good">Save {kes(saving)}</span>
            : <span className="num text-bad">{kes(-saving)} more than now</span>}
          <span className="text-brand">{open ? "Hide details ▲" : "Details ▼"}</span>
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

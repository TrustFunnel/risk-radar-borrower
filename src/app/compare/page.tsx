"use client";

import { useMemo, useState } from "react";
import lenders from "@/data/lenders.json";
import products from "@/data/lender-products.json";
import { kes } from "@/lib/finance";
import { DEFAULT_FEE_PCT, quote, type LenderProduct } from "@/lib/market";
import type { LenderType } from "@/lib/types";

const all = products as LenderProduct[];

export default function Compare() {
  const [amount, setAmount] = useState("200000");
  const [months, setMonths] = useState("24");
  const [type, setType] = useState<LenderType | "all">("all");
  const [feePct, setFeePct] = useState(String(DEFAULT_FEE_PCT));
  const a = Number(amount) || 0;
  const m = Math.max(1, Number(months) || 1);
  const f = Number(feePct) || 0;

  const rows = useMemo(
    () => all
      .filter((p) => type === "all" || p.lenderType === type)
      .map((p) => ({ p, q: quote(p, a, m, f) }))
      .sort((x, y) => x.q.apr - y.q.apr),
    [a, m, f, type],
  );
  const pending = (lenders as { id: string; name: string; type: LenderType }[]).filter((l) => type === "all" || l.type === type);
  const lastChecked = all.map((p) => p.checkedOn).sort().at(-1);

  return (
    <div className="space-y-4 py-2">
      <h1 className="text-xl font-bold">Compare loan costs</h1>
      <p className="text-sm text-muted">
        Personal loan rates that {all.length} Kenyan banks and microfinance banks report to the Kenya Bankers Association, ranked by what your loan would really cost.
      </p>

      <section className="card grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label className="block"><span className="label">I need (KES)</span><input className="input num" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))} /></label>
        <label className="block"><span className="label">Repay over (months)</span><input className="input num" inputMode="numeric" value={months} onChange={(e) => setMonths(e.target.value.replace(/[^\d]/g, ""))} /></label>
        <label className="block"><span className="label">Lender type</span>
          <select className="input" value={type} onChange={(e) => setType(e.target.value as LenderType | "all")}>
            <option value="all">All</option><option value="bank">Banks</option><option value="mfi">Microfinance banks</option>
          </select>
        </label>
        <label className="block"><span className="label">Assumed fees (% of loan)</span><input className="input num" inputMode="decimal" value={feePct} onChange={(e) => setFeePct(e.target.value.replace(/[^\d.]/g, ""))} /></label>
      </section>
      <p className="text-xs text-muted">
        Banks report interest only. We add {f}% for processing, insurance and excise duty so the totals are realistic; change it if your lender quotes differently.
        A low average can include secured loans (backed by a deposit, logbook or title), so check the range.
      </p>

      <ul className="space-y-2">
        {rows.map(({ p, q }, i) => (
          <li key={p.lenderId} className="card">
            <div className="flex items-baseline justify-between gap-2">
              <p className="min-w-0 truncate font-semibold">{i === 0 ? <span className="mr-1 rounded bg-brand-soft px-1.5 py-0.5 text-xs text-brand">Cheapest</span> : null}{p.lender}</p>
              <p className="num shrink-0 font-bold">{p.rate.toFixed(2)}%</p>
            </div>
            <p className="text-xs text-muted">
              Average personal loan rate{p.rateMin != null && p.rateMax != null && p.rateMin !== p.rateMax ? `, range ${p.rateMin.toFixed(1)}% to ${p.rateMax.toFixed(1)}%` : ""}
            </p>
            <div className="num mt-2 grid grid-cols-2 text-sm">
              <span>{kes(q.installment)}/month</span>
              <span className="text-right">Total cost {kes(q.totalCost)}</span>
            </div>
            <a href={p.sourceUrl} target="_blank" rel="noreferrer" className="mt-1 block text-[11px] text-muted underline">
              KBA report{p.rateUpdatedOn ? `, updated by the bank ${p.rateUpdatedOn}` : ""}
            </a>
          </li>
        ))}
      </ul>

      {pending.length ? (
        <section className="card">
          <h2 className="text-sm font-medium text-muted">Not in the KBA report</h2>
          <p className="mt-1 text-sm">{pending.map((l) => l.name).join(", ")}</p>
          <p className="mt-2 text-xs text-muted">SACCOs and mobile lenders don&apos;t report to KBA, and many only show rates inside their apps. Loans you add to your wallet help us fill these gaps, anonymised.</p>
        </section>
      ) : null}
      {lastChecked ? <p className="text-center text-xs text-muted">Collected {lastChecked} from the Kenya Bankers Association Total Cost of Credit site. Always confirm the final quote with the lender.</p> : null}
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import lenders from "@/data/lenders.json";
import products from "@/data/lender-products.json";
import { kes } from "@/lib/finance";
import { fits, quote, type LenderProduct } from "@/lib/market";
import { LENDER_TYPES, type LenderType } from "@/lib/types";

const all = products as LenderProduct[];

export default function Compare() {
  const [amount, setAmount] = useState("50000");
  const [months, setMonths] = useState("12");
  const [type, setType] = useState<LenderType | "all">("all");
  const a = Number(amount) || 0;
  const m = Math.max(1, Number(months) || 1);

  const rows = useMemo(
    () => all
      .filter((p) => (type === "all" || p.lenderType === type) && fits(p, a, m))
      .map((p) => ({ p, q: quote(p, a, m) }))
      .sort((x, y) => x.q.apr - y.q.apr),
    [a, m, type],
  );
  const priced = new Set(all.map((p) => p.lenderId));
  const pending = (lenders as { id: string; name: string; type: LenderType }[]).filter((l) => !priced.has(l.id) && (type === "all" || l.type === type));
  const lastChecked = all.map((p) => p.checkedOn).sort().at(-1);

  return (
    <div className="space-y-4 py-2">
      <h1 className="text-xl font-bold">Compare loan costs</h1>
      <p className="text-sm text-muted">Ranked by true APR, which counts interest and upfront fees, so a flat rate or a 30-day charge compares fairly with a bank rate.</p>

      <section className="card grid grid-cols-2 gap-3 sm:grid-cols-3">
        <label className="block"><span className="label">I need (KES)</span><input className="input num" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))} /></label>
        <label className="block"><span className="label">Repay over (months)</span><input className="input num" inputMode="numeric" value={months} onChange={(e) => setMonths(e.target.value.replace(/[^\d]/g, ""))} /></label>
        <label className="col-span-2 block sm:col-span-1"><span className="label">Lender type</span>
          <select className="input" value={type} onChange={(e) => setType(e.target.value as LenderType | "all")}>
            <option value="all">All lenders</option>
            {LENDER_TYPES.filter((t) => t.value !== "chama" && t.value !== "other").map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </label>
      </section>

      {rows.length ? (
        <ul className="space-y-2">
          {rows.map(({ p, q }, i) => (
            <li key={`${p.lenderId}-${p.product}`} className="card">
              <div className="flex items-baseline justify-between gap-2">
                <p className="truncate font-semibold">{i === 0 ? <span className="mr-1 rounded bg-brand-soft px-1.5 py-0.5 text-xs text-brand">Cheapest</span> : null}{p.lender}</p>
                <p className={`num font-bold ${q.apr > 100 ? "text-bad" : ""}`}>{q.apr.toFixed(1)}% APR</p>
              </div>
              <p className="text-xs text-muted">{p.product}{p.collateral ? ` · ${p.collateral}` : ""}</p>
              <div className="num mt-2 grid grid-cols-2 text-sm">
                <span>Repayment {kes(q.installment)}{q.terms.frequency === "bullet" ? " once" : "/month"}</span>
                <span className="text-right">Total cost {kes(q.totalCost)}</span>
              </div>
              <a href={p.sourceUrl} target="_blank" rel="noreferrer" className="mt-1 block text-[11px] text-muted underline">Source, checked {p.checkedOn}</a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="card text-sm text-muted">{all.length ? "No published product fits that amount and term." : "Lender prices are being collected. The first weekly update will fill this page."}</p>
      )}

      {pending.length ? (
        <section className="card">
          <h2 className="text-sm font-medium text-muted">Prices not yet published or not yet collected</h2>
          <p className="mt-1 text-sm">{pending.map((l) => l.name).join(", ")}</p>
          <p className="mt-2 text-xs text-muted">Many digital lenders only show rates inside their apps. Loans you add to your wallet help us fill these gaps, anonymised.</p>
        </section>
      ) : null}
      {lastChecked ? <p className="text-center text-xs text-muted">Prices last checked {lastChecked}. Always confirm with the lender before you borrow.</p> : null}
    </div>
  );
}

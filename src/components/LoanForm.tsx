"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { apr, installment, kes, totalCostOfCredit, type Frequency, type LoanTerms, type RateType } from "@/lib/finance";
import { store } from "@/lib/store";
import { LENDER_TYPES, type Loan, type LenderType, type LoanStatus } from "@/lib/types";

const RATE_TYPES: { value: RateType; label: string }[] = [
  { value: "reducing_annual", label: "% per year, reducing balance (most banks)" },
  { value: "flat_annual", label: "% per year, flat" },
  { value: "flat_monthly", label: "% per month, flat" },
  { value: "per_term", label: "% for the whole loan (e.g. 10% for 30 days)" },
];

const today = () => new Date().toISOString().slice(0, 10);

type Form = {
  lender: string; lenderType: LenderType; productName: string;
  principal: string; frequency: Frequency; installments: string; termDays: string;
  knowsInstallment: boolean; installmentAmount: string; rate: string; rateType: RateType;
  upfrontFees: string; disbursedOn: string; firstDueDate: string;
  outstandingBalance: string; arrearsDays: string; status: LoanStatus; notes: string;
};

function toForm(l?: Loan): Form {
  return {
    lender: l?.lender ?? "", lenderType: l?.lenderType ?? "bank", productName: l?.productName ?? "",
    principal: l ? String(l.terms.principal) : "", frequency: l?.terms.frequency ?? "monthly",
    installments: l ? String(l.terms.installments) : "12", termDays: String(l?.terms.termDays ?? 30),
    knowsInstallment: l ? !!l.terms.installmentAmount : true,
    installmentAmount: l?.terms.installmentAmount ? String(l.terms.installmentAmount) : "",
    rate: l ? String(l.terms.rate) : "", rateType: l?.terms.rateType ?? "reducing_annual",
    upfrontFees: l?.terms.upfrontFees ? String(l.terms.upfrontFees) : "",
    disbursedOn: l?.disbursedOn ?? today(), firstDueDate: l?.firstDueDate ?? today(),
    outstandingBalance: l?.outstandingBalance != null ? String(l.outstandingBalance) : "",
    arrearsDays: String(l?.arrearsDays ?? 0), status: l?.status ?? "current", notes: l?.notes ?? "",
  };
}

const n = (s: string) => Number(s.replace(/[^\d.]/g, "")) || 0;

function toTerms(f: Form): LoanTerms {
  return {
    principal: n(f.principal),
    rate: f.knowsInstallment ? 0 : n(f.rate),
    rateType: f.rateType,
    frequency: f.frequency,
    installments: f.frequency === "bullet" ? 1 : Math.max(1, Math.round(n(f.installments))),
    termDays: f.frequency === "bullet" ? Math.max(1, n(f.termDays)) : undefined,
    upfrontFees: n(f.upfrontFees) || undefined,
    installmentAmount: f.knowsInstallment ? n(f.installmentAmount) || undefined : undefined,
  };
}

export type LoanDraft = Partial<Pick<Form, "lender" | "lenderType" | "principal" | "outstandingBalance" | "arrearsDays" | "status" | "disbursedOn" | "notes">>;

export function LoanForm({ loan, draft }: { loan?: Loan; draft?: LoanDraft }) {
  const router = useRouter();
  const [f, setF] = useState<Form>(() => ({ ...toForm(loan), ...draft }));
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));
  const terms = useMemo(() => toTerms(f), [f]);
  const valid = f.lender.trim() && terms.principal > 0 && (f.knowsInstallment ? (terms.installmentAmount ?? 0) > 0 : terms.rate > 0);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    store.saveLoan({
      id: loan?.id,
      lender: f.lender.trim(), lenderType: f.lenderType, productName: f.productName.trim() || undefined,
      terms, disbursedOn: f.disbursedOn, firstDueDate: f.frequency === "bullet" ? addDays(f.disbursedOn, terms.termDays ?? 30) : f.firstDueDate,
      outstandingBalance: f.outstandingBalance.trim() === "" ? undefined : n(f.outstandingBalance),
      arrearsDays: Math.round(n(f.arrearsDays)), status: f.status, notes: f.notes.trim() || undefined,
    });
    router.push("/loans");
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <section className="card grid gap-3 sm:grid-cols-2">
        <Field label="Lender"><input className="input" value={f.lender} onChange={(e) => set("lender", e.target.value)} placeholder="e.g. KCB, Stima SACCO, Tala" required /></Field>
        <Field label="Type of lender">
          <select className="input" value={f.lenderType} onChange={(e) => set("lenderType", e.target.value as LenderType)}>
            {LENDER_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </Field>
        <Field label="Loan product (optional)"><input className="input" value={f.productName} onChange={(e) => set("productName", e.target.value)} placeholder="e.g. Salary advance" /></Field>
        <Field label="Amount borrowed (KES)"><input className="input num" inputMode="decimal" value={f.principal} onChange={(e) => set("principal", e.target.value)} required /></Field>
      </section>

      <section className="card grid gap-3 sm:grid-cols-2">
        <Field label="How do you repay?">
          <select className="input" value={f.frequency} onChange={(e) => set("frequency", e.target.value as Frequency)}>
            <option value="monthly">Monthly installments</option>
            <option value="weekly">Weekly installments</option>
            <option value="bullet">All at once on a due date</option>
          </select>
        </Field>
        {f.frequency === "bullet" ? (
          <Field label="Loan length (days)"><input className="input num" inputMode="numeric" value={f.termDays} onChange={(e) => set("termDays", e.target.value)} /></Field>
        ) : (
          <Field label="Number of installments"><input className="input num" inputMode="numeric" value={f.installments} onChange={(e) => set("installments", e.target.value)} /></Field>
        )}
        <div className="sm:col-span-2">
          <span className="label">What do you know about the cost?</span>
          <div className="flex gap-2">
            <button type="button" className={f.knowsInstallment ? "btn" : "btn-ghost"} onClick={() => set("knowsInstallment", true)}>My repayment amount</button>
            <button type="button" className={!f.knowsInstallment ? "btn" : "btn-ghost"} onClick={() => set("knowsInstallment", false)}>The interest rate</button>
          </div>
        </div>
        {f.knowsInstallment ? (
          <Field label={f.frequency === "bullet" ? "Total to repay (KES)" : "Each installment (KES)"}><input className="input num" inputMode="decimal" value={f.installmentAmount} onChange={(e) => set("installmentAmount", e.target.value)} /></Field>
        ) : (
          <>
            <Field label="Interest rate (%)"><input className="input num" inputMode="decimal" value={f.rate} onChange={(e) => set("rate", e.target.value)} /></Field>
            <Field label="Rate is quoted as">
              <select className="input" value={f.rateType} onChange={(e) => set("rateType", e.target.value as RateType)}>
                {RATE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </Field>
          </>
        )}
        <Field label="Fees paid upfront, incl. insurance and excise (KES)"><input className="input num" inputMode="decimal" value={f.upfrontFees} onChange={(e) => set("upfrontFees", e.target.value)} placeholder="0" /></Field>
      </section>

      <section className="card grid gap-3 sm:grid-cols-2">
        <Field label="Date received"><input type="date" className="input" value={f.disbursedOn} onChange={(e) => set("disbursedOn", e.target.value)} /></Field>
        {f.frequency !== "bullet" ? <Field label="First repayment date"><input type="date" className="input" value={f.firstDueDate} onChange={(e) => set("firstDueDate", e.target.value)} /></Field> : null}
        <Field label="Balance on latest statement (KES, optional)"><input className="input num" inputMode="decimal" value={f.outstandingBalance} onChange={(e) => set("outstandingBalance", e.target.value)} /></Field>
        <Field label="Days overdue (0 if up to date)"><input className="input num" inputMode="numeric" value={f.arrearsDays} onChange={(e) => set("arrearsDays", e.target.value)} /></Field>
        <Field label="Status">
          <select className="input" value={f.status} onChange={(e) => set("status", e.target.value as LoanStatus)}>
            <option value="current">Up to date</option><option value="late">Behind on payments</option>
            <option value="defaulted">Defaulted / with collectors</option><option value="closed">Fully paid</option>
          </select>
        </Field>
        <Field label="Notes"><input className="input" value={f.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
      </section>

      {valid ? (
        <section className="card grid grid-cols-3 gap-2 bg-brand-soft text-center">
          <Stat label="Repayment" value={kes(installment(terms))} />
          <Stat label="Total cost of credit" value={kes(totalCostOfCredit(terms))} />
          <Stat label="True APR" value={`${apr(terms).toFixed(1)}%`} />
        </section>
      ) : null}

      <div className="flex gap-2">
        <button className="btn flex-1" disabled={!valid}>{loan ? "Save changes" : "Add loan"}</button>
        {loan ? <button type="button" className="btn-ghost text-bad" onClick={() => { if (confirm("Delete this loan and everything linked to it?")) { store.deleteLoan(loan.id); router.push("/loans"); } }}>Delete</button> : null}
      </div>
    </form>
  );
}

function addDays(iso: string, d: number) {
  const x = new Date(iso + "T00:00:00");
  x.setDate(x.getDate() + d);
  return x.toISOString().slice(0, 10);
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="label">{label}</span>{children}</label>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[11px] text-muted">{label}</p><p className="num text-sm font-bold">{value}</p></div>;
}

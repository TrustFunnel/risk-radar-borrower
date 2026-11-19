// Mapping between app objects and Supabase rows (snake_case, numeric strings).
import type { ConsentRecord, DistressRequest, DocRecord, Loan, MoneyRecord, Profile } from "./types";

type Row = Record<string, unknown>;
const num = (v: unknown) => (v == null ? undefined : Number(v));

export function loanFromRow(r: Row): Loan {
  return {
    id: r.id as string,
    lender: r.lender as string,
    lenderType: r.lender_type as Loan["lenderType"],
    productName: (r.product_name as string) ?? undefined,
    terms: {
      principal: Number(r.principal),
      rate: Number(r.rate),
      rateType: r.rate_type as Loan["terms"]["rateType"],
      frequency: r.frequency as Loan["terms"]["frequency"],
      installments: Number(r.installments),
      termDays: num(r.term_days),
      upfrontFees: num(r.upfront_fees),
      installmentAmount: num(r.installment_amount),
    },
    disbursedOn: r.disbursed_on as string,
    firstDueDate: r.first_due_date as string,
    outstandingBalance: num(r.outstanding_balance),
    arrearsDays: Number(r.arrears_days ?? 0),
    status: r.status as Loan["status"],
    notes: (r.notes as string) ?? undefined,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

export function loanToRow(l: Loan, userId: string): Row {
  return {
    id: l.id,
    user_id: userId,
    lender: l.lender,
    lender_type: l.lenderType,
    product_name: l.productName ?? null,
    principal: l.terms.principal,
    rate: l.terms.rate,
    rate_type: l.terms.rateType,
    frequency: l.terms.frequency,
    installments: l.terms.installments,
    term_days: l.terms.termDays ?? null,
    upfront_fees: l.terms.upfrontFees ?? null,
    installment_amount: l.terms.installmentAmount ?? null,
    disbursed_on: l.disbursedOn,
    first_due_date: l.firstDueDate,
    outstanding_balance: l.outstandingBalance ?? null,
    arrears_days: l.arrearsDays,
    status: l.status,
    notes: l.notes ?? null,
    updated_at: l.updatedAt,
  };
}

export function profileFromRow(r: Row): Profile {
  return {
    displayName: r.display_name as string,
    monthlyIncome: Number(r.monthly_income ?? 0),
    phone: (r.phone as string) ?? undefined,
    essentials: num(r.essentials),
    incomeFlows: (r.income_flows as Profile["incomeFlows"]) ?? undefined,
    incomeSource: (r.income_source as Profile["incomeSource"]) ?? undefined,
    work: (r.work as Profile["work"]) ?? undefined,
  };
}

export function profileToRow(p: Profile, userId: string): Row {
  return {
    user_id: userId,
    display_name: p.displayName,
    monthly_income: p.monthlyIncome,
    phone: p.phone ?? null,
    essentials: p.essentials ?? null,
    income_flows: p.incomeFlows ?? null,
    income_source: p.incomeSource ?? null,
    work: p.work ?? null,
    updated_at: new Date().toISOString(),
  };
}

export const consentFromRow = (r: Row): ConsentRecord => ({
  purpose: r.purpose as ConsentRecord["purpose"],
  granted: !!r.granted,
  version: r.version as string,
  at: r.at as string,
});

export const requestFromRow = (r: Row): DistressRequest => ({
  id: r.id as string,
  loanId: r.loan_id as string,
  goal: r.goal as DistressRequest["goal"],
  message: (r.message as string) ?? "",
  targetLender: (r.target_lender as string) ?? undefined,
  proposedMonthly: num(r.proposed_monthly),
  status: r.status as DistressRequest["status"],
  createdAt: r.created_at as string,
});

export function requestToRow(r: DistressRequest, userId: string): Row {
  return {
    id: r.id,
    user_id: userId,
    loan_id: r.loanId,
    goal: r.goal,
    message: r.message || null,
    target_lender: r.targetLender ?? null,
    proposed_monthly: r.proposedMonthly ?? null,
    status: r.status,
  };
}

export const docFromRow = (r: Row): DocRecord => ({
  id: r.id as string,
  kind: r.kind as DocRecord["kind"],
  fileName: r.file_name as string,
  summary: (r.summary as string) ?? "",
  crb: ((r.parsed as { crb?: DocRecord["crb"] }) ?? {}).crb,
  flows: ((r.parsed as { flows?: DocRecord["flows"] }) ?? {}).flows,
  createdAt: r.created_at as string,
});

export const docToRow = (d: DocRecord, userId: string): Row => ({
  id: d.id,
  user_id: userId,
  kind: d.kind,
  file_name: d.fileName,
  summary: d.summary,
  parsed: { crb: d.crb ?? null, flows: d.flows ?? null },
  created_at: d.createdAt,
});

export const moneyFromRow = (r: Row): MoneyRecord => {
  const m: MoneyRecord = {
    id: r.id as string,
    refHash: r.ref_hash as string,
    source: r.source as MoneyRecord["source"],
    kind: r.kind as MoneyRecord["kind"],
    direction: r.direction as MoneyRecord["direction"],
    amount: Number(r.amount),
    fee: num(r.fee),
    balance: num(r.balance),
    occurredAt: r.occurred_at as string,
    counterparty: (r.counterparty as string) ?? undefined,
    category: r.category as MoneyRecord["category"],
    lender: (r.lender as string) ?? undefined,
    dueDate: (r.due_date as string) ?? undefined,
    outstanding: num(r.outstanding),
    daysOverdue: num(r.days_overdue),
    channel: r.channel as MoneyRecord["channel"],
    createdAt: r.created_at as string,
  };
  for (const k of Object.keys(m) as (keyof MoneyRecord)[]) if (m[k] === undefined) delete m[k];
  return m;
};

export const moneyToRow = (m: MoneyRecord, userId: string): Row => ({
  id: m.id,
  user_id: userId,
  ref_hash: m.refHash,
  source: m.source,
  kind: m.kind,
  direction: m.direction,
  amount: m.amount,
  fee: m.fee ?? null,
  balance: m.balance ?? null,
  occurred_at: m.occurredAt,
  counterparty: m.counterparty ?? null,
  category: m.category,
  lender: m.lender ?? null,
  due_date: m.dueDate ?? null,
  outstanding: m.outstanding ?? null,
  days_overdue: m.daysOverdue ?? null,
  channel: m.channel,
  created_at: m.createdAt,
});

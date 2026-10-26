"use client";

import { kes } from "./finance";
import { parseMpesaStatement } from "./mpesa";
import { pdfLines } from "./pdfText";
import { parseStatementCsv, type MonthFlow } from "./remediation";
import { store } from "./store";
import type { CrbReport } from "./types";

// Reading uploaded documents. PDFs are opened on the phone (with the
// password if there is one); M-Pesa statements and CSVs are read on the
// phone too. CRB reports and bank PDFs differ by bureau and bank, so their
// text goes to /api/extract to be read by Claude. No file is uploaded.

async function extract<T>(body: Record<string, unknown>): Promise<T> {
  const token = await store.token();
  const res = await fetch("/api/extract", {
    method: "POST",
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "We couldn't read that document.");
  return json as T;
}

const isPdf = (f: File) => f.type === "application/pdf" || /\.pdf$/i.test(f.name);

export async function readCrbFile(file: File, password?: string): Promise<CrbReport> {
  if (!isPdf(file)) throw new Error("Upload the PDF report the bureau sent you.");
  const text = (await pdfLines(file, password)).join("\n");
  const r = await extract<{
    bureau: CrbReport["bureau"]; reportDate: string | null; score: number | null; scoreBand: string | null;
    accounts: (Omit<CrbReport["accounts"][number], "openedOn" | "principal"> & { openedOn: string | null; principal: number | null })[];
  }>({ kind: "crb", text });
  return {
    bureau: r.bureau,
    reportDate: r.reportDate ?? undefined,
    score: r.score ?? undefined,
    scoreBand: r.scoreBand ?? undefined,
    accounts: r.accounts.map((a) => ({ ...a, openedOn: a.openedOn ?? undefined, principal: a.principal ?? undefined })),
  };
}

export interface ReadStatement { flows: MonthFlow[]; holder?: string }

export async function readMpesaFile(file: File, code: string): Promise<ReadStatement> {
  if (!isPdf(file)) {
    const flows = parseStatementCsv(await file.text());
    if (!flows.length) throw new Error("We couldn't read that file. Upload the PDF statement Safaricom emailed you.");
    return { flows };
  }
  const s = parseMpesaStatement(await pdfLines(file, code.trim()));
  if (!s.flows.length) throw new Error("This doesn't look like an M-PESA full statement. Upload the PDF Safaricom emailed you.");
  return { flows: s.flows, holder: s.customerName };
}

export async function readBankFile(file: File, password?: string): Promise<ReadStatement> {
  if (!isPdf(file)) {
    const flows = parseStatementCsv(await file.text());
    if (!flows.length) throw new Error("We couldn't read that file. Upload the PDF statement or a CSV with a date column and amounts.");
    return { flows };
  }
  const text = (await pdfLines(file, password)).join("\n");
  const r = await extract<{ bank: string | null; months: MonthFlow[] }>({ kind: "bank", text });
  if (!r.months.length) throw new Error("We couldn't find any transactions in that statement.");
  return { flows: r.months, holder: r.bank ?? undefined };
}

export async function aiIndustry(employer: string, jobTitle: string): Promise<string | null> {
  try {
    return (await extract<{ industry: string }>({ kind: "industry", employer, jobTitle })).industry;
  } catch {
    return null; // the borrower picks it instead
  }
}

export function flowsSummary(flows: MonthFlow[]): string {
  const total = flows.reduce((s, f) => s + f.inflow, 0);
  return `${flows.length} month${flows.length === 1 ? "" : "s"}, ${kes(total)} received`;
}

// Statements feed the affordable plan. When a bank and an M-Pesa statement
// cover the same month, keep the one showing more money in rather than adding
// them: salary paid to the bank and then moved to M-Pesa would count twice.
// Typed-in months are replaced by statement months.
export function mergeFlows(existing: MonthFlow[] | undefined, added: MonthFlow[]): MonthFlow[] {
  const byMonth = new Map((existing ?? []).filter((f) => /^\d{4}-\d{2}$/.test(f.month)).map((f) => [f.month, f]));
  for (const f of added) if (f.inflow >= (byMonth.get(f.month)?.inflow ?? -1)) byMonth.set(f.month, f);
  return [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month));
}

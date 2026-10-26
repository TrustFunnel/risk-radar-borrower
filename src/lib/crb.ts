// Compares what a CRB report says with the loans the borrower added, so they
// can see loans they forgot, and entries that may be wrong (e.g. still listed
// as unpaid after they cleared it).

import type { CrbAccount, CrbReport, Loan, LenderType } from "./types";

const STOP = /\b(bank|kenya|ltd|limited|plc|microfinance|mfb|sacco|society|co-?operative|credit|the|of)\b/g;
export const lenderKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(STOP, " ").replace(/\s+/g, " ").trim();

const sameLender = (a: string, b: string) => {
  const x = lenderKey(a), y = lenderKey(b);
  return !!x && !!y && (x === y || x.includes(y) || y.includes(x));
};

export interface CrbCheck {
  account: CrbAccount;
  loan?: Loan; // the wallet loan this entry matches
  issue?: "missing" | "listed_after_close" | "arrears_differ";
}

const open = (a: CrbAccount) => a.status === "performing" || a.status === "non_performing";

export function checkCrb(report: CrbReport, loans: Loan[]): CrbCheck[] {
  const used = new Set<string>();
  return report.accounts.map((account) => {
    const loan = loans.find((l) => !used.has(l.id) && sameLender(l.lender, account.lender) && (l.status === "closed") === !open(account))
      ?? loans.find((l) => !used.has(l.id) && sameLender(l.lender, account.lender));
    if (loan) used.add(loan.id);
    let issue: CrbCheck["issue"];
    if (!loan && open(account) && account.balance > 0) issue = "missing";
    else if (loan?.status === "closed" && (account.negative || (open(account) && account.balance > 0))) issue = "listed_after_close";
    else if (loan && open(account) && Math.abs(loan.arrearsDays - account.arrearsDays) > 30) issue = "arrears_differ";
    return { account, loan, issue };
  });
}

export function guessLenderType(lender: string, accountType: string): LenderType {
  const s = `${lender} ${accountType}`.toLowerCase();
  if (/m-?shwari|fuliza|kcb m-?pesa|tala|branch|zenka|okash|timiza|hustler|mobile|digital|app/.test(s)) return "digital";
  if (/sacco/.test(s)) return "sacco";
  if (/microfinance|mfb|faulu|kwft|letshego|musoni|platinum credit|momentum/.test(s)) return "mfi";
  if (/bank/.test(s)) return "bank";
  return "other";
}

// Query string that opens the Add a loan form pre-filled from a CRB entry.
export function loanDraftQuery(a: CrbAccount): string {
  const q = new URLSearchParams({ lender: a.lender, lenderType: guessLenderType(a.lender, a.accountType), from: "crb" });
  if (a.principal) q.set("principal", String(Math.round(a.principal)));
  if (a.balance) q.set("balance", String(Math.round(a.balance)));
  if (a.arrearsDays) q.set("arrears", String(a.arrearsDays));
  if (a.openedOn) q.set("disbursedOn", a.openedOn);
  if (a.status === "written_off" || a.negative) q.set("status", "defaulted");
  else if (a.arrearsDays > 0) q.set("status", "late");
  return q.toString();
}

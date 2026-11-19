// Reads money SMS (M-PESA, Airtel Money, banks, digital lenders and MFIs) into
// small transaction events. Runs on the borrower's phone: the message text is
// never uploaded, only the event below.
//
// Data minimisation (Kenya Data Protection Act 2019, s.25(c)) and Google
// Play's rule that money apps must not take personal SMS:
// - anything that isn't a money message returns null and is forgotten;
// - names and phone numbers of people are dropped, only businesses and
//   lenders are kept as a counterparty;
// - receipt numbers are kept only as a one-way hash, to skip duplicates.

import { categorise, findBank, findLender, type Category } from "./names";

export type MoneySource = "mpesa" | "airtel" | "bank" | "lender";

export type MoneyKind =
  | "received" // money in from a person or business (salary, sales, transfers)
  | "sent" // money to a person
  | "paybill" // money to a paybill (bills, loan repayments, betting)
  | "buygoods" // till / merchant payment
  | "withdraw" // cash out at an agent or ATM
  | "deposit" // cash in at an agent
  | "airtime"
  | "loan_disbursed" // new borrowing landed
  | "loan_repaid" // a repayment reached a lender
  | "loan_due" // reminder: a repayment is coming up
  | "loan_overdue" // a repayment was missed
  | "overdraft" // Fuliza or a bank overdraft covered a payment
  | "reversal";

export type Direction = "in" | "out" | "none";

export interface MoneyEvent {
  refHash: string; // hash of receipt or message, for de-duplication
  source: MoneySource;
  kind: MoneyKind;
  direction: Direction;
  amount: number; // KES, always positive
  fee?: number;
  balance?: number; // account balance after the transaction, if the SMS gives it
  occurredAt: string; // ISO timestamp
  counterparty?: string; // business or lender name only, never a person
  category: Category;
  lender?: string; // when the event is about borrowing
  dueDate?: string; // YYYY-MM-DD, for loan_due / overdraft
  outstanding?: number; // loan or overdraft still owed
  daysOverdue?: number;
}

export interface RawSms {
  body: string;
  sender?: string; // address the SMS came from, e.g. "MPESA"; unknown when pasted
  receivedAt?: string; // ISO; the phone's time, used when the text has no date
}

const AMT = String.raw`(?:Ksh|KES|KShs?|Kshs)\.?\s?([\d,]+(?:\.\d{1,2})?)`;
const amountAfter = (label: string, s: string) => {
  const m = s.match(new RegExp(label + String.raw`[^\d]{0,40}?` + AMT, "i"));
  return m ? money(m[1]) : undefined;
};
const money = (s: string) => Number(s.replace(/,/g, ""));
const firstAmount = (s: string) => {
  const m = s.match(new RegExp(AMT, "i"));
  return m ? money(m[1]) : undefined;
};

// ---------- dates ----------

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function ymd(y: number, m: number, d: number): string | undefined {
  if (y < 100) y += 2000;
  if (m < 1 || m > 12 || d < 1 || d > 31) return undefined;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

// Kenyan SMS write dates day first: 12/11/26, 12/11/2026, 12-11-2026, 12 Nov 2026, 12-Nov-26, 2026-11-12.
export function findDate(s: string): string | undefined {
  let m = s.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (m) return ymd(+m[1], +m[2], +m[3]);
  m = s.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/);
  if (m) return ymd(+m[3], +m[2], +m[1]);
  m = s.match(/\b(\d{1,2})(?:st|nd|rd|th)?[\s-]([A-Za-z]{3})[a-z]*[\s,-]+(\d{2,4})\b/);
  if (m && MONTHS.includes(m[2].toLowerCase())) return ymd(+m[3], MONTHS.indexOf(m[2].toLowerCase()) + 1, +m[1]);
  return undefined;
}

function findTime(s: string): string | undefined {
  const m = s.match(/\b(\d{1,2}):(\d{2})(?::\d{2})?\s*([AP]M)?/i);
  if (!m) return undefined;
  let h = +m[1];
  if (m[3]) h = (h % 12) + (/p/i.test(m[3]) ? 12 : 0);
  return `${String(h).padStart(2, "0")}:${m[2]}`;
}

// East Africa Time is UTC+3 all year.
function when(s: string, fallback: string): string {
  const d = findDate(s);
  if (!d) return fallback;
  const t = findTime(s) ?? "12:00";
  return new Date(`${d}T${t}:00+03:00`).toISOString();
}

// ---------- hashing ----------

// FNV-1a, 64-bit as two 32-bit halves. Not for security; it only stops the
// same SMS being counted twice without keeping the receipt number itself.
export function shortHash(s: string): string {
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x5bd1e995) >>> 0;
  }
  return h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
}

// ---------- names ----------

// "JOHN DOE 0712345678" or "Jane Wanjiru" is a person; "KPLC PREPAID",
// "NAIVAS SUPERMARKET" or a known lender is a business. People are dropped.
function business(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const name = raw.replace(/\s*(?:\+?254|0)\d{9}\b.*$/, "").replace(/\s*\d{6,}.*$/, "").replace(/[.\s]+$/, "").trim();
  if (!name) return undefined;
  if (findLender(name) || categorise(name) !== "other") return name.toUpperCase();
  if (/\b(ltd|limited|plc|bank|sacco|shop|store|supermarket|enterprises?|hotel|school|hospital|pharmacy|services|agency|company|co\.|kenya|africa|group|investments?|fund|credit|capital|prepaid|postpaid|water|power)\b/i.test(name)) return name.toUpperCase();
  return undefined; // a person: don't keep their name
}

// ---------- M-PESA ----------

const RECEIPT = /^\s*([A-Z0-9]{10})\s+(?:Confirmed|confirmed)/;

function parseMpesa(sms: RawSms, now: string): Omit<MoneyEvent, "refHash" | "category"> & { ref?: string } | null {
  const b = sms.body.replace(/\s+/g, " ");
  const ref = b.match(RECEIPT)?.[1];
  const at = when(b, sms.receivedAt ?? now);
  const balance = amountAfter("(?:New )?M-?PESA balance is", b);
  const fee = amountAfter("Transaction cost,?", b);
  const base = { source: "mpesa" as const, occurredAt: at, balance, fee: fee || undefined, ref };

  // Fuliza: an overdraft that covered a payment.
  if (/Fuliza M-?PESA amount is/i.test(b)) {
    const amount = amountAfter("Fuliza M-?PESA amount is", b)!;
    return { ...base, kind: "overdraft", direction: "none", amount, lender: "Fuliza", fee: amountAfter("(?:Access Fee|Interest) charged", b), outstanding: amountAfter("outstanding amount is", b), dueDate: findDate(b.replace(/^.*?due on/i, "")) };
  }
  if (/used to (?:fully |partially )?pay your outstanding Fuliza/i.test(b)) {
    return { ...base, kind: "loan_repaid", direction: "out", amount: firstAmount(b)!, lender: "Fuliza", counterparty: "FULIZA" };
  }
  // Safaricom's own loans: M-Shwari, KCB M-PESA.
  const own = b.match(/(M-?Shwari|KCB M-?PESA)\s+loan/i);
  if (own) {
    const lender = /shwari/i.test(own[1]) ? "M-Shwari" : "KCB M-Pesa";
    const amount = firstAmount(b);
    if (!amount) return null;
    if (/(?:approved|disbursed|transferred to (?:your )?M-?PESA|has been credited)/i.test(b)) return { ...base, kind: "loan_disbursed", direction: "in", amount, lender, counterparty: lender.toUpperCase() };
    if (/(?:repaid|repayment|paid)/i.test(b)) return { ...base, kind: "loan_repaid", direction: "out", amount, lender, counterparty: lender.toUpperCase(), outstanding: amountAfter("(?:outstanding|balance)", b.replace(/^.*?(?:repaid|repayment|paid)/i, "")) };
    if (/overdue|past due|late/i.test(b)) return { ...base, kind: "loan_overdue", direction: "none", amount, lender };
    if (/due/i.test(b)) return { ...base, kind: "loan_due", direction: "none", amount, lender, dueDate: findDate(b.replace(/^.*?due/i, "")) };
  }
  if (/has been reversed/i.test(b)) {
    return { ...base, kind: "reversal", direction: "in", amount: firstAmount(b.replace(/^.*?reversed/i, "")) ?? firstAmount(b) ?? 0 };
  }

  let m = b.match(new RegExp(String.raw`You have received ${AMT} from (.+?) (?:on \d|\d{1,2}/)`, "i"));
  if (m) {
    const counterparty = business(m[2]);
    const lender = findLender(m[2]);
    if (lender) return { ...base, kind: "loan_disbursed", direction: "in", amount: money(m[1]), counterparty, lender };
    return { ...base, kind: "received", direction: "in", amount: money(m[1]), counterparty };
  }
  m = b.match(new RegExp(String.raw`${AMT} sent to (.+?) for account (\S+)`, "i"));
  if (m) {
    const lender = findLender(m[2]);
    return { ...base, kind: lender ? "loan_repaid" : "paybill", direction: "out", amount: money(m[1]), counterparty: m[2].trim().toUpperCase(), lender };
  }
  m = b.match(new RegExp(String.raw`${AMT} paid to (.+?)\.? (?:on \d|\d{1,2}/)`, "i"));
  if (m) {
    const lender = findLender(m[2]);
    return { ...base, kind: lender ? "loan_repaid" : "buygoods", direction: "out", amount: money(m[1]), counterparty: business(m[2]) ?? m[2].trim().toUpperCase(), lender };
  }
  m = b.match(new RegExp(String.raw`${AMT} sent to (.+?) (?:on \d|\d{1,2}/)`, "i"));
  if (m) {
    const lender = findLender(m[2]);
    if (lender) return { ...base, kind: "loan_repaid", direction: "out", amount: money(m[1]), counterparty: lender.toUpperCase(), lender };
    return { ...base, kind: "sent", direction: "out", amount: money(m[1]), counterparty: business(m[2]) };
  }
  m = b.match(new RegExp(String.raw`Withdraw ${AMT}`, "i"));
  if (m) return { ...base, kind: "withdraw", direction: "out", amount: money(m[1]) };
  m = b.match(new RegExp(String.raw`Give ${AMT} cash to`, "i"));
  if (m) return { ...base, kind: "deposit", direction: "in", amount: money(m[1]) };
  m = b.match(new RegExp(String.raw`You bought ${AMT} of airtime`, "i"));
  if (m) return { ...base, kind: "airtime", direction: "out", amount: money(m[1]) };
  return null;
}

// ---------- Airtel Money ----------

function parseAirtel(sms: RawSms, now: string): Omit<MoneyEvent, "refHash" | "category"> & { ref?: string } | null {
  const b = sms.body.replace(/\s+/g, " ");
  const ref = b.match(/\b(?:TID|Trans(?:action)?\.? ?ID)[:.]?\s*([A-Z0-9.]{6,})/i)?.[1];
  const base = { source: "airtel" as const, occurredAt: when(b, sms.receivedAt ?? now), balance: amountAfter("(?:New )?(?:Airtel Money )?bal(?:ance)?(?: is)?", b), ref };
  let m = b.match(new RegExp(String.raw`(?:You have )?received ${AMT} from (.+?)(?: on|\.|,|$)`, "i"));
  if (m) {
    const lender = findLender(m[2]);
    return { ...base, kind: lender ? "loan_disbursed" : "received", direction: "in", amount: money(m[1]), counterparty: business(m[2]), lender };
  }
  m = b.match(new RegExp(String.raw`(?:sent|paid) ${AMT} to (.+?)(?: on|\.|,|$)`, "i")) ?? b.match(new RegExp(String.raw`${AMT} (?:sent|paid) to (.+?)(?: on|\.|,|$)`, "i"));
  if (m) {
    const lender = findLender(m[2]);
    return { ...base, kind: lender ? "loan_repaid" : "sent", direction: "out", amount: money(m[1]), counterparty: business(m[2]), lender };
  }
  m = b.match(new RegExp(String.raw`withdr[ae]wn? ${AMT}`, "i"));
  if (m) return { ...base, kind: "withdraw", direction: "out", amount: money(m[1]) };
  return null;
}

// ---------- banks ----------

function parseBank(sms: RawSms, now: string): Omit<MoneyEvent, "refHash" | "category"> & { ref?: string } | null {
  const b = sms.body.replace(/\s+/g, " ");
  if (!/\b(account|a\/c|acc(?:t)?\.?|card)\b/i.test(b)) return null;
  const ref = b.match(/\b(?:Ref(?:erence)?|Txn(?: ID)?|Transaction ID)[:.]?\s*([A-Z0-9]{6,})/i)?.[1];
  const balance = amountAfter(String.raw`(?:Avail(?:able)?\.?\s*)?Bal(?:ance)?\.?`, b.replace(/^.*?(?=(?:avail(?:able)?\.?\s*)?bal)/i, ""));
  const base = { source: "bank" as const, occurredAt: when(b, sms.receivedAt ?? now), balance, ref };
  const amount = firstAmount(b);
  if (!amount) return null;
  const lender = bankLender(sms.sender, b);
  if (/\b(?:loan|advance)\b[^.]*\b(?:disbursed|credited|approved)\b/i.test(b)) return { ...base, kind: "loan_disbursed", direction: "in", amount, lender, counterparty: lender?.toUpperCase() };
  if (/\b(?:loan|advance)\b[^.]*\b(?:overdue|past due|in arrears)\b/i.test(b)) return { ...base, kind: "loan_overdue", direction: "none", amount, lender };
  if (/\b(?:loan|advance)\b[^.]*\b(?:repayment|repaid|recovered)\b/i.test(b)) return { ...base, kind: "loan_repaid", direction: "out", amount, lender, counterparty: lender?.toUpperCase() };
  if (/\b(?:credited|received|deposit(?:ed)?|salary)\b/i.test(b)) return { ...base, kind: "received", direction: "in", amount, counterparty: /salary/i.test(b) ? "SALARY" : undefined };
  if (/\b(?:debited|withdrawal|withdrawn|ATM)\b/i.test(b)) return { ...base, kind: /ATM|withdraw/i.test(b) ? "withdraw" : "paybill", direction: "out", amount };
  if (/\boverdraft\b/i.test(b)) return { ...base, kind: "overdraft", direction: "none", amount, lender };
  return null;
}

function bankLender(sender: string | undefined, body: string): string | undefined {
  return findLender(sender ?? "") ?? findBank(sender ?? "") ?? findLender(body) ?? findBank(body);
}

// ---------- digital lenders and MFIs ----------

function parseLender(sms: RawSms, now: string): Omit<MoneyEvent, "refHash" | "category"> & { ref?: string } | null {
  const b = sms.body.replace(/\s+/g, " ");
  if (!/\b(loans?|mkopo|repa(?:y|id|yment|ying)|instal?ments?|due|overdue|limit|payment)\b/i.test(b)) return null;
  const lender = findLender(sms.sender ?? "") ?? findLender(b);
  if (!lender) return null;
  const amount = amountAfter(String.raw`(?:loan|amount|balance|instal?ment|of|is|repay|payment)`, b) ?? firstAmount(b);
  if (!amount) return null;
  const base = { source: "lender" as const, occurredAt: sms.receivedAt ?? now, lender, counterparty: lender.toUpperCase() };
  const overdue = b.match(/(\d+)\s*days?\s*(?:overdue|late|past due|in arrears)/i);
  if (overdue || /\b(overdue|past due|in arrears|missed|late payment|penalty|CRB)\b/i.test(b)) {
    return { ...base, kind: "loan_overdue", direction: "none", amount, daysOverdue: overdue ? +overdue[1] : undefined, outstanding: amount };
  }
  if (/\b(disbursed|approved|sent to your|credited|has been deposited|received your loan)\b/i.test(b)) return { ...base, kind: "loan_disbursed", direction: "none", amount };
  if (/\b(received your (?:re)?payment|payment of .* received|thank you for (?:your )?(?:re)?payment|repaid|fully paid|cleared)\b/i.test(b)) {
    return { ...base, kind: "loan_repaid", direction: "none", amount, outstanding: amountAfter("(?:outstanding|remaining|balance)(?: balance)?(?: is)?", b.replace(/^.*?(?:received|repaid|paid)/i, "")) };
  }
  if (/\bdue\b/i.test(b)) {
    const due = b.replace(/^.*?\bdue\b/i, "");
    return { ...base, kind: "loan_due", direction: "none", amount, dueDate: findDate(due) };
  }
  return null;
}

// ---------- entry point ----------

const MPESA_SENDER = /^(M-?PESA|MPESA)$/i;
const AIRTEL_SENDER = /^(AIRTEL ?MONEY|AirtelMoney)$/i;

export function parseSms(sms: RawSms, now = new Date().toISOString()): MoneyEvent | null {
  const body = sms.body ?? "";
  if (body.length < 20 || body.length > 1200) return null;
  // One-time codes, PINs and login messages are never money events.
  if (/\b(OTP|one[- ]time|verification code|PIN\b|password)/i.test(body) && !/Confirmed/.test(body)) return null;
  const sender = sms.sender?.trim();
  let e: ReturnType<typeof parseMpesa> = null;
  if (sender ? MPESA_SENDER.test(sender) : RECEIPT.test(body) && /M-?PESA|Fuliza/i.test(body)) e = parseMpesa(sms, now);
  else if (sender ? AIRTEL_SENDER.test(sender) : /Airtel ?Money/i.test(body)) e = parseAirtel(sms, now);
  if (!e && (!sender || !MPESA_SENDER.test(sender))) e = parseLender(sms, now) ?? parseBank(sms, now);
  if (!e || !(e.amount > 0)) return null;
  const { ref, ...rest } = e;
  // The hash covers the receipt (or whole text), so the same SMS shared twice
  // is one event, but two equal payments on one day stay two.
  const refHash = shortHash(`${e.source}|${ref ?? body.replace(/\s+/g, " ").trim()}`);
  const category: Category = e.lender ? "loan" : categorise(e.counterparty ?? "", e.kind);
  return clean({ ...rest, refHash, category });
}

function clean(e: MoneyEvent): MoneyEvent {
  for (const k of Object.keys(e) as (keyof MoneyEvent)[]) if (e[k] === undefined || Number.isNaN(e[k])) delete e[k];
  return e;
}

// Split pasted text holding several SMS into separate messages. Each M-PESA
// message starts with its 10-character receipt number.
export function splitPasted(text: string): string[] {
  const parts = text
    .split(/\n\s*\n|(?=\b[A-Z0-9]{10} Confirmed)/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 20);
  return parts.length ? parts : [text.trim()];
}

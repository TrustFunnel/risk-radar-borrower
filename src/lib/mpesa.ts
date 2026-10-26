// Reads the text of a Safaricom M-PESA full statement (PDF) into monthly
// flows. Each detailed-statement row reads:
//   Receipt No | Completion Time | Details | Transaction Status | Paid In | Withdrawn | Balance
// Withdrawals are printed negative; long details wrap onto the next line.

import { addToMonth, sortedFlows, type MonthFlow } from "./remediation";

export interface MpesaTransaction {
  receipt: string;
  date: string; // YYYY-MM-DD
  details: string;
  amount: number; // + paid in, - withdrawn
  balance: number;
}

export interface MpesaStatement {
  customerName?: string;
  mobile?: string;
  period?: string;
  transactions: MpesaTransaction[];
  flows: MonthFlow[];
}

const ROW = /^([A-Z0-9]{10})\s+(\d{4}-\d{2}-\d{2})\s+\d{2}:\d{2}:\d{2}\s+(.*)$/;
const TAIL = /^(.*?)\s*\b(Completed|Failed|Reversed|Pending)\b\s+(-?[\d,]+\.\d{2})(?:\s+(-?[\d,]+\.\d{2}))?(?:\s+(-?[\d,]+\.\d{2}))?\s*$/i;
// Money going out, for the odd statement that prints withdrawals unsigned.
const OUT = /^(pay ?bill|merchant payment|customer transfer to|customer withdrawal|buy goods|airtime purchase|business payment to|customer send money|withdrawal charge|pay merchant|od loan repayment)/i;
const money = (s: string) => Number(s.replace(/,/g, ""));

export function parseMpesaStatement(lines: string[]): MpesaStatement {
  const out: MpesaStatement = { transactions: [], flows: [] };
  let last: MpesaTransaction | null = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (!out.customerName) out.customerName = line.match(/^Customer Name\s*:?\s*(.+)$/i)?.[1]?.trim();
    if (!out.mobile) out.mobile = line.match(/^Mobile Number\s*:?\s*([+\d]+)/i)?.[1];
    if (!out.period) out.period = line.match(/^Statement Period\s*:?\s*(.+)$/i)?.[1]?.trim();

    const row = line.match(ROW);
    if (!row) {
      // A wrapped continuation of the previous row's details.
      if (last && line && !/^(receipt no|page \d|disclaimer)/i.test(line) && !TAIL.test(line)) last.details += ` ${line}`;
      continue;
    }
    last = null;
    const tail = row[3].match(TAIL);
    if (!tail || !/completed/i.test(tail[2])) continue; // failed or unreadable rows don't move money
    const nums = [tail[3], tail[4], tail[5]].filter(Boolean).map((n) => money(n!));
    let amount: number;
    if (nums.length === 3) amount = nums[0] - Math.abs(nums[1]); // paid in and withdrawn both printed
    else if (nums.length === 2) amount = nums[0];
    else continue; // need an amount and the balance
    const details = tail[1].trim();
    if (amount > 0 && OUT.test(details)) amount = -amount;
    last = { receipt: row[1], date: row[2], details, amount, balance: nums[nums.length - 1] };
    out.transactions.push(last);
  }
  const byMonth = new Map<string, MonthFlow>();
  for (const t of out.transactions) {
    addToMonth(byMonth, t.date.slice(0, 7), Math.max(0, t.amount), Math.max(0, -t.amount), t.details);
  }
  out.flows = sortedFlows(byMonth);
  return out;
}

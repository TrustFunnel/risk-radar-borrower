import { describe, expect, it } from "vitest";
import { findDate, parseSms, splitPasted } from "../money/parse";
import { monthlyFlows, snapshot } from "../money/signals";

const NOW = "2026-11-13T09:00:00.000Z";
const mpesa = (body: string) => parseSms({ sender: "MPESA", body }, NOW);

describe("M-PESA messages", () => {
  it("money received from a person: amount and balance kept, the person's name dropped", () => {
    const e = mpesa("TKD1AB2CD3 Confirmed.You have received Ksh1,500.00 from JOHN KAMAU 0712345678 on 12/11/26 at 10:15 AM  New M-PESA balance is Ksh2,345.50. Earn interest daily on Ziidi MMF,Dial *334#");
    expect(e).toMatchObject({ source: "mpesa", kind: "received", direction: "in", amount: 1500, balance: 2345.5, category: "income", occurredAt: "2026-11-12T07:15:00.000Z" });
    expect(e!.counterparty).toBeUndefined();
    expect(JSON.stringify(e)).not.toMatch(/KAMAU|0712345678|TKD1AB2CD3/);
  });

  it("sending to a person keeps the fee but not the name", () => {
    const e = mpesa("TKD1AB2CD4 Confirmed. Ksh500.00 sent to JANE WANJIRU 0722000000 on 12/11/26 at 3:04 PM. New M-PESA balance is Ksh1,845.00. Transaction cost, Ksh7.00. Amount you can transact within the day is 499,500.00.");
    expect(e).toMatchObject({ kind: "sent", direction: "out", amount: 500, fee: 7, category: "transfer" });
    expect(e!.counterparty).toBeUndefined();
  });

  it("paybill: bills, loan repayments and betting are told apart", () => {
    expect(mpesa("TKD1AB2CD5 Confirmed. Ksh1,000.00 sent to KPLC PREPAID for account 37184520011 on 12/11/26 at 9:00 AM New M-PESA balance is Ksh845.00. Transaction cost, Ksh0.00.")).toMatchObject({ kind: "paybill", category: "bills", counterparty: "KPLC PREPAID", amount: 1000 });
    expect(mpesa("TKD1AB2CD6 Confirmed. Ksh2,300.00 sent to TALA for account 254712345678 on 12/11/26 at 9:30 AM New M-PESA balance is Ksh45.00. Transaction cost, Ksh0.00.")).toMatchObject({ kind: "loan_repaid", lender: "Tala", category: "loan" });
    expect(mpesa("TKD1AB2CD7 Confirmed. Ksh200.00 sent to SPORTPESA for account SPORTPESA on 12/11/26 at 11:45 PM New M-PESA balance is Ksh10.00. Transaction cost, Ksh0.00.")).toMatchObject({ kind: "paybill", category: "betting" });
  });

  it("till payment, withdrawal, deposit and airtime", () => {
    expect(mpesa("TKD1AB2CD8 Confirmed. Ksh250.00 paid to NAIVAS SUPERMARKET. on 12/11/26 at 6:30 PM.New M-PESA balance is Ksh595.00. Transaction cost, Ksh0.00.")).toMatchObject({ kind: "buygoods", category: "shopping", counterparty: "NAIVAS SUPERMARKET" });
    expect(mpesa("TKD1AB2CD9 Confirmed.on 12/11/26 at 1:00 PMWithdraw Ksh2,000.00 from 123456 - MAMA MBOGA AGENT Shop New M-PESA balance is Ksh1,000.00. Transaction cost, Ksh29.00.")).toMatchObject({ kind: "withdraw", direction: "out", amount: 2000, fee: 29, category: "cash" });
    expect(mpesa("TKD1AB2CE0 Confirmed. On 12/11/26 at 11:00 AM Give Ksh3,000.00 cash to ABC AGENT New M-PESA balance is Ksh4,000.00.")).toMatchObject({ kind: "deposit", direction: "in", amount: 3000 });
    expect(mpesa("TKD1AB2CE1 confirmed.You bought Ksh100.00 of airtime on 12/11/26 at 8:00 AM.New M-PESA balance is Ksh900.00. Transaction cost, Ksh0.00.")).toMatchObject({ kind: "airtime", amount: 100 });
  });

  it("a loan paid out by a digital lender is borrowing, not income", () => {
    expect(mpesa("TKD1AB2CE2 Confirmed.You have received Ksh5,000.00 from TALA KENYA on 12/11/26 at 2:00 PM New M-PESA balance is Ksh5,100.00.")).toMatchObject({ kind: "loan_disbursed", direction: "in", lender: "Tala", category: "loan" });
  });

  it("Fuliza use and repayment", () => {
    expect(mpesa("TKD1AB2CE3 Confirmed. Fuliza M-Pesa amount is Ksh 200.00. Access Fee charged Ksh 2.00. Total Fuliza M-Pesa outstanding amount is Ksh 202.00 due on 12/12/26. To check daily charges, Dial *234*0#OK Select Query Charges")).toMatchObject({ kind: "overdraft", amount: 200, fee: 2, outstanding: 202, dueDate: "2026-12-12", lender: "Fuliza" });
    expect(mpesa("TKD1AB2CE4 Confirmed. Ksh 202.00 from your M-PESA has been used to fully pay your outstanding Fuliza M-PESA. Available Fuliza M-PESA limit is Ksh 1,000.00. M-PESA balance is Ksh300.00.")).toMatchObject({ kind: "loan_repaid", amount: 202, lender: "Fuliza" });
  });

  it("works when pasted, with no sender", () => {
    expect(parseSms({ body: "TKD1AB2CD5 Confirmed. Ksh1,000.00 sent to KPLC PREPAID for account 37184520011 on 12/11/26 at 9:00 AM New M-PESA balance is Ksh845.00. Transaction cost, Ksh0.00." }, NOW)).toMatchObject({ kind: "paybill", source: "mpesa" });
  });

  it("the same message twice gets the same hash; a different receipt doesn't", () => {
    const a = mpesa("TKD1AB2CE1 confirmed.You bought Ksh100.00 of airtime on 12/11/26 at 8:00 AM.New M-PESA balance is Ksh900.00.");
    const b = parseSms({ body: "TKD1AB2CE1 confirmed.You bought Ksh100.00 of airtime on 12/11/26 at 8:00 AM.New M-PESA balance is Ksh900.00." }, NOW);
    const c = mpesa("TKD1AB2CE9 confirmed.You bought Ksh100.00 of airtime on 12/11/26 at 8:00 AM.New M-PESA balance is Ksh900.00.");
    expect(a!.refHash).toBe(b!.refHash);
    expect(a!.refHash).not.toBe(c!.refHash);
  });
});

describe("banks, lenders and Airtel", () => {
  it("bank credit and debit", () => {
    expect(parseSms({ sender: "KCB", body: "Dear Customer, your account XXXXXX1234 has been credited with KES 50,000.00 on 25/10/2026. Ref FT2629812345. Avail bal KES 51,200.50" }, NOW)).toMatchObject({ source: "bank", kind: "received", amount: 50000, balance: 51200.5, occurredAt: "2026-10-25T09:00:00.000Z" });
    expect(parseSms({ sender: "Equity Bank", body: "Your account ****5678 has been debited KES 3,500.00 on 26-10-2026 for ATM withdrawal. Available balance KES 4,000.00" }, NOW)).toMatchObject({ kind: "withdraw", direction: "out", amount: 3500, balance: 4000 });
  });

  it("bank loan messages name the bank as lender", () => {
    expect(parseSms({ sender: "Equity Bank", body: "Your Eazzy Loan of KES 10,000.00 has been disbursed to your account ****5678 on 01/11/2026." }, NOW)).toMatchObject({ kind: "loan_disbursed", lender: "Eazzy Loan" });
  });

  it("digital lender reminders, overdue notices and repayments", () => {
    const due = parseSms({ sender: "Tala", body: "Hi, your Tala loan of KES 3,450 is due on 15/11/2026. Pay via M-PESA Paybill 851900 to keep your limit growing.", receivedAt: "2026-11-12T06:00:00.000Z" }, NOW);
    expect(due).toMatchObject({ source: "lender", kind: "loan_due", lender: "Tala", amount: 3450, dueDate: "2026-11-15", occurredAt: "2026-11-12T06:00:00.000Z" });
    expect(parseSms({ sender: "Branch", body: "Your Branch loan of KSh 5,200 is 6 days overdue. Repay today to avoid being reported to CRB." }, NOW)).toMatchObject({ kind: "loan_overdue", lender: "Branch", daysOverdue: 6, amount: 5200 });
    expect(parseSms({ sender: "ZENKA", body: "We have received your payment of KES 1,000. Your outstanding balance is KES 2,500. Thank you for repaying with Zenka." }, NOW)).toMatchObject({ kind: "loan_repaid", lender: "Zenka", amount: 1000, outstanding: 2500 });
  });

  it("Airtel Money received", () => {
    expect(parseSms({ sender: "AirtelMoney", body: "TID: MP261112.1530.A12345. You have received Ksh 800.00 from PETER OTIENO 0733111222. New balance is Ksh 1,200.00." }, NOW)).toMatchObject({ source: "airtel", kind: "received", amount: 800, balance: 1200 });
  });

  it("personal messages, codes and promotions are ignored", () => {
    expect(parseSms({ sender: "+254712345678", body: "Hi mum, I will send you the money for school fees tomorrow evening." }, NOW)).toBeNull();
    expect(parseSms({ sender: "MPESA", body: "Your M-PESA verification code is 123456. Do not share it with anyone." }, NOW)).toBeNull();
    expect(parseSms({ sender: "Safaricom", body: "Get 1GB for Ksh 50 valid 24hrs. Dial *544# now!" }, NOW)).toBeNull();
    expect(parseSms({ sender: "KCB", body: "Your login OTP is 556677. It expires in 5 minutes." }, NOW)).toBeNull();
  });
});

describe("helpers", () => {
  it("reads Kenyan date styles", () => {
    expect(findDate("on 12/11/26 at")).toBe("2026-11-12");
    expect(findDate("due 15 Nov 2026")).toBe("2026-11-15");
    expect(findDate("on 2026-11-03")).toBe("2026-11-03");
  });
  it("splits pasted M-PESA messages", () => {
    const parts = splitPasted("TKD1AB2CE1 confirmed.You bought Ksh100.00 of airtime on 12/11/26 at 8:00 AM.New M-PESA balance is Ksh900.00. TKD1AB2CD8 Confirmed. Ksh250.00 paid to NAIVAS SUPERMARKET. on 12/11/26 at 6:30 PM.New M-PESA balance is Ksh595.00.");
    expect(parts).toHaveLength(2);
  });
});

describe("flows and signals", () => {
  const ev = (body: string, sender = "MPESA") => parseSms({ sender, body }, NOW)!;
  const events = [
    ev("TAA0000001 Confirmed.You have received Ksh20,000.00 from ACME LIMITED on 30/09/26 at 5:00 PM New M-PESA balance is Ksh20,500.00."),
    ev("TAA0000002 Confirmed.You have received Ksh30,000.00 from ACME LIMITED on 28/10/26 at 5:00 PM New M-PESA balance is Ksh30,500.00."),
    ev("TAA0000003 Confirmed. Ksh12,000.00 sent to TALA for account 254712345678 on 29/10/26 at 9:30 AM New M-PESA balance is Ksh18,500.00."),
    ev("TAA0000004 Confirmed. Ksh5,000.00 paid to NAIVAS SUPERMARKET. on 30/10/26 at 6:30 PM.New M-PESA balance is Ksh13,500.00."),
    ev("TAA0000005 Confirmed.You have received Ksh5,000.00 from ZENKA on 05/11/26 at 2:00 PM New M-PESA balance is Ksh5,100.00."),
    ev("TAA0000006 Confirmed.You have received Ksh4,000.00 from OKASH on 06/11/26 at 2:00 PM New M-PESA balance is Ksh9,100.00."),
    ev("TAA0000007 Confirmed. Ksh3,000.00 sent to BETIKA for account BETIKA on 07/11/26 at 11:00 PM New M-PESA balance is Ksh6,100.00."),
    ev("Your Branch loan of KSh 5,200 is 6 days overdue. Repay today to avoid being reported to CRB.", "Branch"),
  ];

  it("monthly flows leave out borrowing, repayments and part months", () => {
    expect(monthlyFlows(events, "2026-09-15T00:00:00Z", NOW)).toEqual([{ month: "2026-10", inflow: 30000, outflow: 5000 }]);
    expect(monthlyFlows(events, "2026-08-31T22:00:00Z", NOW).map((f) => f.month)).toEqual(["2026-09", "2026-10"]);
  });

  it("raises early-warning signals", () => {
    const s = snapshot(events, 30, NOW);
    const ids = s.signals.map((x) => x.id);
    expect(ids).toContain("overdue-Branch");
    expect(ids).toContain("many-loans");
    expect(ids).toContain("betting");
    expect(s.borrowed).toBe(9000);
    expect(s.income).toBe(30000);
  });
});

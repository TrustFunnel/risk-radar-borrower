import { describe, expect, it } from "vitest";
import { checkCrb, guessLenderType, loanDraftQuery } from "../crb";
import { mergeFlows } from "../documents";
import { guessIndustry } from "../industry";
import { parseMpesaStatement } from "../mpesa";
import { groupLines } from "../pdfText";
import type { CrbReport, Loan } from "../types";

describe("industry from work details", () => {
  it("knows big Kenyan employers", () => {
    expect(guessIndustry("Kenya Power", "")?.industry).toBe("Energy, water and utilities");
    expect(guessIndustry("TSC", "")?.industry).toBe("Education");
    expect(guessIndustry("KCB Group", "Teller")?.industry).toBe("Banking, insurance and finance");
    expect(guessIndustry("County Government of Nakuru", "Clerk")?.industry).toBe("Government and public service");
  });
  it("falls back to the job title", () => {
    expect(guessIndustry("Mama Njeri", "boda rider")).toEqual({ industry: "Transport and logistics", basis: "job_title" });
    expect(guessIndustry("St Mary's", "clinical officer")?.industry).toBe("Health");
    expect(guessIndustry("Acme", "pharmacist")?.industry).toBe("Health");
  });
  it("doesn't guess wildly", () => {
    expect(guessIndustry("Acme Ltd", "manager")).toBeNull();
    expect(guessIndustry("Pharmacy Plus", "")?.industry).toBe("Health"); // not agriculture via "farm"
  });
});

describe("M-PESA statement PDF text", () => {
  const lines = [
    "M-PESA STATEMENT",
    "Customer Name: JANE WANJIKU",
    "Mobile Number: 0712345678",
    "Statement Period: 01 Jul 2026 - 31 Aug 2026",
    "Receipt No. Completion Time Details Transaction Status Paid In Withdrawn Balance",
    "TH31AB2CD3 2026-08-28 09:12:44 Pay Bill to 888880 - KPLC PREPAID Completed -2,000.00 60,250.00",
    "TH30AB2CD2 2026-08-03 08:00:01 Business Payment from 123456 - ACME LTD Completed 52,000.00 62,250.00",
    "via API. Original conversation ID is AG_2026",
    "TG15AB2CD1 2026-07-15 10:00:00 OD Loan Repayment to 232323 - M-PESA Completed -5,000.00 10,250.00",
    "Overdraw",
    "TG14AB2CD0 2026-07-14 10:00:00 OverDraft of Credit Party Completed 3,000.00 15,250.00",
    "TG03AB2CC9 2026-07-03 10:00:00 Salary Payment from ACME LTD Completed 50,000.00 12,250.00",
    "TG02AB2CC8 2026-07-02 10:00:00 Customer Transfer to 0722***111 JOHN Failed -100.00 0.00",
    "Page 1 of 3",
  ];

  it("reads the header and monthly money in and out", () => {
    const s = parseMpesaStatement(lines);
    expect(s.customerName).toBe("JANE WANJIKU");
    expect(s.mobile).toBe("0712345678");
    expect(s.transactions).toHaveLength(5); // the failed transfer is skipped
    expect(s.transactions[1].details).toContain("Original conversation ID");
    expect(s.flows).toEqual([
      { month: "2026-07", inflow: 50000, outflow: 0 }, // Fuliza in isn't income, its repayment isn't spending
      { month: "2026-08", inflow: 52000, outflow: 2000 },
    ]);
  });

  it("treats unsigned withdrawals as money out", () => {
    const s = parseMpesaStatement(["TH31AB2CD3 2026-08-28 09:12:44 Merchant Payment to 5555 - SHOP Completed 700.00 1,300.00"]);
    expect(s.transactions[0].amount).toBe(-700);
  });

  it("rebuilds lines from scattered PDF text", () => {
    expect(groupLines([
      { str: "Paid In", x: 300, y: 700.5 }, { str: "Receipt No.", x: 20, y: 700 },
      { str: "TH31AB2CD3", x: 20, y: 680 }, { str: " ", x: 90, y: 680 }, { str: "2026-08-28 09:12:44", x: 90, y: 680 },
    ])).toEqual(["Receipt No. Paid In", "TH31AB2CD3 2026-08-28 09:12:44"]);
  });
});

describe("statements feeding the affordable plan", () => {
  it("doesn't add bank and M-Pesa income for the same month", () => {
    const bank = [{ month: "2026-07", inflow: 50000, outflow: 1000 }];
    const mpesa = [{ month: "2026-07", inflow: 30000, outflow: 25000 }, { month: "2026-08", inflow: 31000, outflow: 20000 }];
    expect(mergeFlows(bank, mpesa)).toEqual([bank[0], mpesa[1]]);
    expect(mergeFlows([{ month: "m1", inflow: 1, outflow: 0 }], bank)).toEqual(bank);
  });
});

describe("CRB report against the wallet", () => {
  const loan = (lender: string, status: Loan["status"] = "current", arrearsDays = 0): Loan => ({
    id: lender, lender, lenderType: "bank", status, arrearsDays,
    terms: { principal: 10000, rate: 0, rateType: "reducing_annual", frequency: "monthly", installments: 12 },
    disbursedOn: "2026-01-01", firstDueDate: "2026-02-01", createdAt: "", updatedAt: "",
  });
  const report: CrbReport = {
    bureau: "Metropol",
    accounts: [
      { lender: "KCB Bank Kenya Limited", accountType: "Personal loan", balance: 80000, arrearsDays: 0, status: "performing", negative: false },
      { lender: "Tala", accountType: "Mobile loan", balance: 4500, arrearsDays: 95, status: "non_performing", negative: true },
      { lender: "Equity Bank", accountType: "Personal loan", balance: 12000, arrearsDays: 120, status: "non_performing", negative: true },
    ],
  };

  it("finds loans missing from the wallet and closed loans still listed", () => {
    const checks = checkCrb(report, [loan("KCB"), loan("Equity", "closed")]);
    expect(checks.map((c) => c.issue)).toEqual([undefined, "missing", "listed_after_close"]);
    expect(checks[0].loan?.id).toBe("KCB");
  });

  it("pre-fills the add loan form from a CRB entry", () => {
    expect(guessLenderType("Tala", "Mobile loan")).toBe("digital");
    const q = new URLSearchParams(loanDraftQuery(report.accounts[1]));
    expect(q.get("lenderType")).toBe("digital");
    expect(q.get("status")).toBe("defaulted");
    expect(q.get("arrears")).toBe("95");
  });
});

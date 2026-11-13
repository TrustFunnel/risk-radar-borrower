// Financial distress assessment from the WhatsApp questions. Rules-based and
// explainable on purpose: a coach can see exactly why someone was flagged,
// and the borrower is told in plain words. Thresholds follow the One Plan
// work (a safe repayment load is under about a third of income).
import type { Answers, Assessment, DistressLevel } from "./types";

export function assess(a: Answers): Assessment {
  const reasons: string[] = [];
  const income = a.income ?? 0;
  const repay = a.repayments ?? 0;
  const dsr = income > 0 ? repay / income : null;
  const behind = !!a.behind;

  if (a.pressure === "court") reasons.push("court");
  if (a.pressure === "threats") reasons.push("threats");
  if (a.daysBehind === "over90") reasons.push("behind_over_90");
  else if (a.daysBehind === "30to90") reasons.push("behind_30_90");
  else if (behind) reasons.push("behind_under_30");
  if (dsr === null && repay > 0) reasons.push("no_income");
  if (dsr !== null && dsr >= 0.7) reasons.push("dsr_over_70");
  else if (dsr !== null && dsr >= 0.5) reasons.push("dsr_over_50");
  else if (dsr !== null && dsr >= 0.3) reasons.push("dsr_over_30");
  if ((a.loans ?? 0) >= 4) reasons.push("many_loans");

  const has = (r: string) => reasons.includes(r);
  let level: DistressLevel = "stable";
  if (
    has("court") ||
    (has("behind_over_90") && (dsr === null || dsr >= 0.5)) ||
    (behind && has("dsr_over_70")) ||
    (behind && (a.incomeType === "none" || has("no_income")))
  ) level = "crisis";
  else if (
    has("behind_over_90") || has("behind_30_90") || has("threats") ||
    has("dsr_over_70") || has("dsr_over_50") || has("no_income") ||
    (behind && has("many_loans"))
  ) level = "distressed";
  else if (behind || has("dsr_over_30") || has("many_loans")) level = "stretched";

  return { level, dsr: dsr === null ? null : Math.round(dsr * 100) / 100, reasons };
}

// "25k", "25,000", "KES 25000", "Ksh 2.5k", "elfu 25" -> 25000. Null if no number.
export function parseAmount(input: string): number | null {
  const t = input.toLowerCase().replace(/kes|ksh|kshs|sh\.?|shillings?|bob/g, " ").replace(/,/g, "").trim();
  const elfu = t.match(/elfu\s*(\d+(?:\.\d+)?)/);
  if (elfu) return Math.round(Number(elfu[1]) * 1000);
  const m = t.match(/(\d+(?:\.\d+)?)\s*(k|m)?\b/);
  if (!m) return null;
  const n = Number(m[1]) * (m[2] === "k" ? 1000 : m[2] === "m" ? 1_000_000 : 1);
  return Number.isFinite(n) && n >= 0 && n < 100_000_000 ? Math.round(n) : null;
}

// Whole number of loans, 0 to 50, typed as digits or a small word.
export function parseCount(input: string): number | null {
  const words: Record<string, number> = {
    none: 0, zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    hakuna: 0, sifuri: 0, moja: 1, mbili: 2, tatu: 3, nne: 4, tano: 5, sita: 6, saba: 7, nane: 8, tisa: 9, kumi: 10,
  };
  const t = input.toLowerCase().trim();
  const d = t.match(/\d+/);
  if (d) { const n = Number(d[0]); return n <= 50 ? n : null; }
  for (const w of t.split(/\s+/)) if (w in words) return words[w];
  return null;
}

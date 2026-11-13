// Kenyan lenders, betting firms and bill payees as they appear in money SMS.
// Matching is on business names only. Extend these lists as new names show
// up in the pilot.

import type { MoneyKind } from "./parse";

export type Category =
  | "income" // money in that isn't a loan
  | "loan" // borrowing or repaying
  | "betting"
  | "bills" // power, water, rent, school, phone/internet
  | "shopping" // tills and merchants
  | "cash" // agent withdrawals and deposits
  | "airtime"
  | "transfer" // to or from a person
  | "other";

// [display name, pattern]. Order matters: more specific names first.
const LENDERS: [string, RegExp][] = [
  ["Fuliza", /\bfuliza\b/i],
  ["M-Shwari", /\bm-?shwari\b/i],
  ["KCB M-Pesa", /\bkcb[\s-]?m-?pesa\b/i],
  ["Hustler Fund", /\bhustler\s?fund\b/i],
  ["Tala", /\btala\b/i],
  ["Branch", /\bbranch\s?(?:international|microfinance|mfb)?\b(?=.*\b(?:loan|repay|due|limit)\b)|^branch$/i],
  ["Zenka", /\bzenka\b/i],
  ["Okash", /\bo-?kash\b/i],
  ["Opesa", /\bo-?pesa\b/i],
  ["Timiza", /\btimiza\b/i],
  ["Eazzy Loan", /\beazz?y\s?loan\b/i],
  ["Zash", /\bzash\b/i],
  ["iPesa", /\bi-?pesa\b/i],
  ["Haraka", /\bharaka\s?(?:loan|credit)?\b(?=.*\bloan\b)/i],
  ["Mkopo Rahisi", /\bmkopo\s?rahisi\b/i],
  ["Watu Credit", /\bwatu\b/i],
  ["Mogo", /\bmogo\b/i],
  ["Platinum Credit", /\bplatinum\s?credit\b/i],
  ["Letshego", /\bletshego\b/i],
  ["Faulu", /\bfaulu\b/i],
  ["KWFT", /\bkwft\b|kenya women microfinance/i],
  ["Musoni", /\bmusoni\b/i],
  ["SMEP", /\bsmep\b/i],
  ["Rafiki", /\brafiki\s?(?:microfinance|mfb)\b/i],
  ["Maisha", /\bmaisha\s?(?:microfinance|mfb)\b/i],
  ["Stima Sacco", /\bstima\s?sacco\b/i],
  ["Mwalimu Sacco", /\bmwalimu\s?(?:national\s?)?sacco\b/i],
  ["Unaitas", /\bunaitas\b/i],
  ["Harambee Sacco", /\bharambee\s?sacco\b/i],
];

// Banks that send account SMS. A bank name alone is not borrowing: only bank
// messages that mention a loan are counted as loans (see parseBank).
const BANKS: [string, RegExp][] = [
  ["Equity Bank", /\bequity\b/i],
  ["KCB", /\bkcb\b/i],
  ["Co-op Bank", /\bco-?op(?:erative)?\s?bank\b|\bcoopbank\b/i],
  ["NCBA", /\bncba\b/i],
  ["Absa", /\babsa\b/i],
  ["Stanbic", /\bstanbic\b/i],
  ["Standard Chartered", /\bstandard\s?chartered\b|\bstanchart\b/i],
  ["I&M Bank", /\bi\s?&\s?m\b/i],
  ["DTB", /\bdtb\b|diamond trust/i],
  ["Family Bank", /\bfamily\s?bank\b/i],
  ["Family Bank", /\bfamilybank\b/i],
  ["Sidian", /\bsidian\b/i],
  ["Kingdom Bank", /\bkingdom\s?bank\b/i],
  ["Bank of Africa", /\bbank of africa\b/i],
  ["Postbank", /\bpost\s?bank\b/i],
];

const BETTING = /\b(sportpesa|betika|odibets?|mozzart|betin|22bet|shabiki|betway|bangbet|sportybet|mcheza|betsafe|helabet|1xbet|melbet|kwikbet|chezacash|aviator)\b/i;
const BILLS = /\b(kplc|kenya power|prepaid|postpaid|water|nairobi water|safaricom home|zuku|dstv|gotv|startimes|faiba|school|academy|fees|rent|nhif|sha\b|nssf|kra|ecitizen|insurance|jubilee|britam|cic)\b/i;
const SHOPS = /\b(naivas|quickmart|carrefour|chandarana|magunas|cleanshelf|supermarket|mart|shop|store|pharmacy|chemist|hotel|restaurant|petrol|shell|rubis|total|ola energy|hardware)\b/i;

export function findLender(text: string): string | undefined {
  if (!text) return undefined;
  for (const [name, re] of LENDERS) if (re.test(text)) return name;
  return undefined;
}

export function findBank(text: string): string | undefined {
  if (!text) return undefined;
  for (const [name, re] of BANKS) if (re.test(text)) return name;
  return undefined;
}

export function categorise(counterparty: string, kind?: MoneyKind): Category {
  if (counterparty && findLender(counterparty)) return "loan";
  if (counterparty && BETTING.test(counterparty)) return "betting";
  if (counterparty && BILLS.test(counterparty)) return "bills";
  switch (kind) {
    case "received":
      return "income";
    case "withdraw":
    case "deposit":
      return "cash";
    case "airtime":
      return "airtime";
    case "sent":
      return "transfer";
    case "buygoods":
      return "shopping";
    case undefined:
      break;
    default:
      if (kind.startsWith("loan") || kind === "overdraft") return "loan";
  }
  if (counterparty && SHOPS.test(counterparty)) return "shopping";
  return "other";
}

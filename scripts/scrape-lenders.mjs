#!/usr/bin/env node
// Weekly lender price collection for the Compare page, using Firecrawl.
//
// Source: the Kenya Bankers Association "Total Cost of Credit" interest-rate
// report, where every bank and microfinance bank reports its loan rates. One
// Firecrawl scrape (about 1 credit) covers ~45 lenders. Each row keeps its
// source URL and the date the bank last updated it.
//
// Usage: FIRECRAWL_API_KEY=fc-... node scripts/scrape-lenders.mjs
//        node scripts/scrape-lenders.mjs --from-file report.md   (no API call)

import { readFile, writeFile } from "node:fs/promises";
import { parseKbaReport, personalRates } from "./kba-parse.mjs";
import { lenderType, slug } from "./kba-types.mjs";

const REPORT = "https://www.costofcredit.co.ke/site/interest-rate";
const root = new URL("..", import.meta.url);
const outFile = new URL("src/data/lender-products.json", root);
const today = new Date().toISOString().slice(0, 10);

async function fetchReport() {
  const i = process.argv.indexOf("--from-file");
  if (i > 0) return readFile(process.argv[i + 1], "utf8");
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) throw new Error("FIRECRAWL_API_KEY is not set");
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url: REPORT, formats: ["markdown"], onlyMainContent: true, maxAge: 0 }),
    });
    if (res.ok) return (await res.json()).data.markdown;
    if (res.status !== 429 && res.status < 500) throw new Error(`Firecrawl ${res.status}: ${await res.text()}`);
    await new Promise((r) => setTimeout(r, 5000 * 2 ** attempt));
  }
  throw new Error("Firecrawl failed after 3 attempts");
}

const rows = personalRates(parseKbaReport(await fetchReport()));
if (rows.length < 10) throw new Error(`Only ${rows.length} lenders parsed; the report layout may have changed. Keeping the old file.`);

const products = rows.map((r) => ({
  lenderId: slug(r.bank),
  lender: r.bank,
  lenderType: lenderType(r.bank),
  product: "Personal loan, average reported rate",
  rate: r.rate,
  rateMin: r.rateMin,
  rateMax: r.rateMax,
  rateType: "reducing_annual",
  feesIncluded: false,
  sourceUrl: r.sourceUrl,
  rateUpdatedOn: r.updatedOn,
  checkedOn: today,
}));

await writeFile(outFile, JSON.stringify(products, null, 2) + "\n");
console.log(`Wrote ${products.length} lenders`);

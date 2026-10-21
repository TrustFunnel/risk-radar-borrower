#!/usr/bin/env node
// Weekly lender price collection for the Compare page.
//
// For each lender in src/data/lenders.json: find its loan pricing pages with
// Firecrawl search, scrape each page into structured products with Firecrawl's
// JSON extraction, and write every product that has a usable rate to
// src/data/lender-products.json. Each product keeps its source URL and date.
//
// Usage: FIRECRAWL_API_KEY=fc-... node scripts/scrape-lenders.mjs [lenderId ...]

import { readFile, writeFile } from "node:fs/promises";

const API = "https://api.firecrawl.dev/v1";
const KEY = process.env.FIRECRAWL_API_KEY;
if (!KEY) {
  console.error("FIRECRAWL_API_KEY is not set");
  process.exit(1);
}

const root = new URL("..", import.meta.url);
const lenders = JSON.parse(await readFile(new URL("src/data/lenders.json", root), "utf8"));
const outFile = new URL("src/data/lender-products.json", root);
const previous = JSON.parse(await readFile(outFile, "utf8").catch(() => "[]"));
const only = process.argv.slice(2);
const today = new Date().toISOString().slice(0, 10);

const schema = {
  type: "object",
  properties: {
    products: {
      type: "array",
      items: {
        type: "object",
        properties: {
          product: { type: "string", description: "Loan product name" },
          minAmount: { type: "number", description: "Minimum loan amount in KES" },
          maxAmount: { type: "number", description: "Maximum loan amount in KES" },
          minTermMonths: { type: "number" },
          maxTermMonths: { type: "number" },
          rate: { type: "number", description: "Interest rate as a percentage number, e.g. 13 for 13%" },
          rateBasis: {
            type: "string",
            enum: ["reducing_annual", "flat_annual", "flat_monthly", "per_term"],
            description: "reducing_annual = % p.a. on reducing balance; flat_annual = % p.a. flat; flat_monthly = % per month flat; per_term = one charge for the whole loan (e.g. 7.5% for 30 days)",
          },
          feePct: { type: "number", description: "Upfront fees as % of loan (processing, insurance, excise duty), summed" },
          feeFlat: { type: "number", description: "Fixed upfront fees in KES, summed" },
          collateral: { type: "string" },
        },
        required: ["product", "rate", "rateBasis"],
      },
    },
  },
  required: ["products"],
};

const prompt =
  "Extract every personal or consumer loan product on this page that a Kenyan individual could apply for, with its published interest rate and fees. " +
  "Only include figures stated on the page. Skip products with no stated interest rate. Amounts are in KES.";

async function call(path, body, tries = 3) {
  for (let i = 0; i < tries; i++) {
    const res = await fetch(`${API}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) return res.json();
    if (res.status === 429 || res.status >= 500) {
      await new Promise((r) => setTimeout(r, 2000 * 2 ** i));
      continue;
    }
    throw new Error(`${path} ${res.status}: ${await res.text()}`);
  }
  throw new Error(`${path} failed after ${tries} tries`);
}

const valid = (p) => p && typeof p.rate === "number" && p.rate > 0 && p.rate < 1000 && p.rateBasis;

const results = [];
for (const l of lenders) {
  if (only.length && !only.includes(l.id)) continue;
  try {
    const search = await call("/search", { query: `${l.name} Kenya personal loan interest rate fees`, limit: 3, country: "ke" });
    const urls = (search.data ?? []).map((d) => d.url).filter(Boolean);
    const found = [];
    for (const url of urls) {
      const page = await call("/scrape", { url, formats: ["json"], jsonOptions: { schema, prompt }, onlyMainContent: true });
      for (const p of page.data?.json?.products ?? []) {
        if (!valid(p)) continue;
        found.push({
          lenderId: l.id, lender: l.name, lenderType: l.type, product: p.product,
          minAmount: p.minAmount, maxAmount: p.maxAmount, minTermMonths: p.minTermMonths, maxTermMonths: p.maxTermMonths,
          rate: p.rate, rateType: p.rateBasis, feePct: p.feePct, feeFlat: p.feeFlat, collateral: p.collateral,
          sourceUrl: url, checkedOn: today,
        });
      }
      if (found.length) break; // first page with prices wins; keeps credit use low
    }
    console.log(`${l.name}: ${found.length} product(s)`);
    results.push(...(found.length ? found : previous.filter((p) => p.lenderId === l.id)));
  } catch (e) {
    console.error(`${l.name}: ${e.message}`);
    results.push(...previous.filter((p) => p.lenderId === l.id)); // keep last good data
  }
}

// Lenders not in this run keep their previous rows.
const ran = new Set(lenders.filter((l) => !only.length || only.includes(l.id)).map((l) => l.id));
const merged = [...previous.filter((p) => !ran.has(p.lenderId)), ...results];
await writeFile(outFile, JSON.stringify(merged, null, 2) + "\n");
console.log(`Wrote ${merged.length} products`);

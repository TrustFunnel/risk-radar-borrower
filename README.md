# Risk Radar: Loan Wallet

Borrower-side app for Risk Radar EWS (Kenya). Borrowers add every loan they hold, with consent, and get:

- one view of balances, repayments and due dates
- the true APR and total cost of each loan, whatever way the lender quotes it
- a rules-based loan health score (early warning)
- a payoff planner (costliest first or smallest first)
- a consent-gated request for help restructuring or settling a loan in trouble
- a comparison of loan costs across Kenyan lenders, refreshed weekly with Firecrawl

## Run it

```bash
npm install
npm run dev      # http://localhost:3000
npm test         # loan maths tests
```

Until Supabase is configured the app runs in demo mode: data stays in the browser's localStorage.
With Supabase configured, borrowers sign in with their phone number (SMS code via Africa's Talking), their
data is stored in their account, and they get SMS repayment reminders. Setup: [docs/SETUP-accounts.md](docs/SETUP-accounts.md).

## Lender prices

`scripts/scrape-lenders.mjs` uses Firecrawl to scrape the Kenya Bankers Association
[Total Cost of Credit interest-rate report](https://www.costofcredit.co.ke/site/interest-rate), where every bank
and microfinance bank reports its loan rates, and writes `src/data/lender-products.json` (one scrape, about 41
lenders). The GitHub Action `Refresh lender prices` runs it every Monday; it needs the repository secret
`FIRECRAWL_API_KEY`. SACCOs and mobile lenders don't report to KBA; they are listed in `src/data/lenders.json`.

```bash
FIRECRAWL_API_KEY=fc-... npm run scrape
node scripts/scrape-lenders.mjs --from-file scripts/fixtures/kba-interest-rate-2026-10-21.md   # offline
```

## Getting help (remediation)

- **Affordable plan:** reads monthly income from an M-Pesa or bank statement CSV (parsed in the browser) or typed
  figures, sizes the plan on the slower months with a 20% buffer, and proposes a payment and term per loan.
- **Cheaper lender:** proposes a buyout (refinance) by lenders whose typical rate beats the loan after fees.
- **Talk to us:** settlement or advice requests. Every request asks for consent to share that loan only.

## Database

`supabase/migrations/0001_init.sql` holds the schema for accounts mode, with row-level security on every
table that stores personal data, an append-only consent log, and database-enforced consent: loans can't be
saved without the "store" consent, nor help requests without "share_partner". `delete_my_account()` erases
the borrower and everything linked to them.

## Compliance notes (Kenya Data Protection Act 2019)

Before public launch: register with the ODPC as a data controller, complete a DPIA, publish a privacy
notice, and document the basis for any cross-border hosting.

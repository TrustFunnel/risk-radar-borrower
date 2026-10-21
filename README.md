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

## Lender prices

`scripts/scrape-lenders.mjs` searches and scrapes each lender in `src/data/lenders.json` with Firecrawl
and writes `src/data/lender-products.json`. The GitHub Action `Refresh lender prices` runs it every Monday;
it needs the repository secret `FIRECRAWL_API_KEY`.

```bash
FIRECRAWL_API_KEY=fc-... npm run scrape            # all lenders
FIRECRAWL_API_KEY=fc-... npm run scrape kcb tala   # some lenders
```

## Database

`supabase/migrations/0001_init.sql` holds the schema for accounts mode, with row-level security on every
table that stores personal data and an append-only consent log.

## Compliance notes (Kenya Data Protection Act 2019)

Before public launch: register with the ODPC as a data controller, complete a DPIA, publish a privacy
notice, and document the basis for any cross-border hosting.

# Switching on accounts and SMS reminders

Without these settings the app runs in demo mode (data stays in the browser). Each step below can be
done in any order; accounts switch on when the Supabase variables are set and the app is redeployed.

## 1. Supabase (database and phone login)

1. In Vercel, open the project → **Storage** → **Create Database** → **Supabase**, and connect it to
   `risk-radar-borrower`. Vercel adds `SUPABASE_URL`, `SUPABASE_ANON_KEY` and
   `SUPABASE_SERVICE_ROLE_KEY` to the project for you (leave the custom prefix empty);
   `next.config.ts` exposes the first two to the browser.
   (Or create a project at supabase.com and add those three variables by hand.)
2. In Supabase, open **SQL Editor**, paste all of `supabase/migrations/0001_init.sql` and run it.
3. **Authentication → Sign In / Providers → Phone**: turn it on. Leave the SMS provider unset; step 3 below
   sends the codes.
4. **Authentication → Hooks → Send SMS hook**: choose HTTPS, URL
   `https://risk-radar-borrower.vercel.app/api/auth/sms-hook`, click **Generate secret**, save, and copy the
   secret (it starts with `v1,whsec_`) into Vercel as `SEND_SMS_HOOK_SECRET`.

## 2. Africa's Talking (SMS)

1. Sign up at africastalking.com and create a team and app.
2. For testing, use the **sandbox**: `AT_USERNAME=sandbox` and the sandbox API key. Messages appear in the
   sandbox simulator, not on real phones.
3. For real phones, go live, top up airtime, and use your live app username and API key.
4. Optional: request an alphanumeric sender ID (e.g. `RISKRADAR`) and set `AT_SENDER_ID` once approved.
   Without it, messages come from Africa's Talking's shared short code.

## 3. Reminder job

Set `CRON_SECRET` in Vercel to any long random string. Vercel calls `/api/cron/reminders` every day at
05:00 UTC (08:00 in Nairobi). Borrowers who turned on reminders get a text 3 days before and on each
due date.

## 4. Redeploy

Vercel → Deployments → the latest one → **Redeploy**, so the new variables take effect.

All variables are listed in `.env.example`.

## 5. Work details and document uploads (My details screen)

1. In Supabase **SQL Editor**, run `supabase/migrations/0002_work_and_documents.sql`. It adds work details to
   the profile and a `documents` table for what is read from uploads.
2. Create an API key at console.anthropic.com and add it in Vercel as `ANTHROPIC_API_KEY`, then redeploy.
   CRB reports and bank statement PDFs are read with it (roughly US$0.05 to 0.30 per document, depending on
   length). M-PESA statements are read on the phone and need no key.

PDFs are opened in the borrower's browser, including password-protected ones (the M-PESA SMS code, a bank's
ID-number password). Only the text of CRB reports and bank PDFs is sent to `/api/extract`; no file is
stored anywhere, and the password never leaves the phone.

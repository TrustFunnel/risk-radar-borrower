# Switching on WhatsApp for Afueni

The code for the WhatsApp channel is in this repository and tested (see "What is built" below). It talks to
Meta's **WhatsApp Business Platform (Cloud API)** directly, with no middleman, so there is no per-message
markup. To make it live, the steps below must be done by the account owner, because Meta requires a person
to sign in, verify the business and own the phone number.

Steps 1 to 6 let you test with Meta's free **test number** today, before the company is registered.
Steps 7 to 10 move to Afueni's own number and need business verification.

## What is built

| Part | Where |
|---|---|
| Webhook: Meta's verification handshake (GET) and signed message/status events (POST) | `src/app/api/whatsapp/webhook/route.ts` |
| Signature check (`X-Hub-Signature-256`, HMAC-SHA256 with the app secret), payload parsing | `src/lib/whatsapp/webhook.ts` |
| Conversation: welcome, language (English or Kiswahili), consent, name, 7 distress questions, guidance, menu, hand-off to a person, permissions (YES n / STOP n), DELETE, STOP/START, safety words | `src/lib/whatsapp/flow.ts`, wording in `copy.ts` |
| Distress rating (stable, stretched, distressed, crisis) with reasons a coach can read | `src/lib/whatsapp/assess.ts` |
| Sending through the Graph API (text, buttons, lists, templates), one retry on throttling or Meta errors, read receipts, media download | `src/lib/whatsapp/client.ts` |
| Storage in Supabase: contacts, messages with delivery status, consent log, cases, assessments, erasure log; duplicate webhooks ignored; one open case per person | `supabase/migrations/0004_whatsapp.sql`, `src/lib/whatsapp/store.ts` |
| Coach inbox: waiting cases by priority, the chat, reply, follow-up template after 24 hours, download documents and voice notes, hand back to the bot | `/coach` page and `/api/coach/*` |
| SMS alert to the coach on duty when a case opens (no borrower details in the SMS) | `COACH_ALERT_PHONE`, via Africa's Talking |
| Retention: message text cleared after 90 days; people who never agreed (or withdrew) deleted 30 days after their last message | `wa_purge()`, daily cron `/api/cron/whatsapp-retention` |
| "Chat with Afueni on WhatsApp" link on the Get help screen | `src/components/WhatsAppLink.tsx`, shows once `NEXT_PUBLIC_WHATSAPP_NUMBER` is set |

## 1. Meta business portfolio and app (about 20 minutes)

1. Go to [business.facebook.com](https://business.facebook.com) and create a **business portfolio**. Use the
   company's legal name once it is registered; you can rename it later, but verification (step 8) checks
   that the name matches your documents.
2. Go to [developers.facebook.com](https://developers.facebook.com) → **My Apps** → **Create app**. Choose the
   use case **Connect with customers through WhatsApp**, and link it to the business portfolio.
3. In the app, open **WhatsApp → API Setup**. Meta gives you a free **test number** and a temporary access
   token. Under **To**, add your own WhatsApp number as a test recipient (up to 5) and confirm the code.
4. Copy two values from this page into Vercel (step 4): the **Phone number ID** and the **temporary access
   token**. The temporary token expires after 24 hours; step 7 replaces it with a permanent one.
5. In **App settings → Basic**, click **Show** next to **App secret** and copy it.

## 2. Database

In Supabase → **SQL Editor**, paste all of `supabase/migrations/0004_whatsapp.sql` and run it. It is safe to
run more than once.

## 3. Deploy the code

Merge the WhatsApp pull request so Vercel deploys it.

## 4. Environment variables in Vercel

Vercel → project `risk-radar-borrower` → **Settings → Environment Variables**, then **Redeploy**:

| Variable | Value |
|---|---|
| `WHATSAPP_APP_SECRET` | App secret from step 1.5 |
| `WHATSAPP_VERIFY_TOKEN` | Any long random string you make up (also used in step 5) |
| `WHATSAPP_TOKEN` | The access token (temporary for now, permanent after step 7) |
| `WHATSAPP_PHONE_NUMBER_ID` | Phone number ID from API Setup (not the phone number) |
| `COACH_ACCESS_KEY` | A random string of at least 24 characters; coaches type it to open `/coach` |
| `COACH_ALERT_PHONE` | Phone of the coach on duty, e.g. `+2547…`, for SMS alerts (uses the existing Africa's Talking setup) |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | Afueni's WhatsApp number, digits only with 254, once you have it (step 9) |

`SUPABASE_SERVICE_ROLE_KEY` and `CRON_SECRET` are already set from the accounts setup; WhatsApp needs both.

## 5. Connect the webhook

In the Meta app → **WhatsApp → Configuration → Webhook → Edit**:

- **Callback URL:** `https://risk-radar-borrower.vercel.app/api/whatsapp/webhook`
- **Verify token:** the same value as `WHATSAPP_VERIFY_TOKEN`

Click **Verify and save**. If it fails, the variables were not deployed yet: redeploy and try again.
Then under **Webhook fields**, click **Subscribe** next to **messages**.

## 6. First real test (with the test number)

From your phone, send **Hi** to the test number. You should get the Afueni welcome with English and
Kiswahili buttons within a few seconds. Go through the questions, then ask for a person and open
`https://risk-radar-borrower.vercel.app/coach` with the coach key to see the case and reply.

If nothing arrives: Vercel → **Logs**, search `whatsapp`. A 401 means the app secret is wrong; "send failed
(190)" means the token expired.

## 7. Permanent access token

1. [business.facebook.com](https://business.facebook.com) → **Settings → Users → System users → Add**. Name it
   `afueni-server`, role **Admin**.
2. **Assign assets**: the app (full control) and the WhatsApp account (full control).
3. **Generate token**: choose the app, expiry **Never**, permissions `whatsapp_business_messaging` and
   `whatsapp_business_management`. Copy it into `WHATSAPP_TOKEN` and redeploy. Store it only in Vercel.

## 8. Business verification

Business portfolio → **Settings → Security Center → Start verification**. Meta asks for the registered
business name, address and phone, and documents such as the certificate of incorporation and KRA PIN
certificate, plus a website or email on a domain in the business's name. It usually takes a few working
days. Until verified, the account is limited (fewer phone numbers, and business-started messages to
a limited number of people per day); replies to people who message you first are not affected.

## 9. Afueni's own number

1. Choose a number that is **not** active on WhatsApp (or delete WhatsApp from it first) and can receive an
   SMS or call for the code. A new Safaricom or Airtel line is simplest.
   *Alternative:* if you want coaches to keep using the WhatsApp Business app on the same number, Meta's
   "coexistence" onboarding allows the app and the API together. Check it is offered for Kenyan numbers when
   you add the number.
2. WhatsApp Manager → **Phone numbers → Add phone number**. Display name: **Afueni by Risk Radar** (Meta
   reviews it against the business name; the Afueni name clearance is still open, see below).
3. Enter the code, set a **two-step verification PIN**, and keep the PIN somewhere safe.
4. Copy the new number's **Phone number ID** into `WHATSAPP_PHONE_NUMBER_ID`, set
   `NEXT_PUBLIC_WHATSAPP_NUMBER`, and redeploy. The webhook from step 5 stays the same.
5. Add a payment card in WhatsApp Manager → **Payment settings**.

## 10. Follow-up template

WhatsApp only allows free text within 24 hours of the borrower's last message. After that, the coach inbox
sends an approved template that asks them to reply. Create it in WhatsApp Manager → **Message templates →
Create template**:

- Category **Utility**, name `afueni_follow_up`, languages **English** and **Swahili**
- English body: `Hi {{1}}, this is your Afueni coach following up on your loans. Please reply to this message so we can continue.`
- Swahili body: `Habari {{1}}, huyu ni kocha wako wa Afueni akifuatilia kuhusu mikopo yako. Tafadhali jibu ujumbe huu ili tuendelee.`
- Sample for `{{1}}`: `Mercy`

Approval usually takes minutes to a day.

## Costs (Meta's pricing from 1 October 2026)

- Messages people send you: free.
- Replies within 24 hours ("service" messages): the first 1,000 a month per number are free, then charged per
  delivered message at Meta's Kenya rate (see Meta's rate card in WhatsApp Manager).
- Templates (the follow-up): charged per delivered message.
- One full onboarding is about 11 bot messages, so the free tier covers roughly 80 to 90 new borrowers a
  month before coach replies. Delivery statuses in `wa_messages.pricing_category` show what was billed.

## Before public launch

- Register with the ODPC as data controller and processor, and complete the DPIA (WhatsApp data goes to Meta).
- A native speaker checks every Kiswahili line in `src/lib/whatsapp/copy.ts`.
- Confirm the helplines in the safety message (Kenya Red Cross 1199; 999 and 112) and the legal-aid referral.
- A lawyer reviews the consent and privacy wording, and the "free for borrowers" and "we never lend money" claims.
- Clear the Afueni name (Afueni Microfinance Ltd exists) before the display name and templates go to Meta.
- Swap the shared coach key for individual coach sign-ins before the team grows beyond the pilot.

## Simulating without Meta

`npm run wa:simulate` plays both sides of Meta against a running app: it sends signed webhooks and runs a
mock Graph API that records what the app sends. Start the app with the settings in the comment at the top
of `scripts/wa-simulate.mjs` (in-memory storage, nothing leaves the machine). It checks the security,
both languages, coach hand-off, delivery statuses, permissions, safety escalation, erasure and STOP, and
can write a transcript with `--out transcript.md`.

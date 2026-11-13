# Money messages: reading M-PESA, bank and lender SMS as they arrive

Afueni reads the transaction SMS a borrower already receives (M-PESA, Airtel Money, banks, MFIs and
digital lenders) so its warnings and the affordable plan stay current, instead of waiting for a monthly
statement upload.

## How it works

| Phone | How messages reach Afueni |
|---|---|
| Afueni Android app (`android/`) | Read automatically as they arrive, plus the last 6 months on first switch-on |
| Installed web app on Android | Press and hold a money SMS, **Share**, choose Afueni |
| Any phone, including iPhone | Copy and paste one or more messages on the **Money messages** screen (`/money`) |

Every route ends in the same place: `src/lib/money/parse.ts` reads the SMS **on the phone** into a small
transaction event (amount, date, type, balance, fee, business or lender name, due date, days overdue).
Only that event is saved, to the `money_events` table (`supabase/migrations/0005_money_messages.sql`).

### Privacy by design (Kenya Data Protection Act 2019; Google Play SMS policy)

- **Separate, explicit consent**: purpose `sms_read`, asked on the Money screen, not bundled into sign-up.
  The database refuses events without it (restrictive RLS policy).
- **Filtered twice before anything is read**: the Android code (`MoneySenders.java`) drops every SMS from
  a phone number and every SMS without a KES amount and a money word, so personal messages never reach
  the app. The parser then returns nothing for anything it doesn't recognise.
- **Minimised**: the SMS text is never stored or uploaded. Names and phone numbers of people are dropped;
  only business and lender names are kept. M-PESA receipt numbers are kept only as a one-way hash, to
  avoid counting the same message twice.
- **Shared text stays off the server**: shared SMS travel after a `#` in the address, which browsers never
  send to a server (`public/sw.js`, `AfueniSmsPlugin.openShared`).
- **Easy to stop**: switching off (Money screen or Account) deletes everything captured. The database also
  deletes on withdrawal (trigger) and purges events older than 24 months (`money_events_purge()`).
- **No backups**: the Android app opts out of cloud backup and device transfer, so queued messages never
  leave the phone that way.

### What the borrower gets

- **Last 30 days** on the Money screen: money in, spent, repaid to lenders, borrowed.
- **Early warnings** (`src/lib/money/signals.ts`): overdue notices not yet paid, repayments due in the next
  7 days, new loans from two or more lenders in 30 days, frequent Fuliza, betting above 10% of money in,
  repayments above 30% / 50% of money in, and days with M-PESA balance under KES 100.
- **Affordable plan**: each whole month of messages can be added to income, like a statement month.

## Android app

`android/` is a Capacitor 8 app. It shows the live website (`capacitor.config.ts`, `server.url`; set
`AFUENI_URL` to point it at another deployment) and adds one native plugin, `AfueniSms`:

- `SmsReceiver.java` listens for incoming SMS. Money messages go straight to the open app, or wait in
  private storage (`SmsQueue.java`, max 500 messages / 30 days) until the app next opens.
- `AfueniSmsPlugin.java` exposes `status`, `requestPermission`, `setEnabled`, `drain` and `readInbox` to
  the web app (`src/lib/money/native.ts`, `src/components/MoneyCapture.tsx`), and opens text shared from
  the SMS app on the Money screen.

### Build

The **Android app** GitHub Action builds a debug APK on every change and attaches it to the run (Actions,
the run, **Artifacts**, `afueni-debug-apk`). Install it on a test phone (allow "install unknown apps").

Locally, with Android Studio installed:

```bash
npm ci
npx cap sync android
npx cap open android   # then Run, or: cd android && ./gradlew assembleDebug
```

### Releasing on Google Play (Davine)

1. **Developer account**: create a Google Play Console account as an organisation (one-off USD 25). It
   needs the company's D-U-N-S number, so it follows company registration.
2. **App signing key**: in Android Studio, Build, Generate Signed App Bundle, create a key store. Keep
   the key store file and passwords somewhere safe; losing them blocks updates. Enrol in Play App Signing.
3. **Privacy policy URL**: must name SMS access, what is kept, and how to delete it (the consent text and
   the "Privacy by design" list above are the basis). Have the lawyer review it with the DPIA.
4. **Permissions declaration** (Play Console, App content, Sensitive permissions): choose
   **SMS-based money management** as the core use and paste the text below.
5. **Demo video**: a 30 to 60 second screen recording: open Afueni, Money messages, the consent screen,
   Allow SMS reading, the Android permission prompt, the captured transactions and a warning.
6. **Data safety form**: declare "Financial info: other financial info" collected, not shared, encrypted in
   transit, deletable by the user. SMS content itself is processed on the device and not collected.
7. Submit to an **internal testing** track first; the pilot borrowers can be added as testers.

Suggested declaration text:

> Afueni is a debt-management app for Kenyan borrowers. Its core feature reads transaction SMS from
> M-PESA, Airtel Money, banks and lenders to track the user's income, spending and loan repayments, warn
> them before a loan goes into arrears, and build an affordable repayment plan. SMS access is requested
> only after the user turns on "Read my money messages" and gives explicit consent in the app. Messages
> are filtered on the device: messages from phone numbers and messages without a transaction amount are
> ignored. Only the parsed amount, date, type, balance and business or lender name are stored; message
> text, personal messages and contacts are never uploaded or shared. The user can switch the feature off
> and delete the captured data at any time in the app.

Google reviews each declaration and may refuse. If it does, share and paste keep working, and the app
can be republished without the SMS permissions.

## Database

Run `supabase/migrations/0005_money_messages.sql` in the Supabase SQL Editor. Until it is run, the rest of
the app works as before, but switching on money messages shows a "Couldn't save" error.

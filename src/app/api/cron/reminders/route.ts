// Daily repayment reminders by SMS (Vercel cron, see vercel.json). Texts each
// borrower who consented to reminders 3 days before and on each due date, at
// most once per loan, due date and kind.
import { nairobiToday, latestConsent, remindersFor } from "@/lib/reminders";
import { consentFromRow, loanFromRow } from "@/lib/rows";
import { sendSms } from "@/lib/sms";
import { serviceClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const db = serviceClient();
  const today = nairobiToday();

  const { data: profiles, error } = await db.from("profiles").select("user_id, phone").not("phone", "is", null);
  if (error) return Response.json({ error: error.message }, { status: 500 });

  let sent = 0, skipped = 0, failed = 0;
  for (const p of profiles ?? []) {
    const [{ data: consents }, { data: loans }] = await Promise.all([
      db.from("consents").select("*").eq("user_id", p.user_id),
      db.from("loans").select("*").eq("user_id", p.user_id).neq("status", "closed"),
    ]);
    if (!latestConsent((consents ?? []).map(consentFromRow), "reminders")) continue;

    for (const r of remindersFor((loans ?? []).map(loanFromRow), today)) {
      // Claim the slot first; the unique key stops a second run texting again.
      const { error: dup } = await db.from("reminder_log").insert({ loan_id: r.loanId, due_date: r.dueDate, kind: r.kind });
      if (dup) { skipped++; continue; }
      const res = await sendSms(p.phone as string, r.message);
      await db.from("reminder_log").update({ provider_status: res.status }).match({ loan_id: r.loanId, due_date: r.dueDate, kind: r.kind });
      if (res.ok) sent++; else failed++;
    }
  }
  return Response.json({ date: today.toDateString(), sent, skipped, failed });
}

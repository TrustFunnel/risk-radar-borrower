// Supabase "Send SMS" auth hook: Supabase calls this with the login code and
// we text it through Africa's Talking (Supabase has no built-in Kenyan provider).
import { sendSms, verifyHook } from "@/lib/sms";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const secret = process.env.SEND_SMS_HOOK_SECRET;
  const body = await req.text();
  if (!secret || !verifyHook(secret, req.headers, body)) {
    return Response.json({ error: { http_code: 401, message: "Invalid signature" } }, { status: 401 });
  }
  const { user, sms } = JSON.parse(body) as { user: { phone: string }; sms: { otp: string } };
  const to = user.phone.startsWith("+") ? user.phone : `+${user.phone}`;
  const r = await sendSms(to, `Your Risk Radar code is ${sms.otp}. It expires in 10 minutes. Never share it with anyone, including callers who say they are from Risk Radar.`);
  if (!r.ok) {
    // Shows in Vercel's function logs; the phone number and code are left out.
    console.error("sms-hook: Africa's Talking refused the message:", r.status);
    return Response.json({ error: { http_code: 502, message: `SMS failed: ${r.status}` } }, { status: 502 });
  }
  return Response.json({});
}

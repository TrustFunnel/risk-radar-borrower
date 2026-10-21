// Server-only: sending SMS through Africa's Talking, and verifying the
// Supabase "Send SMS" auth hook that asks us to deliver login codes.
import { createHmac, timingSafeEqual } from "node:crypto";

export interface SmsResult {
  ok: boolean;
  status: string; // provider status, e.g. "Success" or the error text
}

// Africa's Talking bulk SMS API. AT_USERNAME "sandbox" uses their sandbox,
// which delivers to the simulator only.
export async function sendSms(to: string, message: string): Promise<SmsResult> {
  const username = process.env.AT_USERNAME;
  const apiKey = process.env.AT_API_KEY;
  if (!username || !apiKey) return { ok: false, status: "Africa's Talking is not configured" };
  const host = username === "sandbox" ? "api.sandbox.africastalking.com" : "api.africastalking.com";
  const body = new URLSearchParams({ username, to, message });
  if (process.env.AT_SENDER_ID) body.set("from", process.env.AT_SENDER_ID);
  const res = await fetch(`https://${host}/version1/messaging`, {
    method: "POST",
    headers: { apiKey, Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) return { ok: false, status: `HTTP ${res.status}: ${await res.text()}` };
  const json = (await res.json()) as { SMSMessageData?: { Recipients?: { status: string }[]; Message?: string } };
  const r = json.SMSMessageData?.Recipients?.[0];
  return r ? { ok: r.status === "Success", status: r.status } : { ok: false, status: json.SMSMessageData?.Message ?? "No recipient in response" };
}

// Supabase auth hooks are signed with the Standard Webhooks scheme:
// HMAC-SHA256 over "<id>.<timestamp>.<body>", keyed with the base64 secret
// after its "v1,whsec_" prefix. Rejects anything older than 5 minutes.
export function verifyHook(secret: string, headers: Headers, body: string, now = Date.now()): boolean {
  const id = headers.get("webhook-id");
  const ts = headers.get("webhook-timestamp");
  const sigs = headers.get("webhook-signature");
  if (!id || !ts || !sigs) return false;
  if (Math.abs(now / 1000 - Number(ts)) > 300) return false;
  const key = Buffer.from(secret.replace(/^v1,/, "").replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key).update(`${id}.${ts}.${body}`).digest();
  return sigs.split(" ").some((s) => {
    const [version, sig] = s.split(",");
    if (version !== "v1" || !sig) return false;
    const got = Buffer.from(sig, "base64");
    return got.length === expected.length && timingSafeEqual(got, expected);
  });
}

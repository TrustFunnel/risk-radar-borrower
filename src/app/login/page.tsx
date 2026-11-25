"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "@/components/Session";
import { AlertIcon, LockIcon, MessageIcon, PhoneIcon } from "@/components/Icons";
import { IconTile } from "@/components/ui";
import { normaliseKenyanPhone, supabase } from "@/lib/supabase";

export default function Login() {
  const router = useRouter();
  const session = useSession();
  const [phone, setPhone] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (session.status === "demo" || session.status === "signedIn") router.replace("/");
  }, [session.status, router]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const e164 = normaliseKenyanPhone(phone);
    if (!e164) { setError("Enter a Kenyan mobile number, e.g. 0712 345 678."); return; }
    setBusy(true); setError("");
    const { error } = await supabase!.auth.signInWithOtp({ phone: e164 });
    setBusy(false);
    if (error) setError(error.message);
    else setSentTo(e164);
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError("");
    const { error } = await supabase!.auth.verifyOtp({ phone: sentTo!, token: code.trim(), type: "sms" });
    setBusy(false);
    if (error) setError(error.message === "Token has expired or is invalid" ? "That code is wrong or has expired. Try again or request a new one." : error.message);
    else router.replace("/");
  }

  return (
    <div className="space-y-5 py-4">
      <section className="flex items-start gap-4">
        <IconTile icon={PhoneIcon} size="lg" />
        <div>
          <h1 className="text-[1.75rem] font-bold leading-tight">Sign in with your phone</h1>
          <p className="mt-1 text-[0.9375rem] text-muted">We text you a 6-digit code. No password.</p>
        </div>
      </section>
      {!sentTo ? (
        <form onSubmit={send} className="card space-y-4">
          <label className="block"><span className="label">Mobile number</span>
            <input className="input num" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0712 345 678" />
          </label>
          {error ? <p className="flex items-center gap-1.5 text-sm text-bad" role="alert"><AlertIcon className="h-4 w-4 shrink-0" />{error}</p> : null}
          <button className="btn w-full" disabled={busy || !phone.trim()}><MessageIcon className="h-5 w-5" />{busy ? "Sending…" : "Text me a code"}</button>
          <p className="flex gap-2 text-xs text-muted"><LockIcon className="h-4 w-4 shrink-0" />Your loans follow you to any phone you sign in on.</p>
        </form>
      ) : (
        <form onSubmit={verify} className="card space-y-4">
          <label className="block"><span className="label">Code sent to {sentTo}</span>
            <input className="input num text-center text-xl font-semibold tracking-[0.4em]" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="123456" />
          </label>
          {error ? <p className="flex items-center gap-1.5 text-sm text-bad" role="alert"><AlertIcon className="h-4 w-4 shrink-0" />{error}</p> : null}
          <button className="btn w-full" disabled={busy || code.length < 6}><LockIcon className="h-5 w-5" />{busy ? "Checking…" : "Sign in"}</button>
          <button type="button" className="w-full rounded-full py-2 text-sm font-medium text-muted underline" onClick={() => { setSentTo(null); setCode(""); setError(""); }}>Use a different number</button>
        </form>
      )}
    </div>
  );
}

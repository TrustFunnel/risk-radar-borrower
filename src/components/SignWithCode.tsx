"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { AlertIcon, LockIcon } from "./Icons";
import { useSession } from "./Session";

// The borrower signs their plan with a one-time code sent to their phone,
// the same way they sign in. In demo mode (no accounts) they type AGREE.
export function SignWithCode({ disabled, label, onSigned }: { disabled?: boolean; label: string; onSigned: () => void }) {
  const session = useSession();
  const phone = session.phone;
  const real = session.status === "signedIn" && !!supabase && !!phone;
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function send() {
    setBusy(true); setError("");
    const { error } = await supabase!.auth.signInWithOtp({ phone: phone!, options: { shouldCreateUser: false } });
    setBusy(false);
    if (error) setError(error.message); else setSent(true);
  }

  async function verify() {
    setBusy(true); setError("");
    const { error } = await supabase!.auth.verifyOtp({ phone: phone!, token: code.trim(), type: "sms" });
    setBusy(false);
    if (error) setError("That code is wrong or has expired. Try again or ask for a new one.");
    else onSigned();
  }

  if (!real) {
    return (
      <div className="space-y-2">
        <label className="block"><span className="label">Type AGREE to sign (demo mode: no code is sent)</span>
          <input className="input uppercase" value={code} onChange={(e) => setCode(e.target.value)} placeholder="AGREE" />
        </label>
        <button className="btn w-full" disabled={disabled || code.trim().toUpperCase() !== "AGREE"} onClick={onSigned}><LockIcon className="h-5 w-5" />{label}</button>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {!sent ? (
        <button className="btn w-full" disabled={disabled || busy} onClick={send}>{busy ? "Sending…" : "Text me a code to sign"}</button>
      ) : (
        <>
          <label className="block"><span className="label">Code sent to {phone}</span>
            <input className="input num text-center text-xl font-semibold tracking-[0.4em]" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="123456" />
          </label>
          <button className="btn w-full" disabled={disabled || busy || code.length < 6} onClick={verify}>{busy ? "Checking…" : <><LockIcon className="h-5 w-5" />{label}</>}</button>
        </>
      )}
      {error ? <p className="flex items-center gap-1.5 text-sm text-bad" role="alert"><AlertIcon className="h-4 w-4 shrink-0" />{error}</p> : null}
    </div>
  );
}

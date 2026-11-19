"use client";

import Link from "next/link";
import { useState } from "react";
import { BrandText } from "@/components/BrandText";
import { Gate } from "@/components/Gate";
import { store } from "@/lib/store";
import { CONSENT_TEXT, type PauseRequest } from "@/lib/types";
import { useDb } from "@/lib/useStore";

const REASONS: { value: PauseRequest["reason"]; label: string; proof: string }[] = [
  { value: "illness", label: "Illness or an accident", proof: "a hospital bill or discharge note" },
  { value: "death", label: "A death in the family", proof: "a burial notice or permit" },
  { value: "job_loss", label: "I lost my job or income", proof: "a termination letter or a chief's letter" },
  { value: "theft", label: "My motorbike, stock or tools were stolen", proof: "a police abstract (OB number)" },
  { value: "harvest", label: "A failed harvest or flood", proof: "a chief's or extension officer's letter" },
  { value: "other", label: "Something else", proof: "anything that shows what happened" },
];

export default function PausePage() {
  return <Gate><PauseInner /></Gate>;
}

// Afueni Pause: up to 30 days' breathing space after a verified shock,
// modelled on the UK's Breathing Space and made voluntary through the
// Creditor Code (strategy doc, process I).
function PauseInner() {
  const { db } = useDb();
  const plan = store.livePlan(db);
  const [reason, setReason] = useState<PauseRequest["reason"]>("illness");
  const [details, setDetails] = useState("");
  const [days, setDays] = useState(30);
  const [authority, setAuthority] = useState(store.hasConsent("act_for_me", db));
  const [sent, setSent] = useState(false);
  const open = db.loans.filter((l) => l.status !== "closed");
  const r = REASONS.find((x) => x.value === reason)!;
  const pending = plan?.pause && plan.pause.status === "requested";

  function send() {
    store.setConsent("act_for_me", true);
    const pause: PauseRequest = { reason, details: details.trim(), proof: r.proof, days, requestedAt: new Date().toISOString(), status: "requested" };
    if (plan) store.savePlan({ ...plan, status: "paused", pause });
    store.addRequest({ loanId: plan?.lenders[0]?.loanId ?? open[0].id, goal: "pause", message: `${plan ? plan.ref + ": " : ""}Pause ${days} days. ${r.label}. ${details.trim()} Proof: ${r.proof}.` });
    setSent(true);
  }

  if (!open.length && !plan) return <p className="card my-2 text-sm text-muted">Add your loans first.</p>;

  return (
    <div className="space-y-4 py-2">
      <Link href="/plan" className="text-sm text-brand">← My plan</Link>
      <h1 className="text-xl font-bold">Afueni Pause</h1>
      <p className="text-sm text-muted">Up to 30 days&apos; breathing space after a shock. We ask every lender on the Creditor Code to hold payments and freeze penalties, then rebuild your plan on your new income before the pause ends.</p>

      {sent || pending ? (
        <section className="card border-good space-y-1">
          <p className="font-semibold text-good">Pause requested</p>
          <p className="text-sm text-muted">Within one working day we ask your lenders for the pause. Send your proof ({plan?.pause?.proof ?? r.proof}) on WhatsApp or to your coach. Keep paying anything you can; nothing is lost by paying.</p>
        </section>
      ) : (
        <section className="card space-y-3">
          <span className="label">What happened?</span>
          {REASONS.map((x) => (
            <label key={x.value} className={`flex items-center gap-3 rounded-xl border p-3 text-sm ${reason === x.value ? "border-brand bg-brand-soft" : "border-line"}`}>
              <input type="radio" name="reason" checked={reason === x.value} onChange={() => setReason(x.value)} />{x.label}
            </label>
          ))}
          <label className="block"><span className="label">Tell us a little more (optional)</span>
            <textarea className="input min-h-20" value={details} onChange={(e) => setDetails(e.target.value)} placeholder="e.g. My daughter was admitted on 3 November" />
          </label>
          <label className="block"><span className="label">Breathing space: {days} days</span>
            <input type="range" min={7} max={30} step={1} value={days} onChange={(e) => setDays(Number(e.target.value))} className="w-full accent-[var(--brand)]" />
          </label>
          <p className="text-xs text-muted">Simple proof helps lenders say yes: {r.proof}. You can send it after this request.</p>
          <label className="flex items-start gap-3 rounded-xl border border-line p-3">
            <input type="checkbox" className="mt-1" checked={authority} onChange={(e) => setAuthority(e.target.checked)} />
            <span><span className="block text-sm font-medium">{CONSENT_TEXT.act_for_me.title}</span><span className="block text-xs text-muted"><BrandText>{CONSENT_TEXT.act_for_me.body}</BrandText></span></span>
          </label>
          <button className="btn w-full" disabled={!authority} onClick={send}>Ask my lenders for a pause</button>
          <p className="text-xs text-muted">Lenders who have not signed the Code may say no. Your coach will still help you talk to them.</p>
        </section>
      )}
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { store } from "@/lib/store";
import { CONSENT_TEXT, CONSENT_VERSION, type ConsentPurpose } from "@/lib/types";

const PURPOSES: ConsentPurpose[] = ["store", "analyse", "reminders"];

export default function Welcome() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [income, setIncome] = useState("");
  const [picked, setPicked] = useState<Record<ConsentPurpose, boolean>>({ store: false, analyse: true, reminders: true, share_partner: false });

  const canStart = picked.store && name.trim().length > 0;

  function start() {
    for (const p of PURPOSES) store.setConsent(p, picked[p]);
    store.saveProfile({ displayName: name.trim(), monthlyIncome: Number(income) || 0 });
    router.replace("/");
  }

  return (
    <div className="space-y-5 py-4">
      <section>
        <h1 className="text-2xl font-bold">All your loans, one honest view</h1>
        <p className="mt-2 text-sm text-muted">
          Add the loans you have, from banks, SACCOs, microfinance or mobile apps. We show what each one really costs,
          when every payment is due, and warn you early if things are getting tight. We never lend to you and never sell your data.
        </p>
      </section>

      <section className="card space-y-3">
        <div>
          <label className="label" htmlFor="name">What should we call you?</label>
          <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="First name" />
        </div>
        <div>
          <label className="label" htmlFor="income">Monthly take-home income (KES), optional</label>
          <input id="income" className="input num" inputMode="numeric" value={income} onChange={(e) => setIncome(e.target.value.replace(/[^\d]/g, ""))} placeholder="e.g. 45000" />
          <p className="mt-1 text-xs text-muted">Used only to work out how much of your income goes to loans.</p>
        </div>
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold">Your consent</h2>
        <p className="text-xs text-muted">
          Under the Kenya Data Protection Act 2019 you choose what we do with your data. You can change any of these later in Account,
          download everything we hold, or delete it.
        </p>
        {PURPOSES.map((p) => (
          <label key={p} className="flex items-start gap-3 rounded-xl border border-line p-3">
            <input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--brand)]" checked={picked[p]} onChange={(e) => setPicked({ ...picked, [p]: e.target.checked })} />
            <span>
              <span className="block text-sm font-medium">
                {CONSENT_TEXT[p].title} {CONSENT_TEXT[p].required ? <span className="text-xs text-muted">(required)</span> : null}
              </span>
              <span className="block text-xs text-muted">{CONSENT_TEXT[p].body}</span>
            </span>
          </label>
        ))}
        <p className="text-xs text-muted">Sharing a loan with a help partner is asked separately, each time you request help. Consent version {CONSENT_VERSION}.</p>
      </section>

      <button className="btn w-full" disabled={!canStart} onClick={start}>Start my loan wallet</button>
      <p className="text-center text-xs text-muted">Demo mode: your data stays in this browser until accounts are switched on.</p>
    </div>
  );
}

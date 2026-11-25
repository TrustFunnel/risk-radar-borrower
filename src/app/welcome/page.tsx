"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BrandText } from "@/components/BrandText";
import { ArrowRight, CalendarIcon, ChatIcon, DocIcon, LockIcon, ShieldIcon } from "@/components/Icons";
import { Loading } from "@/components/Gate";
import { useSession } from "@/components/Session";
import { store } from "@/lib/store";
import { CONSENT_TEXT, CONSENT_VERSION, type ConsentPurpose } from "@/lib/types";

const PURPOSES: ConsentPurpose[] = ["store", "analyse", "ai_read", "reminders"];

export default function Welcome() {
  const router = useRouter();
  const session = useSession();
  const [name, setName] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const demo = session.status === "signedIn" ? store.localDemoData() : null;

  useEffect(() => {
    if (session.status === "signedOut") router.replace("/login");
  }, [session.status, router]);
  const [income, setIncome] = useState("");
  const [picked, setPicked] = useState<Record<ConsentPurpose, boolean>>({ store: false, analyse: true, ai_read: false, reminders: true, share_partner: false, sms_read: false, share_plan: false, act_for_me: false, graduates: false });

  const canStart = picked.store && name.trim().length > 0;

  async function start() {
    for (const p of PURPOSES) store.setConsent(p, picked[p]);
    store.saveProfile({ displayName: name.trim(), monthlyIncome: Number(income) || 0, phone: session.phone });
    if (demo && importing) {
      try {
        await store.importLocal();
      } catch (e) {
        setImportError(`We couldn't copy your loans from this phone: ${(e as Error).message}. They're still here; try again from Account.`);
        return;
      }
    }
    router.replace("/");
  }

  if (session.status === "loading" || session.status === "signedOut") return <Loading />;

  return (
    <div className="space-y-5 py-4">
      <section className="hero">
        <h1 className="text-[1.75rem] font-bold leading-tight tracking-tight">A helping hand towards <span className="hero-gold">debt freedom</span></h1>
        <ul className="mt-5 space-y-3 text-[0.9375rem]">
          {[{ I: DocIcon, t: "Send us your statement. We find all your loans." }, { I: ShieldIcon, t: "We work out what you can really pay." }, { I: ChatIcon, t: "We talk to your lenders for you." }, { I: CalendarIcon, t: "One payment. The calls stop. You see the day you'll be free." }].map(({ I, t }) => (
            <li key={t} className="flex items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-[#ffcf3f] ring-1 ring-white/10"><I className="h-5 w-5" /></span>{t}</li>
          ))}
        </ul>
        <p className="hero-muted mt-5 flex items-center gap-2 border-t border-white/10 pt-4 text-sm"><LockIcon className="h-4 w-4 shrink-0" />Free. We never lend to you, never ask for your contacts and never sell your data.</p>
      </section>

      <section className="card space-y-4">
        <div>
          <label className="label" htmlFor="name">What should we call you?</label>
          <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="First name" />
        </div>
        <div>
          <label className="label" htmlFor="income">Monthly take-home income (KES), optional</label>
          <input id="income" className="input num" inputMode="numeric" value={income} onChange={(e) => setIncome(e.target.value.replace(/[^\d]/g, ""))} placeholder="e.g. 45000" />
          <p className="mt-1.5 text-xs text-muted">Used only to work out a payment you can afford.</p>
        </div>
      </section>

      <section className="card space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-bold"><ShieldIcon className="h-5 w-5 text-brand" />Your consent</h2>
        <p className="text-xs text-muted">
          Under the Kenya Data Protection Act 2019 you choose what we do with your data. You can change any of these later in Account,
          download everything we hold, or delete it.
        </p>
        {PURPOSES.map((p) => (
          <label key={p} className="choice">
            <input type="checkbox" className="mt-0.5" checked={picked[p]} onChange={(e) => setPicked({ ...picked, [p]: e.target.checked })} />
            <span>
              <span className="block text-sm font-medium">
                {CONSENT_TEXT[p].title} {CONSENT_TEXT[p].required ? <span className="badge badge-gold ml-1 align-middle">Required</span> : null}
              </span>
              <span className="block text-xs text-muted"><BrandText>{CONSENT_TEXT[p].body}</BrandText></span>
            </span>
          </label>
        ))}
        <p className="text-xs text-muted">Sharing your plan with lenders, and letting us talk to them for you, are asked separately when you build your plan. Consent version {CONSENT_VERSION}.</p>
      </section>

      {demo ? (
        <label className="choice text-sm">
          <input type="checkbox" className="mt-0.5" checked={importing} onChange={(e) => setImporting(e.target.checked)} />
          <span>Copy the {demo.loans.length} loan{demo.loans.length === 1 ? "" : "s"} you added on this phone before signing in into my account.</span>
        </label>
      ) : null}
      {importError ? <p className="alert alert-bad text-bad" role="alert">{importError}</p> : null}

      <button className="btn w-full !min-h-14 !text-base" disabled={!canStart} onClick={start}>Start<ArrowRight className="h-5 w-5" /></button>
      {session.status === "demo" ? <p className="text-center text-xs text-muted">Demo mode: your data stays in this browser until accounts are switched on.</p> : null}
    </div>
  );
}

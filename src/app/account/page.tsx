"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Gate } from "@/components/Gate";
import { BrandText } from "@/components/BrandText";
import { useSession } from "@/components/Session";
import { supabase } from "@/lib/supabase";
import { store } from "@/lib/store";
import { CONSENT_TEXT, type ConsentPurpose } from "@/lib/types";
import { useDb } from "@/lib/useStore";
import { DocIcon, DownloadIcon, GradIcon, LockIcon, LogoutIcon, PhoneIcon, ShieldIcon, SunIcon, TrashIcon, UploadIcon, UserIcon, WalletIcon, AlertIcon } from "@/components/Icons";
import { IconTile, PageHeader, RowLink, Switch, ThemeSwitch } from "@/components/ui";

const TOGGLES: ConsentPurpose[] = ["analyse", "ai_read", "reminders", "sms_read", "share_plan", "act_for_me"];

export default function Account() {
  return <Gate><AccountInner /></Gate>;
}

function AccountInner() {
  const { db } = useDb();
  const router = useRouter();
  const session = useSession();
  const [deleteError, setDeleteError] = useState("");
  const localDemo = session.status === "signedIn" ? store.localDemoData() : null;

  async function deleteEverything() {
    if (!confirm("Delete all your loans, consents and profile? This cannot be undone.")) return;
    try {
      await store.deleteAll();
      router.replace(session.status === "demo" ? "/welcome" : "/login");
    } catch (e) {
      setDeleteError(`Couldn't delete your account: ${(e as Error).message}`);
    }
  }
  const [income, setIncome] = useState(String(db.profile?.monthlyIncome ?? ""));

  function download() {
    const blob = new Blob([store.exportAll()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "my-loan-data.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="space-y-5 py-2">
      <PageHeader icon={UserIcon} title="Account and privacy" />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] lg:items-start">
      <div className="space-y-5">
      {session.status === "signedIn" ? (
        <section className="card flex items-center gap-3">
          <IconTile icon={PhoneIcon} tone="plain" />
          <div className="min-w-0 flex-1"><p className="eyebrow">Signed in as</p><p className="num font-semibold">{db.profile?.phone ?? session.phone}</p></div>
          <button className="btn-ghost btn-sm" onClick={() => supabase?.auth.signOut()}><LogoutIcon className="h-4 w-4" />Sign out</button>
        </section>
      ) : null}
      {localDemo ? (
        <section className="card space-y-3 text-sm">
          <p className="flex items-center gap-2"><UploadIcon className="h-5 w-5 text-brand" />{localDemo.loans.length} loan(s) from before you signed in are still on this phone.</p>
          <button className="btn-ghost w-full" onClick={() => store.importLocal().catch((e) => setDeleteError((e as Error).message))}>Copy to account</button>
        </section>
      ) : null}
      <RowLink href="/profile" icon={DocIcon} title="My details" sub="Work, CRB report, M-PESA and bank statements" />

      <section className="card space-y-3">
        <label className="block"><span className="label">Monthly take-home income (KES)</span>
          <input className="input num" inputMode="numeric" value={income} onChange={(e) => setIncome(e.target.value.replace(/[^\d]/g, ""))} />
        </label>
        <button className="btn-ghost w-full sm:w-auto" onClick={() => db.profile && store.saveProfile({ ...db.profile, monthlyIncome: Number(income) || 0 })}><WalletIcon className="h-5 w-5" />Save income</button>
      </section>

      <section className="card space-y-3">
        <h2 className="flex items-center gap-2 font-semibold"><SunIcon className="h-5 w-5 text-brand" />Look</h2>
        <ThemeSwitch />
      </section>

      <RowLink href="/graduates" icon={GradIcon} tone="good" title="Afueni Graduates" sub="For people who finished their plan" />
      </div>

      <div className="space-y-5">
      <section className="card space-y-1">
        <h2 className="mb-2 flex items-center gap-2 font-semibold"><ShieldIcon className="h-5 w-5 text-brand" />Consents</h2>
        <ul className="divide-y divide-line">
        {TOGGLES.map((p) => {
          const on = store.hasConsent(p, db);
          return (
            <li key={p} className="flex items-start justify-between gap-4 py-3">
              <div className="min-w-0"><p className="font-semibold">{CONSENT_TEXT[p].title}</p><p className="mt-0.5 text-xs leading-relaxed text-muted"><BrandText>{CONSENT_TEXT[p].body}</BrandText></p></div>
              <Switch on={on} label={CONSENT_TEXT[p].title} onChange={() => (p === "sms_read" && on ? store.stopMoney() : store.setConsent(p, !on))} />
            </li>
          );
        })}
        </ul>
        <details className="border-t border-line pt-3 text-xs text-muted">
          <summary className="font-semibold text-brand">Consent history ({db.consents.length} records)</summary>
          <ul className="mt-2 space-y-1">
            {[...db.consents].reverse().map((c, i) => (
              <li key={i}>{new Date(c.at).toLocaleString("en-KE")} · {CONSENT_TEXT[c.purpose].title} · {c.granted ? "granted" : "withdrawn"} · v{c.version}</li>
            ))}
          </ul>
        </details>
      </section>

      <section className="card space-y-3">
        <h2 className="flex items-center gap-2 font-semibold"><LockIcon className="h-5 w-5 text-brand" />Your data</h2>
        <p className="text-xs text-muted">Download a copy of everything we hold about you, or delete it all. Deleting also withdraws the consent to store your loans.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <button className="btn-ghost" onClick={download}><DownloadIcon className="h-5 w-5" />Download my data</button>
          <button className="btn-danger" onClick={deleteEverything}><TrashIcon className="h-5 w-5" />{session.status === "signedIn" ? "Delete my account" : "Delete everything"}</button>
        </div>
        {deleteError ? <p className="flex items-center gap-1.5 text-sm text-bad" role="alert"><AlertIcon className="h-4 w-4" />{deleteError}</p> : null}
      </section>
      </div>
      </div>
    </div>
  );
}

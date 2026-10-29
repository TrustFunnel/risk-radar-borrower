"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Gate } from "@/components/Gate";
import { useSession } from "@/components/Session";
import { supabase } from "@/lib/supabase";
import { store } from "@/lib/store";
import { CONSENT_TEXT, type ConsentPurpose } from "@/lib/types";
import { useDb } from "@/lib/useStore";

const TOGGLES: ConsentPurpose[] = ["analyse", "ai_read", "reminders"];

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
    <div className="space-y-4 py-2">
      <h1 className="text-xl font-bold">Account and privacy</h1>
      {session.status === "signedIn" ? (
        <section className="card flex items-center justify-between gap-3">
          <div><p className="text-xs text-muted">Signed in as</p><p className="num font-semibold">{db.profile?.phone ?? session.phone}</p></div>
          <button className="btn-ghost" onClick={() => supabase?.auth.signOut()}>Sign out</button>
        </section>
      ) : null}
      {localDemo ? (
        <section className="card flex items-center justify-between gap-3 text-sm">
          <span>{localDemo.loans.length} loan(s) from before you signed in are still on this phone.</span>
          <button className="btn-ghost" onClick={() => store.importLocal().catch((e) => setDeleteError((e as Error).message))}>Copy to account</button>
        </section>
      ) : null}
      <Link href="/profile" className="card flex items-center justify-between gap-3 text-sm">
        <span><span className="block font-medium">My details</span><span className="text-xs text-muted">Work, CRB report, M-PESA and bank statements</span></span>
        <span className="text-brand">Open</span>
      </Link>

      <section className="card space-y-2">
        <label className="block"><span className="label">Monthly take-home income (KES)</span>
          <input className="input num" inputMode="numeric" value={income} onChange={(e) => setIncome(e.target.value.replace(/[^\d]/g, ""))} />
        </label>
        <button className="btn-ghost" onClick={() => db.profile && store.saveProfile({ ...db.profile, monthlyIncome: Number(income) || 0 })}>Save income</button>
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold">Consents</h2>
        {TOGGLES.map((p) => {
          const on = store.hasConsent(p, db);
          return (
            <div key={p} className="flex items-start justify-between gap-3">
              <div><p className="text-sm font-medium">{CONSENT_TEXT[p].title}</p><p className="text-xs text-muted">{CONSENT_TEXT[p].body}</p></div>
              <button className={on ? "btn" : "btn-ghost"} onClick={() => store.setConsent(p, !on)}>{on ? "On" : "Off"}</button>
            </div>
          );
        })}
        <details className="text-xs text-muted">
          <summary>Consent history ({db.consents.length} records)</summary>
          <ul className="mt-2 space-y-1">
            {[...db.consents].reverse().map((c, i) => (
              <li key={i}>{new Date(c.at).toLocaleString("en-KE")} · {CONSENT_TEXT[c.purpose].title} · {c.granted ? "granted" : "withdrawn"} · v{c.version}</li>
            ))}
          </ul>
        </details>
      </section>

      <section className="card space-y-2">
        <h2 className="font-semibold">Your data</h2>
        <p className="text-xs text-muted">Download a copy of everything we hold about you, or delete it all. Deleting also withdraws the consent to store your loans.</p>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={download}>Download my data</button>
          <button className="btn-ghost text-bad" onClick={deleteEverything}>{session.status === "signedIn" ? "Delete my account" : "Delete everything"}</button>
        </div>
        {deleteError ? <p className="text-xs text-bad">{deleteError}</p> : null}
      </section>
    </div>
  );
}

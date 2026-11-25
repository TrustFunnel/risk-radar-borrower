"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Gate } from "@/components/Gate";
import { flowsSummary, mergeFlows } from "@/lib/documents";
import { kes } from "@/lib/finance";
import { smsPlugin, type SmsPermission } from "@/lib/money/native";
import { parseSms, splitPasted, type MoneyEvent } from "@/lib/money/parse";
import { monthlyFlows, snapshot } from "@/lib/money/signals";
import { store } from "@/lib/store";
import { CONSENT_TEXT, type MoneyRecord } from "@/lib/types";
import { useDb } from "@/lib/useStore";
import { AlertIcon, CheckCircle, CloseIcon, CoinsIcon, HelpIcon, InfoIcon, MessageIcon, PhoneIcon, PlanIcon, SendIcon, TrashIcon, TrendDownIcon, WalletIcon, CheckIcon } from "@/components/Icons";
import { IconTile, More, PageHeader, Stat } from "@/components/ui";

// Money messages: M-PESA, Airtel Money, bank and lender SMS read as they
// happen, instead of waiting for a monthly statement upload.
export default function Money() {
  return <Gate><MoneyInner /></Gate>;
}

const KIND_LABEL: Record<MoneyEvent["kind"], string> = {
  received: "Received",
  sent: "Sent",
  paybill: "Paybill",
  buygoods: "Paid",
  withdraw: "Withdrawal",
  deposit: "Deposit",
  airtime: "Airtime",
  loan_disbursed: "New loan",
  loan_repaid: "Loan repayment",
  loan_due: "Loan due",
  loan_overdue: "Loan overdue",
  overdraft: "Fuliza / overdraft",
  reversal: "Reversal",
};

function MoneyInner() {
  const { db } = useDb();
  const on = store.hasConsent("sms_read", db);
  const [shared, setShared] = useState("");

  // Shared from the SMS app ("Share" to Afueni). The text arrives after the
  // #, which is never sent to our server (see public/sw.js and the Android app).
  useEffect(() => {
    const p = new URLSearchParams(window.location.hash.slice(1));
    const text = [p.get("title"), p.get("text")].filter(Boolean).join("\n");
    if (text) {
      setShared(text);
      window.history.replaceState(null, "", "/money");
    }
  }, []);

  return (
    <div className="mx-auto max-w-4xl space-y-5 py-2">
      <PageHeader icon={MessageIcon} title="Money messages" sub="M-PESA, bank and lender SMS, read on your phone. Personal messages are never read." />
      <More label="What we keep">Afueni reads the SMS that M-PESA, your bank and your lenders send you, so we can warn you early, without waiting for a monthly statement. Messages are read on your phone. We keep only the amount, date, type and the business or lender. Personal messages are never read.</More>
      {on ? <Captured shared={shared} /> : <SwitchOn />}
    </div>
  );
}

function SwitchOn() {
  const [agree, setAgree] = useState(false);
  return (
    <section className="card space-y-4">
      <div className="flex items-center gap-3"><IconTile icon={MessageIcon} /><h2 className="text-lg font-bold">Switch on money messages</h2></div>
      <label className="choice">
        <input type="checkbox" className="mt-0.5" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
        <span><span className="block text-sm font-medium">{CONSENT_TEXT.sms_read.title}</span><span className="block text-xs text-muted">{CONSENT_TEXT.sms_read.body}</span></span>
      </label>
      <button className="btn w-full sm:w-auto" disabled={!agree} onClick={() => store.setConsent("sms_read", true)}><CheckIcon className="h-5 w-5" />Switch on</button>
    </section>
  );
}

function Captured({ shared }: { shared: string }) {
  const { db } = useDb();
  const snap = useMemo(() => snapshot(db.money), [db.money]);
  return (
    <>
      {db.money.length ? <Signals snap={snap} /> : null}
      <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
        <div className="space-y-5">
          {smsPlugin() ? <AutoCard /> : <GetAppCard />}
          <PasteCard initial={shared} />
          {db.money.length ? <PlanCard /> : null}
        </div>
        <div className="space-y-5">
          {db.money.length ? <Recent items={db.money} /> : null}
          <section className="card space-y-3">
            <h2 className="flex items-center gap-2 font-semibold"><TrashIcon className="h-5 w-5 text-bad" />Switch off</h2>
            <p className="text-xs text-muted">Stops reading money messages and deletes the {db.money.length} transaction{db.money.length === 1 ? "" : "s"} captured so far.</p>
            <button className="btn-danger" onClick={async () => {
          await smsPlugin()?.setEnabled({ enabled: false }).catch(() => {});
          store.stopMoney();
        }}>Switch off and delete</button>
          </section>
        </div>
      </div>
    </>
  );
}

// ---------- Android app: automatic ----------

function AutoCard() {
  const [perm, setPerm] = useState<SmsPermission | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState("");
  const plugin = smsPlugin()!;

  useEffect(() => {
    plugin.status().then((s) => { setPerm(s.permission); setEnabled(s.enabled); }).catch(() => setPerm("denied"));
  }, [plugin]);

  async function start() {
    setBusy("Asking your phone for permission…");
    try {
      const { permission } = await plugin.requestPermission();
      setPerm(permission);
      if (permission !== "granted") return setBusy("");
      await plugin.setEnabled({ enabled: true });
      setEnabled(true);
      // Catch up on the last 6 months so the plan has history from day one.
      setBusy("Reading your last 6 months of money messages…");
      const { messages } = await plugin.readInbox({ sinceMs: Date.now() - 183 * 86_400_000 });
      const added = store.addMoney(messages.map((m) => parseSms(m)).filter((e) => e !== null), "auto");
      setBusy(`Done: ${added.length} transactions found.`);
    } catch (e) {
      setBusy(`Something went wrong: ${(e as Error).message}`);
    }
  }

  return (
    <section className="card space-y-3">
      <h2 className="flex items-center gap-2 font-semibold"><PhoneIcon className="h-5 w-5 text-brand" />Read automatically</h2>
      {enabled && perm === "granted" ? (
        <p className="flex items-center gap-2 text-sm font-medium text-good"><CheckCircle className="h-5 w-5" />On. New money messages are read as they arrive.</p>
      ) : (
        <>
          <p className="text-sm text-muted">Let Afueni read new money messages as they arrive, plus the last 6 months. Your phone will ask you to allow SMS access.</p>
          {perm === "denied" ? <p className="alert alert-warn text-xs"><AlertIcon className="h-4 w-4 shrink-0 text-warn" />SMS access is blocked. Open your phone Settings, then Apps, Afueni, Permissions, SMS, and choose Allow.</p> : null}
          <button className="btn" onClick={start} disabled={!!busy && !busy.startsWith("Done") && !busy.startsWith("Something")}>Allow SMS reading</button>
        </>
      )}
      {busy ? <p className="text-xs text-muted">{busy}</p> : null}
    </section>
  );
}

function GetAppCard() {
  return (
    <section className="card flex gap-3.5">
      <IconTile icon={PhoneIcon} tone="plain" />
      <div>
        <h2 className="font-semibold">Want it automatic?</h2>
        <p className="mt-0.5 text-sm text-muted">The Afueni Android app reads them as they arrive.</p>
        <More label="Until then">Share or paste them below: on Android, press and hold an M-PESA message, tap Share, then choose Afueni.</More>
      </div>
    </section>
  );
}

// ---------- Share or paste: any phone ----------

function PasteCard({ initial }: { initial: string }) {
  const [text, setText] = useState(initial);
  const [msg, setMsg] = useState("");
  useEffect(() => { if (initial) setText(initial); }, [initial]);
  const found = useMemo(() => (text.trim() ? splitPasted(text).map((b) => parseSms({ body: b })).filter((e) => e !== null) : []), [text]);

  function save() {
    const added = store.addMoney(found, initial && text === initial ? "share" : "paste");
    setMsg(added.length ? `Saved ${added.length} transaction${added.length === 1 ? "" : "s"}.` : "Already saved.");
    setText("");
  }

  return (
    <section className="card space-y-3">
      <h2 className="flex items-center gap-2 font-semibold"><SendIcon className="h-5 w-5 text-brand" />Share or paste a message</h2>
      <textarea className="input min-h-28" placeholder="Paste one or more M-PESA, bank or lender messages here" value={text} onChange={(e) => { setText(e.target.value); setMsg(""); }} />
      {text.trim() ? (
        found.length ? (
          <ul className="card-flat space-y-1.5 text-sm">
            {found.map((e) => <li key={e.refHash} className="flex justify-between gap-2"><span>{KIND_LABEL[e.kind]}{e.counterparty ? ` · ${e.counterparty}` : ""}{e.lender && !e.counterparty ? ` · ${e.lender}` : ""}</span><span className="num">{kes(e.amount)}</span></li>)}
          </ul>
        ) : <p className="flex items-center gap-1.5 text-xs text-warn"><AlertIcon className="h-4 w-4" />We couldn&apos;t find a money transaction in that text.</p>
      ) : null}
      <button className="btn w-full sm:w-auto" disabled={!found.length} onClick={save}><CheckIcon className="h-5 w-5" />Save</button>
      {msg ? <p className="flex items-center gap-1.5 text-sm text-good"><CheckCircle className="h-4 w-4" />{msg}</p> : null}
      <p className="text-xs text-muted">Only the figures are kept. The message text is not saved.</p>
    </section>
  );
}

// ---------- What we noticed ----------

function Signals({ snap }: { snap: ReturnType<typeof snapshot> }) {
  const look = { good: { c: "alert-good", t: "text-good", I: CheckCircle }, watch: { c: "alert-warn", t: "text-warn", I: InfoIcon }, alert: { c: "alert-bad", t: "text-bad", I: AlertIcon } } as const;
  return (
    <section className="space-y-3">
      <h2 className="eyebrow">Last {snap.days} days</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={CoinsIcon} label="Money in" value={kes(snap.income)} tone="good" />
        <Stat icon={WalletIcon} label="Spent" value={kes(snap.spending)} />
        <Stat icon={TrendDownIcon} label="Repaid to lenders" value={kes(snap.repaid)} />
        <Stat icon={PlanIcon} label="Borrowed" value={kes(snap.borrowed)} />
      </div>
      {snap.signals.length ? (
        <ul className="grid gap-2 md:grid-cols-2">
          {snap.signals.map((s) => { const l = look[s.level]; return <li key={s.id} className={`alert ${l.c}`}><l.I className={`h-5 w-5 shrink-0 ${l.t}`} /><span>{s.text}</span></li>; })}
        </ul>
      ) : null}
      {snap.signals.some((s) => s.level === "alert") ? <Link href="/help" className="btn-ghost"><HelpIcon className="h-5 w-5" />Get help</Link> : null}
    </section>
  );
}

// Whole months from messages feed the affordable plan, like a statement.
function PlanCard() {
  const { db } = useDb();
  const since = [...db.consents].reverse().find((c) => c.purpose === "sms_read" && c.granted)?.at ?? new Date().toISOString();
  // Messages read from the inbox go back before switch-on: start from the oldest one.
  const oldest = db.money[0]?.occurredAt;
  const start = oldest && oldest < since ? oldest : since;
  const flows = monthlyFlows(db.money, start);
  const [done, setDone] = useState(false);
  if (!flows.length) return <p className="flex gap-2 px-1 text-xs text-muted"><InfoIcon className="h-4 w-4 shrink-0" />Once a full month of messages is in, it will count towards your affordable plan.</p>;
  return (
    <section className="card space-y-3">
      <h2 className="flex items-center gap-2 font-semibold"><PlanIcon className="h-5 w-5 text-brand" />Use for my plan</h2>
      <p className="text-sm text-muted">{flowsSummary(flows)} from your messages. Add them to your income so your plan stays current.</p>
      <button className="btn-ghost" disabled={done} onClick={() => {
        store.saveProfile({ ...db.profile!, incomeFlows: mergeFlows(db.profile!.incomeFlows, flows), incomeSource: "statement" });
        setDone(true);
      }}>{done ? "Added" : "Add to my plan"}</button>
    </section>
  );
}

function Recent({ items }: { items: MoneyRecord[] }) {
  const latest = [...items].reverse().slice(0, 25);
  return (
    <section className="card space-y-2">
      <h2 className="font-semibold">Latest transactions</h2>
      <ul className="divide-y divide-line text-sm">
        {latest.map((m) => (
          <li key={m.id} className="flex items-center justify-between gap-3 py-2.5">
            <span className={`tile !h-9 !w-9 !rounded-xl ${m.direction === "in" ? "tile-good" : "tile-plain"}`}>{m.direction === "in" ? <CoinsIcon className="h-[18px] w-[18px]" /> : <SendIcon className="h-[18px] w-[18px]" />}</span>
            <span className="min-w-0 flex-1">
              <span className="block">{KIND_LABEL[m.kind]}{m.counterparty ? ` · ${m.counterparty}` : m.lender ? ` · ${m.lender}` : ""}</span>
              <span className="block text-xs text-muted">{new Date(m.occurredAt).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}{m.channel === "auto" ? "" : ` · ${m.channel === "share" ? "shared" : "pasted"}`}</span>
            </span>
            <span className="flex items-center gap-3">
              <span className={`num font-semibold ${m.direction === "in" ? "text-good" : ""}`}>{m.direction === "out" ? "−" : ""}{kes(m.amount)}</span>
              <button aria-label="Delete" className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-bad-soft hover:text-bad" onClick={() => store.deleteMoney(m.id)}><CloseIcon className="h-4 w-4" /></button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

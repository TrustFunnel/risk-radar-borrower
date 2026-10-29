"use client";

import Link from "next/link";
import { useState } from "react";
import { Gate } from "@/components/Gate";
import { checkCrb, loanDraftQuery } from "@/lib/crb";
import { aiIndustry, flowsSummary, mergeFlows, readBankFile, readCrbFile, readMpesaFile, type ReadStatement } from "@/lib/documents";
import { kes } from "@/lib/finance";
import { EMPLOYMENT_TYPES, guessIndustry, INDUSTRIES, isIndustry, type EmploymentType, type Industry } from "@/lib/industry";
import { PdfPasswordError } from "@/lib/pdfText";
import { store } from "@/lib/store";
import { CONSENT_TEXT, type CrbReport, type DocKind, type DocRecord, type WorkDetails } from "@/lib/types";
import { useDb } from "@/lib/useStore";

export default function Profile() {
  return <Gate><ProfileInner /></Gate>;
}

function ProfileInner() {
  const { db } = useDb();
  return (
    <div className="space-y-4 py-2">
      <h1 className="text-xl font-bold">My details</h1>
      <p className="text-sm text-muted">The more we know, the earlier we can warn you. Files are opened on your phone and the file itself is never uploaded. For CRB reports and bank statements, the text is read by our AI provider, Anthropic, in the United States, only if you agree. We keep only the figures. M-PESA statements are read on your phone.</p>
      <WorkCard />
      <CrbCard />
      <MpesaCard />
      <BankCard />
      {db.documents.length ? <DocList docs={db.documents} /> : null}
    </div>
  );
}

// ---------- Work ----------

function WorkCard() {
  const { db } = useDb();
  const profile = db.profile!;
  const w = profile.work;
  const [type, setType] = useState<EmploymentType>(w?.employmentType ?? "employed");
  const [employer, setEmployer] = useState(w?.employer ?? "");
  const [jobTitle, setJobTitle] = useState(w?.jobTitle ?? "");
  const [since, setSince] = useState(w?.since ?? "");
  const [industry, setIndustry] = useState<Industry | "">(w?.industry ?? "");
  const [source, setSource] = useState<WorkDetails["industrySource"]>(w?.industrySource ?? "auto");
  const [guessing, setGuessing] = useState(false);
  const [saved, setSaved] = useState(false);
  const business = type === "self_employed" || type === "business_owner" || type === "casual";

  // Fill the industry as they type, unless they picked one themselves.
  function autoFill(e: string, t: string) {
    if (source === "manual") return;
    const g = guessIndustry(e, t);
    if (g) setIndustry(g.industry);
  }

  async function lookUp() {
    if (source === "manual" || industry || (!employer && !jobTitle) || !store.hasConsent("ai_read")) return;
    setGuessing(true);
    const i = await aiIndustry(employer, jobTitle);
    setGuessing(false);
    if (i && isIndustry(i)) setIndustry(i);
  }

  function save() {
    if (!industry) return;
    store.saveProfile({ ...profile, work: { employmentType: type, employer: employer.trim(), jobTitle: jobTitle.trim(), industry, industrySource: source, since: since || undefined } });
    setSaved(true);
  }

  return (
    <section className="card space-y-3">
      <h2 className="font-semibold">Your work</h2>
      <label className="block"><span className="label">How do you earn?</span>
        <select className="input" value={type} onChange={(e) => { setType(e.target.value as EmploymentType); setSaved(false); }}>
          {EMPLOYMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </label>
      {type !== "unemployed" ? (
        <>
          <label className="block"><span className="label">{business ? "Business or main client" : "Employer"}</span>
            <input className="input" value={employer} placeholder={business ? "e.g. Mama Njeri Groceries" : "e.g. Kenya Power, TSC, Naivas"}
              onChange={(e) => { setEmployer(e.target.value); autoFill(e.target.value, jobTitle); setSaved(false); }} onBlur={lookUp} />
          </label>
          <label className="block"><span className="label">{business ? "What you do" : "Job title"}</span>
            <input className="input" value={jobTitle} placeholder={business ? "e.g. shop owner, boda rider" : "e.g. teacher, accountant"}
              onChange={(e) => { setJobTitle(e.target.value); autoFill(employer, e.target.value); setSaved(false); }} onBlur={lookUp} />
          </label>
          <label className="block"><span className="label">Since (optional)</span>
            <input className="input" type="month" value={since} onChange={(e) => { setSince(e.target.value); setSaved(false); }} />
          </label>
        </>
      ) : null}
      <label className="block"><span className="label">Industry {source === "auto" && industry ? <span className="text-xs text-muted">(filled in for you, change it if it&apos;s wrong)</span> : null}</span>
        <select className="input" value={industry} onChange={(e) => { setIndustry(e.target.value as Industry); setSource("manual"); setSaved(false); }}>
          <option value="">{guessing ? "Working it out…" : "Choose your industry"}</option>
          {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
        </select>
      </label>
      <p className="text-xs text-muted">We watch for news that affects your industry, like layoffs or delayed pay, so we can warn you before a repayment is at risk.</p>
      <button className="btn" disabled={!industry} onClick={save}>{saved ? "Saved" : "Save work details"}</button>
    </section>
  );
}

// ---------- Shared upload control ----------

function Upload({ accept, passwordLabel, passwordHint, otp, ai, onRead, cta }: {
  accept: string;
  passwordLabel: string;
  passwordHint?: string;
  otp?: boolean;
  ai?: (file: File) => boolean; // true when this file's text goes to our AI provider
  onRead: (file: File, password: string) => Promise<void>;
  cta: string;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [needsPassword, setNeedsPassword] = useState(!!otp);
  const [inputKey, setInputKey] = useState(0); // clears the file picker after a read
  const { db } = useDb();
  const [agree, setAgree] = useState(false);
  const askConsent = !!file && !!ai?.(file) && !store.hasConsent("ai_read", db);

  async function go() {
    if (!file) return;
    setBusy(true); setError("");
    try {
      if (askConsent) store.setConsent("ai_read", true);
      await onRead(file, password);
      setFile(null); setPassword(""); setInputKey((k) => k + 1);
    } catch (e) {
      if (e instanceof PdfPasswordError) { setNeedsPassword(true); setError(otp && e.wrong ? "That code didn't open the file. Use the code in the latest SMS from M-PESA." : e.message); }
      else setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <input key={inputKey} type="file" accept={accept} className="block w-full text-sm" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setError(""); }} />
      {needsPassword ? (
        <label className="block"><span className="label">{passwordLabel}</span>
          <input className="input num" value={password} onChange={(e) => setPassword(e.target.value)}
            autoComplete={otp ? "one-time-code" : "off"} inputMode={otp ? "numeric" : "text"} />
          {passwordHint ? <span className="mt-1 block text-xs text-muted">{passwordHint}</span> : null}
        </label>
      ) : null}
      {askConsent ? (
        <label className="flex items-start gap-3 rounded-xl border border-line p-3">
          <input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--brand)]" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
          <span><span className="block text-sm font-medium">{CONSENT_TEXT.ai_read.title}</span><span className="block text-xs text-muted">{CONSENT_TEXT.ai_read.body}</span></span>
        </label>
      ) : null}
      <button className="btn-ghost" disabled={!file || busy || (askConsent && !agree) || (otp && !password && /\.pdf$/i.test(file.name))} onClick={go}>{busy ? "Reading…" : cta}</button>
      {error ? <p className="text-xs text-bad">{error}</p> : null}
    </div>
  );
}

function saveStatement(kind: DocKind, fileName: string, r: ReadStatement) {
  const profile = store.snapshot().profile!;
  store.addDocument({ kind, fileName, flows: r.flows, summary: flowsSummary(r.flows) });
  store.saveProfile({ ...profile, incomeFlows: mergeFlows(profile.incomeSource === "statement" ? profile.incomeFlows : [], r.flows), incomeSource: "statement" });
}

// ---------- CRB report ----------

function CrbCard() {
  const { db } = useDb();
  const latest = [...db.documents].reverse().find((d) => d.kind === "crb" && d.crb);
  return (
    <section className="card space-y-3">
      <h2 className="font-semibold">CRB report</h2>
      <p className="text-xs text-muted">
        You can get one free report a year from each credit bureau: Metropol, TransUnion and Creditinfo. Ask for the PDF report
        through their app, website or SMS service, then upload it here. We&apos;ll check it against your loans and flag anything missing or wrong.
      </p>
      <Upload accept="application/pdf,.pdf" passwordLabel="Report password" passwordHint="Bureaus often use your ID number." ai={() => true} cta="Read my CRB report"
        onRead={async (file, pw) => {
          const crb = await readCrbFile(file, pw);
          const negatives = crb.accounts.filter((a) => a.negative).length;
          store.addDocument({ kind: "crb", fileName: file.name, crb, summary: `${crb.bureau}, ${crb.accounts.length} accounts${negatives ? `, ${negatives} negative` : ""}` });
        }} />
      {latest?.crb ? <CrbResult report={latest.crb} /> : null}
    </section>
  );
}

const STATUS: Record<CrbReport["accounts"][number]["status"], string> = {
  performing: "Up to date", non_performing: "In arrears", written_off: "Written off", closed: "Closed", settled: "Settled",
};

function CrbResult({ report }: { report: CrbReport }) {
  const { db } = useDb();
  const checks = checkCrb(report, db.loans);
  const missing = checks.filter((c) => c.issue === "missing");
  const disputes = checks.filter((c) => c.issue === "listed_after_close");
  return (
    <div className="space-y-3 border-t border-line pt-3">
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div><p className="text-xs text-muted">{report.bureau} score</p><p className="num font-bold">{report.score ?? "Not shown"}{report.scoreBand ? ` · ${report.scoreBand}` : ""}</p></div>
        <div><p className="text-xs text-muted">Negative listings</p><p className={`num font-bold ${report.accounts.some((a) => a.negative) ? "text-bad" : "text-good"}`}>{report.accounts.filter((a) => a.negative).length}</p></div>
      </div>
      {missing.length ? <p className="text-sm text-warn">{missing.length} open loan{missing.length === 1 ? " is" : "s are"} on your report but not in your wallet. Add {missing.length === 1 ? "it" : "them"} so your plan is complete.</p> : null}
      {disputes.length ? <p className="text-sm text-bad">{disputes.length} loan{disputes.length === 1 ? "" : "s"} you marked as closed {disputes.length === 1 ? "is" : "are"} still listed as unpaid. Ask the lender for a clearance letter and the bureau to update it.</p> : null}
      <ul className="divide-y divide-line text-sm">
        {checks.map((c, i) => (
          <li key={i} className="flex items-start justify-between gap-3 py-2">
            <div className="min-w-0">
              <p className="truncate font-medium">{c.account.lender}</p>
              <p className="text-xs text-muted">
                {c.account.accountType} · {STATUS[c.account.status]}{c.account.arrearsDays ? ` · ${c.account.arrearsDays} days late` : ""}
                {c.account.negative ? <span className="font-semibold text-bad"> · negative listing</span> : null}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="num">{kes(c.account.balance)}</p>
              {c.issue === "missing" ? <Link className="text-xs text-brand underline" href={`/loans/new?${loanDraftQuery(c.account)}`}>Add to my loans</Link>
                : c.loan ? <Link className="text-xs text-muted underline" href={`/loans/${c.loan.id}`}>In wallet</Link> : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------- M-Pesa statement ----------

function MpesaCard() {
  const [done, setDone] = useState("");
  return (
    <section className="card space-y-3">
      <h2 className="font-semibold">M-PESA statement</h2>
      <ol className="list-decimal space-y-1 pl-5 text-xs text-muted">
        <li>Dial <span className="num font-medium text-foreground">*334#</span> or open the M-PESA app, go to <em>My Account → M-PESA Statement → Request Statement</em>, and choose the full statement for the last 6 months.</li>
        <li>Enter your email address. Safaricom emails the statement as a PDF and texts you a code that opens it.</li>
        <li>Upload the PDF here and type the code from the SMS. The file is opened on your phone; the code is never saved.</li>
      </ol>
      <Upload accept="application/pdf,.pdf,.csv,text/csv" otp passwordLabel="Code from the M-PESA SMS" cta="Read my M-PESA statement"
        onRead={async (file, code) => {
          const r = await readMpesaFile(file, code);
          saveStatement("mpesa", file.name, r);
          setDone(`Read ${flowsSummary(r.flows)}. Your affordable plan on Get help now uses it.`);
        }} />
      {done ? <p className="text-xs text-good">{done}</p> : null}
    </section>
  );
}

// ---------- Bank statement ----------

function BankCard() {
  const [done, setDone] = useState("");
  return (
    <section className="card space-y-3">
      <h2 className="font-semibold">Bank statement</h2>
      <p className="text-xs text-muted">Download 3 to 6 months of statements from your bank app or internet banking (PDF or CSV). If the PDF has a password, your bank&apos;s email usually says what it is, often your ID number.</p>
      <Upload accept="application/pdf,.pdf,.csv,text/csv" passwordLabel="Statement password" ai={(f) => !/\.csv$/i.test(f.name) && f.type !== "text/csv"} cta="Read my bank statement"
        onRead={async (file, pw) => {
          const r = await readBankFile(file, pw);
          saveStatement("bank", file.name, r);
          setDone(`Read ${flowsSummary(r.flows)}. Your affordable plan on Get help now uses it.`);
        }} />
      {done ? <p className="text-xs text-good">{done}</p> : null}
    </section>
  );
}

// ---------- Uploaded so far ----------

const KIND: Record<DocKind, string> = { crb: "CRB report", mpesa: "M-PESA statement", bank: "Bank statement" };

function DocList({ docs }: { docs: DocRecord[] }) {
  return (
    <section className="card">
      <h2 className="mb-2 text-sm font-medium text-muted">Read so far</h2>
      <ul className="divide-y divide-line text-sm">
        {[...docs].reverse().map((d) => (
          <li key={d.id} className="flex items-center justify-between gap-3 py-2">
            <div className="min-w-0"><p className="font-medium">{KIND[d.kind]}</p><p className="truncate text-xs text-muted">{d.summary} · {new Date(d.createdAt).toLocaleDateString("en-KE")}</p></div>
            <button className="text-xs text-bad underline" onClick={() => store.deleteDocument(d.id)}>Remove</button>
          </li>
        ))}
      </ul>
    </section>
  );
}

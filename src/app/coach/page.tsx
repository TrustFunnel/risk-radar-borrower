"use client";

// Coach inbox for Afueni WhatsApp hand-offs. Coaches see waiting cases,
// read the chat, reply on WhatsApp, and hand the chat back to the bot.
import { useCallback, useEffect, useState } from "react";

type CaseItem = {
  id: string; reason: string; priority: "normal" | "high" | "urgent"; note: string | null; createdAt: string; closedAt: string | null;
  contact: { id: string; name: string | null; phoneEnd: string; level: string | null; lang: string; windowOpen: boolean };
};
type Conversation = {
  contact: { id: string; phone: string; name: string | null; linkedAccount: boolean; lang: string; step: string; level: string | null; answers: Record<string, unknown>; consents: Record<string, boolean>; windowOpen: boolean; lastInboundAt: string | null };
  openCase: { id: string; reason: string; priority: string; note: string | null } | null;
  messages: { id: number; direction: "in" | "out"; author: string; type: string; body: string | null; hasMedia: boolean; fileName: string | null; status: string; error: string | null; at: string }[];
};

const KEY = "afueni-coach-key";
const REASONS: Record<string, string> = {
  asked_for_person: "Asked for a person", assessment: "Assessment flagged", document: "Sent a document", voice_note: "Sent a voice note",
  consent_followup: "Permission to follow up", safety: "Safety risk", stuck: "Bot couldn't help",
};
const PRIORITY_STYLE = { urgent: "bg-bad text-white", high: "bg-warn text-[#181a20]", normal: "bg-raised text-muted" } as const;
const time = (iso: string) => new Date(iso).toLocaleString("en-KE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default function CoachInbox() {
  const [key, setKey] = useState<string | null>(null);
  const [draftKey, setDraftKey] = useState("");
  const [tab, setTab] = useState<"open" | "closed">("open");
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [selected, setSelected] = useState<CaseItem | null>(null);
  const [conv, setConv] = useState<Conversation | null>(null);
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { try { setKey(sessionStorage.getItem(KEY)); } catch { /* private mode */ } }, []);

  const api = useCallback(async (path: string, init?: RequestInit) => {
    const res = await fetch(path, { ...init, headers: { ...(init?.headers ?? {}), Authorization: `Bearer ${key}`, "Content-Type": "application/json" } });
    const json = await res.json().catch(() => ({}));
    if (res.status === 401) { try { sessionStorage.removeItem(KEY); } catch {} setKey(null); }
    if (!res.ok) throw new Error(json.error ?? `Error ${res.status}`);
    return json;
  }, [key]);

  const loadCases = useCallback(async () => {
    if (!key) return;
    try { setCases((await api(`/api/coach/cases?status=${tab}`)).cases); setError(""); } catch (e) { setError((e as Error).message); }
  }, [api, key, tab]);

  const loadConv = useCallback(async (contactId: string) => {
    try { setConv(await api(`/api/coach/conversations/${contactId}`)); } catch (e) { setError((e as Error).message); }
  }, [api]);

  useEffect(() => { loadCases(); const t = setInterval(loadCases, 15000); return () => clearInterval(t); }, [loadCases]);
  useEffect(() => {
    if (!selected) return;
    loadConv(selected.contact.id);
    const t = setInterval(() => loadConv(selected.contact.id), 10000);
    return () => clearInterval(t);
  }, [selected, loadConv]);

  async function act(fn: () => Promise<unknown>) {
    setBusy(true); setError("");
    try { await fn(); } catch (e) { setError((e as Error).message); }
    setBusy(false);
  }

  async function downloadFile(messageId: number, fileName: string | null) {
    await act(async () => {
      const res = await fetch(`/api/coach/media/${messageId}`, { headers: { Authorization: `Bearer ${key}` } });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Download failed");
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url; a.download = fileName ?? `whatsapp-${messageId}`; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    });
  }

  if (!key) {
    return (
      <form className="card mx-auto my-8 max-w-sm space-y-3" onSubmit={(e) => { e.preventDefault(); try { sessionStorage.setItem(KEY, draftKey.trim()); } catch {} setKey(draftKey.trim()); }}>
        <h1 className="text-lg font-bold">Afueni coach inbox</h1>
        <p className="text-sm text-muted">Enter the coach access key. It is kept in this browser tab only and cleared when you close it.</p>
        <input className="input" type="password" autoComplete="off" value={draftKey} onChange={(e) => setDraftKey(e.target.value)} placeholder="Coach access key" />
        <button className="btn w-full" disabled={draftKey.trim().length < 24}>Open inbox</button>
      </form>
    );
  }

  return (
    <div className="space-y-4 py-2">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">WhatsApp cases</h1>
        <button className="text-xs text-muted underline" onClick={() => { try { sessionStorage.removeItem(KEY); } catch {} setKey(null); }}>Lock</button>
      </div>
      {error && <p className="card border-bad text-sm text-bad">{error}</p>}

      {!selected ? (
        <>
          <div className="grid grid-cols-2 gap-1 rounded-xl border border-line bg-card p-1 text-sm">
            {(["open", "closed"] as const).map((k) => (
              <button key={k} onClick={() => setTab(k)} className={`rounded-lg py-2 font-medium ${tab === k ? "bg-brand text-[#181a20]" : "text-muted"}`}>{k === "open" ? "Waiting" : "Closed"}</button>
            ))}
          </div>
          {cases.length === 0 && <p className="py-8 text-center text-sm text-muted">{tab === "open" ? "No one is waiting. 🎉" : "No closed cases yet."}</p>}
          <ul className="space-y-2">
            {cases.map((c) => (
              <li key={c.id}>
                <button onClick={() => { setSelected(c); setConv(null); setReply(""); }} className="card w-full text-left hover:border-brand">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{c.contact.name ?? "No name yet"} <span className="text-xs text-muted">···{c.contact.phoneEnd}</span></span>
                    <span className={`rounded px-2 py-0.5 text-[11px] font-semibold uppercase ${PRIORITY_STYLE[c.priority]}`}>{c.priority}</span>
                  </div>
                  <p className="mt-1 text-sm">{REASONS[c.reason] ?? c.reason}{c.contact.level ? ` · ${c.contact.level}` : ""} · {c.contact.lang === "sw" ? "Kiswahili" : "English"}</p>
                  <p className="mt-0.5 text-xs text-muted">{c.note} · {time(c.createdAt)}{!c.contact.windowOpen ? " · 24h window closed" : ""}</p>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <section className="space-y-3">
          <button className="text-sm text-brand" onClick={() => { setSelected(null); setConv(null); loadCases(); }}>← All cases</button>
          {!conv ? <p className="text-sm text-muted">Loading…</p> : (
            <>
              <div className="card space-y-1 text-sm">
                <p className="text-base font-semibold">{conv.contact.name ?? "No name yet"} · <a className="text-brand" href={`tel:${conv.contact.phone}`}>{conv.contact.phone}</a></p>
                <p className="text-muted">
                  {conv.contact.lang === "sw" ? "Kiswahili" : "English"} · level {conv.contact.level ?? "not assessed"} · {conv.contact.linkedAccount ? "has an app account" : "no app account"}
                </p>
                <p className="text-muted">Answers: {Object.entries(conv.contact.answers).map(([k, v]) => `${k} ${v}`).join(", ") || "none yet"}</p>
                <p className="text-muted">Permissions: {Object.entries(conv.contact.consents).filter(([, v]) => v).map(([k]) => k).join(", ") || "none"}</p>
                {conv.openCase && <p><span className="font-semibold">{REASONS[conv.openCase.reason]}:</span> {conv.openCase.note}</p>}
              </div>

              <ol className="space-y-2">
                {conv.messages.map((m) => (
                  <li key={m.id} className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${m.direction === "in" ? "bg-raised" : m.author === "coach" ? "ml-auto bg-brand-soft" : "ml-auto bg-card border border-line"}`}>
                    <p className="whitespace-pre-wrap break-words">{m.body ?? <span className="italic text-muted">[text cleared after 90 days]</span>}</p>
                    {m.hasMedia && <button className="mt-1 text-xs text-brand underline" onClick={() => downloadFile(m.id, m.fileName)}>Download {m.type}{m.fileName ? ` (${m.fileName})` : ""}</button>}
                    <p className="mt-1 text-[11px] text-muted">{m.author} · {time(m.at)}{m.direction === "out" ? ` · ${m.status}` : ""}{m.error ? ` · ${m.error}` : ""}</p>
                  </li>
                ))}
              </ol>

              {conv.contact.step === "opted_out" ? (
                <p className="card text-sm text-muted">This person sent STOP. Don&apos;t message them unless they write again.</p>
              ) : conv.contact.windowOpen ? (
                <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); act(async () => { await api(`/api/coach/conversations/${conv.contact.id}/reply`, { method: "POST", body: JSON.stringify({ text: reply }) }); setReply(""); await loadConv(conv.contact.id); }); }}>
                  <textarea className="input min-h-24" value={reply} onChange={(e) => setReply(e.target.value)} placeholder={conv.contact.lang === "sw" ? "Andika jibu kwa Kiswahili…" : "Write your reply…"} />
                  <button className="btn w-full" disabled={busy || !reply.trim()}>Send on WhatsApp</button>
                </form>
              ) : (
                <div className="card space-y-2 text-sm">
                  <p>It&apos;s been more than 24 hours since their last message, so WhatsApp only allows an approved template. It asks them to reply, which reopens the chat.</p>
                  <button className="btn-ghost w-full" disabled={busy} onClick={() => act(async () => { await api(`/api/coach/conversations/${conv.contact.id}/follow-up`, { method: "POST" }); await loadConv(conv.contact.id); })}>Send follow-up template</button>
                </div>
              )}

              {conv.openCase && (
                <button className="btn-ghost w-full" disabled={busy} onClick={() => act(async () => { await api(`/api/coach/cases/${conv.openCase!.id}/close`, { method: "POST", body: JSON.stringify({ contactId: conv.contact.id }) }); setSelected(null); setConv(null); await loadCases(); })}>
                  Close case and hand back to the bot
                </button>
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}

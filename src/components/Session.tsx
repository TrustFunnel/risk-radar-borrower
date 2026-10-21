"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { store } from "@/lib/store";
import { accountsEnabled, supabase } from "@/lib/supabase";

type Status = "demo" | "loading" | "signedOut" | "signedIn";

interface SessionState {
  status: Status;
  phone?: string;
  error?: string;
}

const Ctx = createContext<SessionState>({ status: "demo" });
export const useSession = () => useContext(Ctx);

// Tracks the Supabase login and loads the borrower's data once signed in.
// Without Supabase configured the app stays in demo mode.
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SessionState>({ status: accountsEnabled ? "loading" : "demo" });

  useEffect(() => {
    if (!supabase) return;
    let current: string | null = null;
    const apply = async (user: { id: string; phone?: string } | null) => {
      if (!user) {
        current = null;
        store.signOut();
        setState({ status: "signedOut" });
        return;
      }
      if (current === user.id) return;
      current = user.id;
      setState({ status: "loading" });
      try {
        await store.signIn(user.id);
        setState({ status: "signedIn", phone: user.phone ? `+${user.phone.replace(/^\+/, "")}` : undefined });
      } catch (e) {
        setState({ status: "signedIn", error: (e as Error).message });
      }
    };
    supabase.auth.getSession().then(({ data }) => apply(data.session?.user ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => apply(session?.user ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}

// Shows background save failures so nothing is lost silently.
export function SaveErrors() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    const on = (e: Event) => setMsg((e as CustomEvent<string>).detail);
    window.addEventListener("rr-store-error", on);
    return () => window.removeEventListener("rr-store-error", on);
  }, []);
  if (!msg) return null;
  return (
    <div role="alert" className="mx-4 mb-2 flex items-start justify-between gap-3 rounded-xl border border-bad bg-card p-3 text-sm text-bad">
      <span>{msg} Check your connection and try again.</span>
      <button className="text-xs underline" onClick={() => setMsg(null)}>Dismiss</button>
    </div>
  );
}

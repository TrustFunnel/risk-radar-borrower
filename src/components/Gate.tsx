"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { store } from "@/lib/store";
import { useDb } from "@/lib/useStore";
import { useSession } from "./Session";

// Sends anyone not signed in to login, and anyone who has not given the
// required consent to onboarding.
export function Gate({ children }: { children: React.ReactNode }) {
  const { db, ready } = useDb();
  const session = useSession();
  const router = useRouter();
  const sessionReady = session.status === "demo" || session.status === "signedIn";
  const ok = ready && sessionReady && store.hasConsent("store", db) && !!db.profile;
  useEffect(() => {
    if (session.status === "signedOut") router.replace("/login");
    else if (ready && sessionReady && !ok) router.replace("/welcome");
  }, [session.status, ready, sessionReady, ok, router]);
  if (session.error) return <p className="card my-4 text-sm text-bad">We couldn&apos;t load your loans: {session.error}</p>;
  if (!ok) return <p className="py-10 text-center text-sm text-muted">Loading…</p>;
  return <>{children}</>;
}

"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { store } from "@/lib/store";
import { useDb } from "@/lib/useStore";

// Sends anyone who has not given the required consent to onboarding.
export function Gate({ children }: { children: React.ReactNode }) {
  const { db, ready } = useDb();
  const router = useRouter();
  const ok = ready && store.hasConsent("store", db) && !!db.profile;
  useEffect(() => {
    if (ready && !ok) router.replace("/welcome");
  }, [ready, ok, router]);
  if (!ok) return <p className="py-10 text-center text-sm text-muted">Loading…</p>;
  return <>{children}</>;
}

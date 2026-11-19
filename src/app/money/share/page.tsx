"use client";

import { useEffect } from "react";

// Fallback for a share that arrives before the service worker is running:
// move the text behind "#" at once and drop it from the address bar.
// public/sw.js normally answers /money/share on the phone instead.
export default function Share() {
  useEffect(() => {
    window.location.replace(`/money#${window.location.search.slice(1)}`);
  }, []);
  return <p className="py-10 text-center text-sm text-muted">Opening…</p>;
}

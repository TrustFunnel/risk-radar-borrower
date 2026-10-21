"use client";

import { useEffect, useState } from "react";
import { store } from "./store";

// Re-reads the store whenever any component writes to it.
export function useDb() {
  const [db, setDb] = useState(() => store.snapshot());
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const sync = () => setDb(store.snapshot());
    sync();
    setReady(true);
    window.addEventListener("rr-store", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("rr-store", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return { db, ready };
}

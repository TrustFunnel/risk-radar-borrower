"use client";

import { useEffect } from "react";
import { smsPlugin } from "@/lib/money/native";
import { parseSms, type RawSms } from "@/lib/money/parse";
import { store } from "@/lib/store";

// In the Android app: picks up money SMS that arrived while Afueni was
// closed, and new ones as they arrive while it's open. Does nothing in a
// browser, or until the borrower switches money messages on.
export function MoneyCapture() {
  useEffect(() => {
    // The service worker that keeps shared SMS off our server (public/sw.js).
    if ("serviceWorker" in navigator && !smsPlugin()) navigator.serviceWorker.register("/sw.js").catch(() => {});
    const plugin = smsPlugin();
    if (!plugin) return;
    let remove: (() => Promise<void>) | undefined;
    const take = (msgs: RawSms[]) => {
      if (!store.hasConsent("sms_read")) return;
      const events = msgs.map((m) => parseSms(m)).filter((e) => e !== null);
      if (events.length) store.addMoney(events, "auto");
    };
    const drain = async () => {
      if (!store.hasConsent("sms_read")) return;
      try {
        const s = await plugin.status();
        if (s.permission !== "granted" || !s.enabled) return;
        take((await plugin.drain()).messages);
      } catch (e) {
        console.warn("AfueniSms drain failed", e);
      }
    };
    // Accounts load after the page opens: drain again once the borrower's data
    // (and their consent) is in, then on every return to the app.
    let loadedAs = "";
    const onStore = () => {
      const key = `${store.isRemote()}:${store.hasConsent("sms_read")}`;
      if (key !== loadedAs) { loadedAs = key; drain(); }
    };
    onStore();
    plugin.addListener("sms", (m) => take([m])).then((h) => { remove = h.remove; });
    const onVisible = () => { if (document.visibilityState === "visible") drain(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("rr-store", onStore);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("rr-store", onStore);
      remove?.();
    };
  }, []);
  return null;
}

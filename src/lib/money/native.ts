"use client";

// Bridge to the Afueni Android app (android/ folder). The Android app shows
// this same website inside a native shell and adds one plugin, AfueniSms,
// that hands money SMS to the page. In a normal browser none of this exists
// and the Money screen offers share and paste instead.
//
// The plugin only ever passes on messages from money senders (M-PESA, Airtel
// Money, banks, lenders), filtered in the Android code before the page sees
// them. The page then reads them with parseSms and keeps only the event.

import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import type { RawSms } from "./parse";

export type SmsPermission = "granted" | "denied" | "prompt";

interface AfueniSmsPlugin {
  status(): Promise<{ permission: SmsPermission; enabled: boolean }>;
  requestPermission(): Promise<{ permission: SmsPermission }>;
  setEnabled(o: { enabled: boolean }): Promise<void>;
  // Messages that arrived while the page was closed, then cleared on the phone.
  drain(): Promise<{ messages: RawSms[] }>;
  // Money messages already in the inbox since a date (first switch-on).
  readInbox(o: { sinceMs: number }): Promise<{ messages: RawSms[] }>;
  addListener(event: "sms", cb: (m: RawSms) => void): Promise<PluginListenerHandle>;
}

const AfueniSms = registerPlugin<AfueniSmsPlugin>("AfueniSms");

export function smsPlugin(): AfueniSmsPlugin | null {
  if (typeof window === "undefined") return null;
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android" || !Capacitor.isPluginAvailable("AfueniSms")) return null;
  return AfueniSms;
}

export const isAndroidApp = () => smsPlugin() !== null;

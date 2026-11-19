// Server-only: builds the WhatsApp dependencies from environment variables.
import { timingSafeEqual } from "node:crypto";
import { sendSms } from "@/lib/sms";
import { serviceClient } from "@/lib/supabase";
import { graphApi } from "./client";
import type { Deps } from "./service";
import { memoryStore, supabaseStore, type WaStore } from "./store";

export const APP_URL = (process.env.APP_URL || "https://risk-radar-borrower.vercel.app").replace(/\/$/, "");

// Supabase in production. Without a service role key, local development
// (and only local development) falls back to an in-memory store so the
// webhook can be exercised with scripts/wa-simulate.mjs.
const g = globalThis as unknown as { __waMemory?: WaStore };
export function waStore(): WaStore {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) return supabaseStore(serviceClient());
  if (process.env.NODE_ENV === "production" && process.env.WHATSAPP_ALLOW_MEMORY_STORE !== "1") {
    throw new Error("WhatsApp needs SUPABASE_SERVICE_ROLE_KEY in production");
  }
  return (g.__waMemory ??= memoryStore());
}

export function waDeps(): Deps {
  return {
    store: waStore(),
    api: graphApi(),
    appUrl: APP_URL,
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || undefined,
    // A text to the coach on duty with no borrower details in it.
    notifyCoach: async ({ priority }) => {
      const to = process.env.COACH_ALERT_PHONE;
      if (!to) return;
      const label = priority === "urgent" ? "URGENT (safety)" : priority === "high" ? "high priority" : "new";
      await sendSms(to, `Afueni: ${label} WhatsApp case waiting. Open ${APP_URL}/coach`);
    },
    log: (m) => console.warn(m),
  };
}

// Coach inbox access: one shared key for the pilot (COACH_ACCESS_KEY, at
// least 24 characters), sent as "Authorization: Bearer <key>".
export function coachAuthorized(req: Request): boolean {
  const key = process.env.COACH_ACCESS_KEY ?? "";
  const got = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (key.length < 24 || !got) return false;
  const a = Buffer.from(got), b = Buffer.from(key);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const unauthorized = () => Response.json({ error: "Not signed in to the coach inbox." }, { status: 401 });

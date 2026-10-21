import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Accounts mode is on when Supabase is configured; otherwise the app runs in
// demo mode with data in the browser only.
export const accountsEnabled = !!(url && anonKey);

export const supabase: SupabaseClient | null = accountsEnabled ? createClient(url!, anonKey!) : null;

// Server-only client that bypasses row-level security (cron jobs, hooks).
export function serviceClient(): SupabaseClient {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase service role is not configured");
  return createClient(url, key, { auth: { persistSession: false } });
}

// Kenyan numbers as people type them (0712 345 678, 712345678, +254712345678)
// to E.164. Returns null for anything that isn't a Kenyan mobile number.
export function normaliseKenyanPhone(input: string): string | null {
  const d = input.replace(/[^\d+]/g, "");
  const m = d.match(/^(?:\+?254|0)?([17]\d{8})$/);
  return m ? `+254${m[1]}` : null;
}

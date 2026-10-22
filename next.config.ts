import type { NextConfig } from "next";

// The Vercel Supabase integration names its variables SUPABASE_URL and
// SUPABASE_ANON_KEY; the browser can only see NEXT_PUBLIC_ ones, so copy
// them across at build time unless they were set explicitly.
const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "",
    NEXT_PUBLIC_SUPABASE_ANON_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || "",
  },
};

export default nextConfig;

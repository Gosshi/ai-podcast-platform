"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | null = null;

type BrowserSupabaseConfig = {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
};

declare global {
  interface Window {
    __APP_SUPABASE_CONFIG__?: BrowserSupabaseConfig;
  }
}

const getRequiredEnv = (name: "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_ANON_KEY"): string => {
  const browserConfig = typeof window !== "undefined" ? window.__APP_SUPABASE_CONFIG__ : undefined;
  const fallback = name === "NEXT_PUBLIC_SUPABASE_URL"
    ? browserConfig?.supabaseUrl
    : browserConfig?.supabaseAnonKey;
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
};

export const createBrowserSupabaseClient = (): SupabaseClient => {
  if (browserClient) {
    return browserClient;
  }

  browserClient = createClient(
    getRequiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getRequiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      }
    }
  );

  return browserClient;
};

import { createClient } from "@supabase/supabase-js";

const getSupabaseUrl = (): string => {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error("SUPABASE_URL is required");
  }
  return url;
};

const getAnonKey = (): string => {
  const key = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) {
    throw new Error("SUPABASE_ANON_KEY is required");
  }
  return key;
};

const getServiceRoleKey = (): string => {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required");
  }
  return key;
};

export const createAnonClient = () => {
  return createClient(getSupabaseUrl(), getAnonKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
};

export const createServiceRoleClient = () => {
  return createClient(getSupabaseUrl(), getServiceRoleKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
};

/**
 * Create a Supabase client authenticated as the user.
 * Uses the anon key so RLS policies are enforced, with the user's JWT
 * passed via Authorization header so auth.uid() resolves correctly.
 */
export const createUserClient = (accessToken: string) => {
  return createClient(getSupabaseUrl(), getAnonKey(), {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
};

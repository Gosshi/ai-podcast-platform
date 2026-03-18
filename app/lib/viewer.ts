import { cookies } from "next/headers";
import type { User } from "@supabase/supabase-js";
import type { UserPreferenceProfile, UserPreferences } from "@/src/lib/userPreferences";
import { createServiceRoleClient } from "./supabaseClients";
import { ACCESS_TOKEN_COOKIE } from "./authCookies";
import { loadUserPreferences } from "./userPreferences";

export type ViewerState = {
  userId: string;
  email: string | null;
  planType: string | null;
  subscriptionStatus: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  stripeCustomerId: string | null;
  isPaid: boolean;
  preferences: UserPreferences | null;
  preferenceProfile: UserPreferenceProfile | null;
  needsOnboarding: boolean;
};

type SubscriptionRow = {
  plan_type: string | null;
  status: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  stripe_customer_id: string | null;
};

type ProfileRow = {
  stripe_customer_id: string | null;
};

const PAID_STATUSES = new Set(["trialing", "active", "past_due"]);

export const isPaidSubscriptionStatus = (status: string | null | undefined): boolean => {
  if (!status) return false;
  return PAID_STATUSES.has(status);
};

export const ensureViewerProfile = async (user: User): Promise<void> => {
  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("profiles").upsert({
    user_id: user.id,
    email: user.email ?? null
  });

  if (error) {
    throw error;
  }
};

const loadViewerState = async (user: User): Promise<ViewerState> => {
  await ensureViewerProfile(user);

  const supabase = createServiceRoleClient();
  const [{ data: profileData, error: profileError }, { data, error }, preferencesState] = await Promise.all([
    supabase.from("profiles").select("stripe_customer_id").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("subscriptions")
      .select("plan_type, status, current_period_end, cancel_at_period_end, stripe_customer_id")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    loadUserPreferences(user.id)
  ]);

  if (profileError) {
    throw profileError;
  }

  if (error) {
    throw error;
  }

  if (preferencesState.error) {
    throw new Error(preferencesState.error);
  }

  const subscription = (data as SubscriptionRow | null) ?? null;
  const profile = (profileData as ProfileRow | null) ?? null;
  const preferences = preferencesState.preferences;

  return {
    userId: user.id,
    email: user.email ?? null,
    planType: subscription?.plan_type ?? null,
    subscriptionStatus: subscription?.status ?? null,
    currentPeriodEnd: subscription?.current_period_end ?? null,
    cancelAtPeriodEnd: Boolean(subscription?.cancel_at_period_end),
    stripeCustomerId: subscription?.stripe_customer_id ?? profile?.stripe_customer_id ?? null,
    isPaid: isPaidSubscriptionStatus(subscription?.status ?? null),
    preferences,
    preferenceProfile: preferencesState.preferenceProfile,
    needsOnboarding: !preferences
  };
};

const readBearerToken = (authorization: string | null): string | null => {
  if (!authorization) return null;
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
};

export const getViewerFromAccessToken = async (accessToken: string | null): Promise<ViewerState | null> => {
  if (!accessToken) return null;

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user) {
    return null;
  }

  return loadViewerState(data.user);
};

export const getViewerFromRequest = async (request: Request): Promise<ViewerState | null> => {
  const accessToken = readBearerToken(request.headers.get("authorization"));
  return getViewerFromAccessToken(accessToken);
};

export const getAccessTokenFromCookies = async (): Promise<string | null> => {
  const cookieStore = await cookies();
  return cookieStore.get(ACCESS_TOKEN_COOKIE)?.value ?? null;
};

export const getViewerFromCookies = async (): Promise<ViewerState | null> => {
  const accessToken = await getAccessTokenFromCookies();
  return getViewerFromAccessToken(accessToken);
};

import {
  initializeUserPreferenceProfile,
  validateUserPreferencesInput,
  type UserPreferenceProfile,
  type UserPreferences
} from "@/src/lib/userPreferences";
import { createServiceRoleClient } from "./supabaseClients";

type UserPreferencesRow = {
  interest_topics: unknown;
  active_subscriptions: unknown;
  decision_priority: unknown;
  daily_available_time: unknown;
  budget_sensitivity: unknown;
  created_at: string;
  updated_at: string;
};

const USER_PREFERENCES_SELECT =
  "interest_topics, active_subscriptions, decision_priority, daily_available_time, budget_sensitivity, created_at, updated_at";

const normalizeRow = (row: UserPreferencesRow | null): UserPreferences | null => {
  if (!row) {
    return null;
  }

  const validation = validateUserPreferencesInput({
    interestTopics: row.interest_topics,
    activeSubscriptions: row.active_subscriptions,
    decisionPriority: row.decision_priority,
    dailyAvailableTime: row.daily_available_time,
    budgetSensitivity: row.budget_sensitivity
  });

  if (!validation.ok) {
    return null;
  }

  return {
    ...validation.value,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
};

export const loadUserPreferences = async (
  userId: string
): Promise<{ preferences: UserPreferences | null; preferenceProfile: UserPreferenceProfile | null; error: string | null }> => {
  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("user_preferences")
      .select(USER_PREFERENCES_SELECT)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      return {
        preferences: null,
        preferenceProfile: null,
        error: error.message
      };
    }

    const preferences = normalizeRow((data as UserPreferencesRow | null) ?? null);
    return {
      preferences,
      preferenceProfile: preferences ? initializeUserPreferenceProfile(preferences) : null,
      error: null
    };
  } catch (error) {
    return {
      preferences: null,
      preferenceProfile: null,
      error: error instanceof Error ? error.message : "user_preferences_load_failed"
    };
  }
};

export const upsertUserPreferences = async (
  userId: string,
  preferences: Omit<UserPreferences, "createdAt" | "updatedAt">
): Promise<{ preferences: UserPreferences | null; preferenceProfile: UserPreferenceProfile | null; error: string | null }> => {
  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("user_preferences")
      .upsert(
        {
          user_id: userId,
          interest_topics: preferences.interestTopics,
          active_subscriptions: preferences.activeSubscriptions,
          decision_priority: preferences.decisionPriority,
          daily_available_time: preferences.dailyAvailableTime,
          budget_sensitivity: preferences.budgetSensitivity
        },
        {
          onConflict: "user_id"
        }
      )
      .select(USER_PREFERENCES_SELECT)
      .single();

    if (error) {
      return {
        preferences: null,
        preferenceProfile: null,
        error: error.message
      };
    }

    const normalized = normalizeRow(data as UserPreferencesRow);
    return {
      preferences: normalized,
      preferenceProfile: normalized ? initializeUserPreferenceProfile(normalized) : null,
      error: normalized ? null : "user_preferences_normalization_failed"
    };
  } catch (error) {
    return {
      preferences: null,
      preferenceProfile: null,
      error: error instanceof Error ? error.message : "user_preferences_upsert_failed"
    };
  }
};

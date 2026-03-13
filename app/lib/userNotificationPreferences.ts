import {
  DEFAULT_USER_NOTIFICATION_PREFERENCES,
  type UserNotificationPreferences
} from "@/src/lib/alerts";
import { createServiceRoleClient } from "./supabaseClients";

type UserNotificationPreferencesRow = {
  weekly_digest_enabled: boolean;
  deadline_alert_enabled: boolean;
  outcome_reminder_enabled: boolean;
  created_at: string;
  updated_at: string;
};

const USER_NOTIFICATION_PREFERENCES_SELECT =
  "weekly_digest_enabled, deadline_alert_enabled, outcome_reminder_enabled, created_at, updated_at";

const normalizeRow = (
  row: UserNotificationPreferencesRow | null | undefined
): UserNotificationPreferences => {
  if (!row) {
    return DEFAULT_USER_NOTIFICATION_PREFERENCES;
  }

  return {
    weeklyDigestEnabled: Boolean(row.weekly_digest_enabled),
    deadlineAlertEnabled: Boolean(row.deadline_alert_enabled),
    outcomeReminderEnabled: Boolean(row.outcome_reminder_enabled)
  };
};

export const loadUserNotificationPreferences = async (
  userId: string
): Promise<{ preferences: UserNotificationPreferences; error: string | null }> => {
  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("user_notification_preferences")
      .select(USER_NOTIFICATION_PREFERENCES_SELECT)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      return {
        preferences: DEFAULT_USER_NOTIFICATION_PREFERENCES,
        error: error.message
      };
    }

    return {
      preferences: normalizeRow((data as UserNotificationPreferencesRow | null) ?? null),
      error: null
    };
  } catch (error) {
    return {
      preferences: DEFAULT_USER_NOTIFICATION_PREFERENCES,
      error: error instanceof Error ? error.message : "user_notification_preferences_load_failed"
    };
  }
};

export const upsertUserNotificationPreferences = async (
  userId: string,
  preferences: UserNotificationPreferences
): Promise<{ preferences: UserNotificationPreferences; error: string | null }> => {
  try {
    const supabase = createServiceRoleClient();
    const { data, error } = await supabase
      .from("user_notification_preferences")
      .upsert(
        {
          user_id: userId,
          weekly_digest_enabled: preferences.weeklyDigestEnabled,
          deadline_alert_enabled: preferences.deadlineAlertEnabled,
          outcome_reminder_enabled: preferences.outcomeReminderEnabled
        },
        {
          onConflict: "user_id"
        }
      )
      .select(USER_NOTIFICATION_PREFERENCES_SELECT)
      .single();

    if (error) {
      return {
        preferences,
        error: error.message
      };
    }

    return {
      preferences: normalizeRow(data as UserNotificationPreferencesRow),
      error: null
    };
  } catch (error) {
    return {
      preferences,
      error: error instanceof Error ? error.message : "user_notification_preferences_upsert_failed"
    };
  }
};

import { verifyCsrfOrigin } from "@/app/lib/csrf";
import { jsonResponse } from "@/app/lib/apiResponse";
import { getViewerFromCookies } from "@/app/lib/viewer";
import { upsertUserPreferences } from "@/app/lib/userPreferences";
import { recordAnalyticsEvent } from "@/src/lib/analytics";
import {
  initializeUserPreferenceProfile,
  validateUserPreferencesInput
} from "@/src/lib/userPreferences";

export const runtime = "nodejs";

type UserPreferencesRequest = {
  interestTopics?: unknown;
  activeSubscriptions?: unknown;
  decisionPriority?: unknown;
  dailyAvailableTime?: unknown;
  budgetSensitivity?: unknown;
};

export async function GET() {
  const viewer = await getViewerFromCookies();
  if (!viewer) {
    return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  }

  return jsonResponse({
    ok: true,
    preferences: viewer.preferences,
    preferenceProfile: viewer.preferenceProfile,
    needsOnboarding: viewer.needsOnboarding
  });
}

export async function POST(request: Request) {
  const csrf = verifyCsrfOrigin(request);
  if (!csrf.ok) {
    return jsonResponse({ ok: false, error: csrf.error }, 403);
  }

  const viewer = await getViewerFromCookies();
  if (!viewer) {
    return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  }

  const body = (await request.json().catch(() => ({}))) as UserPreferencesRequest;
  const validation = validateUserPreferencesInput(body);
  if (!validation.ok) {
    return jsonResponse({ ok: false, error: validation.error }, 400);
  }

  const isFirstRun = viewer.needsOnboarding;
  const result = await upsertUserPreferences(viewer.userId, validation.value);
  if (result.error || !result.preferences) {
    return jsonResponse({ ok: false, error: result.error ?? "user_preferences_save_failed" }, 500);
  }

  try {
    await recordAnalyticsEvent({
      eventName: "preference_update",
      viewer,
      page: "/onboarding",
      source: isFirstRun ? "onboarding_first_run" : "onboarding_preferences_refresh",
      properties: {
        page: "/onboarding",
        source: isFirstRun ? "onboarding_first_run" : "onboarding_preferences_refresh",
        is_first_run: isFirstRun,
        interest_topics: result.preferences.interestTopics,
        active_subscriptions: result.preferences.activeSubscriptions,
        decision_priority: result.preferences.decisionPriority,
        daily_available_time: result.preferences.dailyAvailableTime,
        budget_sensitivity: result.preferences.budgetSensitivity,
        interest_topic_count: result.preferences.interestTopics.length,
        active_subscription_count: result.preferences.activeSubscriptions.filter((entry) => entry !== "none").length
      }
    });
  } catch (error) {
    console.error("user_preferences_analytics_error", { error, userId: viewer.userId });
  }

  return jsonResponse({
    ok: true,
    preferences: result.preferences,
    preferenceProfile: result.preferenceProfile ?? initializeUserPreferenceProfile(result.preferences),
    needsOnboarding: false
  });
}

import { getViewerFromCookies } from "@/app/lib/viewer";
import { upsertUserPreferences } from "@/app/lib/userPreferences";
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
};

const jsonResponse = (body: Record<string, unknown>, status = 200): Response => {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
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
  const viewer = await getViewerFromCookies();
  if (!viewer) {
    return jsonResponse({ ok: false, error: "unauthorized" }, 401);
  }

  const body = (await request.json().catch(() => ({}))) as UserPreferencesRequest;
  const validation = validateUserPreferencesInput(body);
  if (!validation.ok) {
    return jsonResponse({ ok: false, error: validation.error }, 400);
  }

  const result = await upsertUserPreferences(viewer.userId, validation.value);
  if (result.error || !result.preferences) {
    return jsonResponse({ ok: false, error: result.error ?? "user_preferences_save_failed" }, 500);
  }

  return jsonResponse({
    ok: true,
    preferences: result.preferences,
    preferenceProfile: result.preferenceProfile ?? initializeUserPreferenceProfile(result.preferences),
    needsOnboarding: false
  });
}

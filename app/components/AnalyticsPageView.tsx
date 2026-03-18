"use client";

import AnalyticsEventOnRender from "@/app/components/AnalyticsEventOnRender";
import { track, type AnalyticsEventName, type AnalyticsTrackProperties } from "@/src/lib/analytics";

const DAILY_ACTIVE_STORAGE_KEY = "ai-podcast-platform:daily-active-date";

const trackDailyActiveOnce = (page: string): void => {
  if (typeof window === "undefined") {
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  const lastTracked = window.localStorage.getItem(DAILY_ACTIVE_STORAGE_KEY);

  if (lastTracked === today) {
    return;
  }

  window.localStorage.setItem(DAILY_ACTIVE_STORAGE_KEY, today);
  track("user_daily_active", { page, date: today });
};

type AnalyticsPageViewProps = {
  page: string;
  pageEventName: AnalyticsEventName;
  extraProperties?: AnalyticsTrackProperties;
};

export default function AnalyticsPageView({
  page,
  pageEventName,
  extraProperties
}: AnalyticsPageViewProps) {
  const properties = {
    page,
    ...extraProperties
  };

  trackDailyActiveOnce(page);

  return (
    <>
      <AnalyticsEventOnRender eventName="page_view" properties={properties} />
      <AnalyticsEventOnRender eventName={pageEventName} properties={properties} />
    </>
  );
}

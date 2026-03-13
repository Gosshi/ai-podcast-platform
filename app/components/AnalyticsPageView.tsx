"use client";

import AnalyticsEventOnRender from "@/app/components/AnalyticsEventOnRender";
import type { AnalyticsEventName, AnalyticsTrackProperties } from "@/src/lib/analytics";

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

  return (
    <>
      <AnalyticsEventOnRender eventName="page_view" properties={properties} />
      <AnalyticsEventOnRender eventName={pageEventName} properties={properties} />
    </>
  );
}


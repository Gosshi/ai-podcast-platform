"use client";

import { useEffect, useRef } from "react";
import { track, type AnalyticsEventName, type AnalyticsTrackProperties } from "@/src/lib/analytics";

type AnalyticsEventOnRenderProps = {
  eventName: AnalyticsEventName;
  properties?: AnalyticsTrackProperties;
};

export default function AnalyticsEventOnRender({
  eventName,
  properties
}: AnalyticsEventOnRenderProps) {
  const hasTrackedRef = useRef(false);
  const serializedProperties = JSON.stringify(properties ?? {});

  useEffect(() => {
    if (hasTrackedRef.current) {
      return;
    }

    hasTrackedRef.current = true;
    track(eventName, properties ?? {});
  }, [eventName, properties, serializedProperties]);

  return null;
}


"use client";

import Link from "next/link";
import type { ComponentProps, MouseEvent } from "react";
import { track, type AnalyticsEventName, type AnalyticsTrackProperties } from "@/src/lib/analytics";

type TrackedLinkProps = ComponentProps<typeof Link> & {
  eventName: AnalyticsEventName;
  eventProperties?: AnalyticsTrackProperties;
  additionalEvents?: Array<{
    eventName: AnalyticsEventName;
    eventProperties?: AnalyticsTrackProperties;
  }>;
};

const shouldTrackNavigationClick = (event: MouseEvent<HTMLAnchorElement>): boolean => {
  return !event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey;
};

export default function TrackedLink({
  eventName,
  eventProperties,
  additionalEvents,
  onClick,
  ...props
}: TrackedLinkProps) {
  return (
    <Link
      {...props}
      onClick={(event) => {
        onClick?.(event);

        if (shouldTrackNavigationClick(event)) {
          track(eventName, eventProperties ?? {});
          additionalEvents?.forEach((entry) => {
            track(entry.eventName, entry.eventProperties ?? {});
          });
        }
      }}
    />
  );
}

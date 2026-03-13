"use client";

import type { AnalyticsEventName } from "./events";

type AnalyticsScalar = string | number | boolean | null;
type AnalyticsJsonValue = AnalyticsScalar | AnalyticsJsonValue[] | { [key: string]: AnalyticsJsonValue };
export type AnalyticsTrackProperties = Record<string, AnalyticsJsonValue | undefined>;

type AnalyticsPayload = {
  anonymousId: string;
  eventName: AnalyticsEventName;
  properties: AnalyticsTrackProperties;
};

const ANALYTICS_ENDPOINT = "/api/analytics/track";
const ANONYMOUS_ID_STORAGE_KEY = "ai-podcast-platform:anonymous-id";

const createAnonymousId = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `anon_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
};

export const getAnonymousId = (): string => {
  if (typeof window === "undefined") {
    return "server";
  }

  const existing = window.localStorage.getItem(ANONYMOUS_ID_STORAGE_KEY);
  if (existing) {
    return existing;
  }

  const nextValue = createAnonymousId();
  window.localStorage.setItem(ANONYMOUS_ID_STORAGE_KEY, nextValue);
  return nextValue;
};

const serializeProperties = (properties: AnalyticsTrackProperties): AnalyticsTrackProperties => {
  return Object.fromEntries(
    Object.entries(properties).filter((entry): entry is [string, AnalyticsJsonValue] => entry[1] !== undefined)
  );
};

export const buildAnalyticsPayload = (
  eventName: AnalyticsEventName,
  properties: AnalyticsTrackProperties = {}
): AnalyticsPayload => {
  const page =
    typeof window !== "undefined" && !properties.page ? window.location.pathname : properties.page;

  return {
    anonymousId: getAnonymousId(),
    eventName,
    properties: serializeProperties({
      ...properties,
      page,
      timestamp: typeof properties.timestamp === "string" ? properties.timestamp : new Date().toISOString()
    })
  };
};

const sendPayload = (payload: AnalyticsPayload): void => {
  const body = JSON.stringify(payload);

  if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    const accepted = navigator.sendBeacon(
      ANALYTICS_ENDPOINT,
      new Blob([body], { type: "application/json" })
    );

    if (accepted) {
      return;
    }
  }

  void fetch(ANALYTICS_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    credentials: "same-origin",
    keepalive: true,
    body
  }).catch(() => undefined);
};

export const track = (
  eventName: AnalyticsEventName,
  properties: AnalyticsTrackProperties = {}
): void => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    sendPayload(buildAnalyticsPayload(eventName, properties));
  } catch {
    // Tracking must never block product flows.
  }
};

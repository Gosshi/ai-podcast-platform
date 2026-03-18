"use client";

import type { JSX } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import TrackedLink from "@/app/components/TrackedLink";
import styles from "./app-navigation.module.css";

const NAV_ITEMS = [
  { href: "/decisions", label: "今日のエピソード", mobileLabel: "今日" },
  { href: "/episodes", label: "アーカイブ", mobileLabel: "一覧" },
  { href: "/saved", label: "保存済み", mobileLabel: "保存" },
  { href: "/history", label: "履歴", mobileLabel: "履歴" },
  { href: "/alerts", label: "通知", mobileLabel: "通知" },
  { href: "/account", label: "アカウント", mobileLabel: "設定" }
] as const;

// Bottom nav shows first 3 + alerts + "more" button
const MOBILE_BOTTOM_ITEMS = NAV_ITEMS.slice(0, 3);
const MOBILE_MORE_ITEMS = [NAV_ITEMS[3], NAV_ITEMS[4], NAV_ITEMS[5]];

const NAV_ICONS: Record<string, JSX.Element> = {
  "/decisions": (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 4.75a7.25 7.25 0 1 0 0 14.5 7.25 7.25 0 0 0 0-14.5Z" />
      <path d="M10.75 9.5 15.25 12l-4.5 2.5V9.5Z" fill="currentColor" stroke="none" />
    </svg>
  ),
  "/episodes": (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4.75 5.75h14.5" />
      <path d="M4.75 9.75h14.5" />
      <path d="M4.75 13.75h8.5" />
      <path d="M4.75 17.75h8.5" />
      <path d="M16.25 13.75v5.5" />
      <path d="M14.5 15.5h3.5" />
    </svg>
  ),
  "/saved": (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7.25 5.75h9.5a1 1 0 0 1 1 1v11.5l-5.75-3-5.75 3V6.75a1 1 0 0 1 1-1Z" />
    </svg>
  ),
  "/history": (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 8v4l3 2" />
      <path d="M5.63 7.16A7.25 7.25 0 1 1 4.75 12" />
      <path d="M4.75 4.75v3.5h3.5" />
    </svg>
  ),
  "/alerts": (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 4.75a4.25 4.25 0 0 0-4.25 4.25v1.38c0 .84-.28 1.66-.8 2.32L5.75 14.2v1.55h12.5V14.2l-1.2-1.5a3.75 3.75 0 0 1-.8-2.32V9A4.25 4.25 0 0 0 12 4.75Z" />
      <path d="M9.75 17.25a2.25 2.25 0 0 0 4.5 0" />
    </svg>
  ),
  "/account": (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 12a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5Z" />
      <path d="M6.75 18.25a5.25 5.25 0 0 1 10.5 0" />
    </svg>
  )
};

const MORE_ICON = (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="6" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="12" cy="18" r="1.5" fill="currentColor" stroke="none" />
  </svg>
);

const isActivePath = (pathname: string, href: string): boolean => {
  if (href === "/saved") {
    return pathname === "/saved" || pathname.startsWith("/saved/") || pathname.startsWith("/decisions/library");
  }

  if (href === "/episodes") {
    return pathname === "/episodes" || pathname.startsWith("/episodes/");
  }

  if (href === "/decisions") {
    return pathname.startsWith("/decisions") && !pathname.startsWith("/decisions/library");
  }

  return pathname === href || pathname.startsWith(`${href}/`);
};

export default function AppNavigation() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  const closeMore = useCallback(() => setMoreOpen(false), []);

  // Close on outside click
  useEffect(() => {
    if (!moreOpen) return;
    const onClick = (e: MouseEvent) => {
      if (sheetRef.current && !sheetRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    };
    window.addEventListener("click", onClick, { capture: true });
    return () => window.removeEventListener("click", onClick, { capture: true });
  }, [moreOpen]);

  if (pathname.startsWith("/auth/callback")) {
    return null;
  }

  const moreHasActive = MOBILE_MORE_ITEMS.some((item) => isActivePath(pathname, item.href));

  return (
    <header className={styles.header}>
      <div className={styles.shell}>
        <TrackedLink
          href="/"
          className={styles.brand}
          eventName="nav_click"
          eventProperties={{
            page: pathname,
            source: "header_brand",
            destination: "/"
          }}
        >
          AI Podcast
        </TrackedLink>

        <nav className={styles.nav} aria-label="Primary">
          {NAV_ITEMS.map((item) => (
            <TrackedLink
              key={item.href}
              href={item.href}
              className={`${styles.link} ${isActivePath(pathname, item.href) ? styles.linkActive : ""}`.trim()}
              eventName="nav_click"
              eventProperties={{
                page: pathname,
                source: "header_nav",
                destination: item.href,
                label: item.label
              }}
            >
              {item.label}
            </TrackedLink>
          ))}
        </nav>
      </div>

      {/* Mobile bottom navigation */}
      <nav className={styles.mobileNav} aria-label="Mobile primary">
        {MOBILE_BOTTOM_ITEMS.map((item) => (
          <TrackedLink
            key={item.href}
            href={item.href}
            className={`${styles.mobileLink} ${isActivePath(pathname, item.href) ? styles.mobileLinkActive : ""}`.trim()}
            aria-label={item.label}
            eventName="nav_click"
            eventProperties={{
              page: pathname,
              source: "mobile_bottom_nav",
              destination: item.href,
              label: item.label
            }}
          >
            <span className={styles.mobileIcon}>{NAV_ICONS[item.href]}</span>
            <span className={styles.mobileLabel}>{item.mobileLabel}</span>
          </TrackedLink>
        ))}

        {/* Alerts direct link */}
        <TrackedLink
          href="/alerts"
          className={`${styles.mobileLink} ${isActivePath(pathname, "/alerts") ? styles.mobileLinkActive : ""}`.trim()}
          aria-label="通知"
          eventName="nav_click"
          eventProperties={{
            page: pathname,
            source: "mobile_bottom_nav",
            destination: "/alerts",
            label: "通知"
          }}
        >
          <span className={styles.mobileIcon}>{NAV_ICONS["/alerts"]}</span>
          <span className={styles.mobileLabel}>通知</span>
        </TrackedLink>

        {/* More button */}
        <button
          type="button"
          className={`${styles.mobileLink} ${moreHasActive && !moreOpen ? styles.mobileLinkActive : ""}`.trim()}
          onClick={() => setMoreOpen(!moreOpen)}
          aria-label="その他のメニュー"
          aria-expanded={moreOpen}
        >
          <span className={styles.mobileIcon}>{MORE_ICON}</span>
          <span className={styles.mobileLabel}>その他</span>
        </button>
      </nav>

      {/* More sheet */}
      {moreOpen ? (
        <>
          <div className={styles.moreOverlay} onClick={closeMore} />
          <div ref={sheetRef} className={styles.moreSheet}>
            {MOBILE_MORE_ITEMS.map((item) => (
              <TrackedLink
                key={item.href}
                href={item.href}
                className={`${styles.moreLink} ${isActivePath(pathname, item.href) ? styles.moreLinkActive : ""}`.trim()}
                onClick={closeMore}
                eventName="nav_click"
                eventProperties={{
                  page: pathname,
                  source: "mobile_more_sheet",
                  destination: item.href,
                  label: item.label
                }}
              >
                <span className={styles.moreIcon}>{NAV_ICONS[item.href]}</span>
                <span>{item.label}</span>
              </TrackedLink>
            ))}
          </div>
        </>
      ) : null}

      <div className={styles.mobileNavSpacer} />
    </header>
  );
}

"use client";

import type { JSX } from "react";
import { usePathname } from "next/navigation";
import TrackedLink from "@/app/components/TrackedLink";
import { BRAND_NAME, PRODUCT_NAME } from "@/src/lib/brand";
import styles from "./app-navigation.module.css";

const NAV_ITEMS = [
  { href: "/decisions", label: "今日のエピソード", mobileLabel: "今日" },
  { href: "/episodes", label: "アーカイブ", mobileLabel: "一覧" },
  { href: "/history", label: "履歴", mobileLabel: "履歴" },
  { href: "/account", label: "アカウント", mobileLabel: "設定" }
] as const;

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
  "/history": (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 8v4l3 2" />
      <path d="M5.63 7.16A7.25 7.25 0 1 1 4.75 12" />
      <path d="M4.75 4.75v3.5h3.5" />
    </svg>
  ),
  "/account": (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 12a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5Z" />
      <path d="M6.75 18.25a5.25 5.25 0 0 1 10.5 0" />
    </svg>
  )
};

const isActivePath = (pathname: string, href: string): boolean => {
  if (href === "/decisions") {
    return pathname.startsWith("/decisions");
  }

  return pathname === href || pathname.startsWith(`${href}/`);
};

export default function AppNavigation() {
  const pathname = usePathname();

  if (pathname.startsWith("/auth/callback")) {
    return null;
  }

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
          <span className={styles.brandEyebrow}>{BRAND_NAME}</span>
          <span className={styles.brandTitle}>{PRODUCT_NAME}</span>
        </TrackedLink>

        <nav className={styles.nav} aria-label="Primary">
          {NAV_ITEMS.map((item) => (
            <TrackedLink
              key={item.href}
              href={item.href}
              className={`${styles.link} ${isActivePath(pathname, item.href) ? styles.linkActive : ""}`.trim()}
              aria-current={isActivePath(pathname, item.href) ? "page" : undefined}
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
        {NAV_ITEMS.map((item) => (
          <TrackedLink
            key={item.href}
            href={item.href}
            className={`${styles.mobileLink} ${isActivePath(pathname, item.href) ? styles.mobileLinkActive : ""}`.trim()}
            aria-label={item.label}
            aria-current={isActivePath(pathname, item.href) ? "page" : undefined}
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
      </nav>

      <div className={styles.mobileNavSpacer} />
    </header>
  );
}

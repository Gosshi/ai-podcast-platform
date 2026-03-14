"use client";

import { usePathname } from "next/navigation";
import TrackedLink from "@/app/components/TrackedLink";
import styles from "./app-navigation.module.css";

const NAV_ITEMS = [
  { href: "/decisions", label: "今日の判断" },
  { href: "/saved", label: "保存" },
  { href: "/history", label: "履歴" },
  { href: "/account", label: "アカウント" }
];

const isActivePath = (pathname: string, href: string): boolean => {
  if (href === "/saved") {
    return pathname === "/saved" || pathname.startsWith("/saved/") || pathname.startsWith("/decisions/library");
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
          AI Decision Assistant
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
    </header>
  );
}

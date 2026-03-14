"use client";

import { usePathname } from "next/navigation";
import TrackedLink from "@/app/components/TrackedLink";
import styles from "./app-navigation.module.css";

const NAV_ITEMS = [
  { href: "/", label: "Home" },
  { href: "/decisions", label: "Decisions" },
  { href: "/decisions/library", label: "Library" },
  { href: "/history", label: "History" },
  { href: "/account", label: "Account" }
];

const isActivePath = (pathname: string, href: string): boolean => {
  if (href === "/") {
    return pathname === "/";
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
          視聴判断ガイド
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

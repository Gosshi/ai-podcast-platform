"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./app-navigation.module.css";

const NAV_ITEMS = [
  { href: "/decisions", label: "Decisions" },
  { href: "/weekly-decisions", label: "Weekly Digest" },
  { href: "/episodes", label: "Episodes" },
  { href: "/letters", label: "Letters" },
  { href: "/account", label: "Account" }
];

const isActivePath = (pathname: string, href: string): boolean => {
  if (href === "/decisions" && pathname === "/") {
    return true;
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
        <Link href="/decisions" className={styles.brand}>
          AI Podcast Platform
        </Link>

        <nav className={styles.nav} aria-label="Primary">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.link} ${isActivePath(pathname, item.href) ? styles.linkActive : ""}`.trim()}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

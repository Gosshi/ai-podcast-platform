"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./admin.module.css";

const NAV_ITEMS = [
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/trends", label: "Trends" },
  { href: "/admin/job-runs", label: "Job Runs" },
  { href: "/admin/manual-publish", label: "Publish" }
] as const;

export default function AdminNav() {
  const pathname = usePathname();

  if (pathname === "/admin/access") {
    return null;
  }

  return (
    <header className={styles.topBar}>
      <Link href="/admin/analytics" className={styles.brand}>
        Admin
      </Link>
      <nav className={styles.nav}>
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`${styles.navLink} ${pathname === item.href ? styles.navLinkActive : ""}`.trim()}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

"use client";

import { usePathname } from "next/navigation";
import TrackedLink from "@/app/components/TrackedLink";
import { SITE_NAME } from "@/src/lib/brand";
import styles from "./site-footer.module.css";

const FOOTER_LINKS = [
  {
    href: "https://podcasts.apple.com/jp/podcast/%E5%88%A4%E6%96%AD%E3%81%AE%E3%81%98%E3%81%8B%E3%82%93-by-signalmove/id1887020163",
    label: "Apple Podcasts"
  },
  {
    href: "https://open.spotify.com/show/6nswsdY9ScaOvaLBkeKsFH",
    label: "Spotify"
  },
  {
    href: "https://x.com/signalmove_jp",
    label: "X"
  },
  {
    href: "/episodes",
    label: "公開エピソード"
  },
  {
    href: "/commercial-disclosure",
    label: "特商法に基づく表記"
  },
  {
    href: "/terms",
    label: "利用規約"
  },
  {
    href: "/privacy",
    label: "プライバシーポリシー"
  },
  {
    href: "/feed.xml",
    label: "Podcast RSS"
  }
] as const;

export default function SiteFooter() {
  const pathname = usePathname();

  if (pathname.startsWith("/auth/callback")) {
    return null;
  }

  return (
    <footer className={styles.footer}>
      <div className={styles.shell}>
        <div className={styles.brandBlock}>
          <strong>{SITE_NAME}</strong>
          <p>毎日の判断を、聴くだけで整理する。</p>
        </div>
        <nav className={styles.nav} aria-label="Footer">
          {FOOTER_LINKS.map((item) => (
            <TrackedLink
              key={item.href}
              href={item.href}
              className={styles.link}
              eventName="nav_click"
              eventProperties={{
                page: pathname,
                source: "footer_nav",
                destination: item.href,
                label: item.label
              }}
              target={item.href.startsWith("http") ? "_blank" : undefined}
              rel={item.href.startsWith("http") ? "noreferrer" : undefined}
            >
              {item.label}
            </TrackedLink>
          ))}
        </nav>
      </div>
    </footer>
  );
}

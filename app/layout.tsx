import type { Metadata } from "next";
import AppNavigation from "@/app/components/AppNavigation";
import "./globals.css";

const SITE_NAME = "判断のじかん — AI Podcast";
const SITE_DESCRIPTION =
  "AIが毎朝ポッドキャストを自動生成。通勤中に聴くだけで、サブスク・買い物・エンタメの判断が整理される。";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://handan-no-jikan.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`
  },
  description: SITE_DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    locale: "ja_JP",
    url: SITE_URL
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION
  },
  robots: {
    index: true,
    follow: true
  },
  alternates: {
    canonical: SITE_URL
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const publicSupabaseConfig = JSON.stringify({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "",
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? ""
  });

  return (
    <html lang="ja">
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__APP_SUPABASE_CONFIG__ = ${publicSupabaseConfig};`
          }}
        />
        <AppNavigation />
        {children}
      </body>
    </html>
  );
}

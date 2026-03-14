import type { Metadata } from "next";
import AppNavigation from "@/app/components/AppNavigation";
import "./globals.css";

export const metadata: Metadata = {
  title: "視聴判断ガイド",
  description:
    "エンタメ視聴とサブスクの迷いを、AIと履歴で整理する。今日見るもの、続けるもの、見送るものを決めるためのサービスです。"
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

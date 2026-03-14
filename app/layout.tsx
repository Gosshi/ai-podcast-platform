import type { Metadata } from "next";
import AppNavigation from "@/app/components/AppNavigation";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Decision Assistant",
  description:
    "日々の判断をAIと履歴で整理するDecision Assistant。短い判断カードで行動、結果、学習のループを回します。"
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

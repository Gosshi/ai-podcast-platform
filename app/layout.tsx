import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Podcast Platform",
  description: "Staging environment for AI podcast platform"
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
        {children}
      </body>
    </html>
  );
}

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
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import "./globals.css";
import Link from "next/link";
import { Nav } from "@/components/Nav";

export const metadata: Metadata = {
  title: "Risk Radar: Loan Wallet",
  description: "See all your loans in one place, know what they really cost, and get help before a loan goes bad.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#0f766e",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <div className="mx-auto min-h-screen max-w-3xl pb-24">
          <header className="flex items-center justify-between px-4 pb-2 pt-5">
            <Link href="/" className="flex items-center gap-2 font-semibold">
              <span className="inline-block h-6 w-6 rounded-full border-4 border-brand" aria-hidden />
              Risk Radar
            </Link>
            <Link href="/account" className="text-sm text-muted">Account</Link>
          </header>
          <main className="px-4">{children}</main>
        </div>
        <Nav />
      </body>
    </html>
  );
}

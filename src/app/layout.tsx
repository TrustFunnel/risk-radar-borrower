import type { Metadata, Viewport } from "next";
import "@fontsource/ibm-plex-sans/latin-400.css";
import "@fontsource/ibm-plex-sans/latin-500.css";
import "@fontsource/ibm-plex-sans/latin-600.css";
import "@fontsource/ibm-plex-sans/latin-700.css";
import "./globals.css";
import Link from "next/link";
import { HeartIcon, UserIcon } from "@/components/Icons";
import { Logo } from "@/components/Logo";
import { Nav } from "@/components/Nav";
import { SaveErrors, SessionProvider } from "@/components/Session";

export const metadata: Metadata = {
  title: "Risk Radar: Loan Wallet",
  description: "See all your loans in one place, know what they really cost, and get help before a loan goes bad.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#0b0e11",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <SessionProvider>
        <div className="mx-auto min-h-screen max-w-3xl pb-24">
          <header className="sticky top-0 z-10 flex items-center justify-between bg-background/95 px-4 py-3 backdrop-blur">
            <Link href="/"><Logo /></Link>
            <Link href="/account" aria-label="Account" className="flex h-9 w-9 items-center justify-center rounded-full bg-raised text-muted hover:text-brand">
              <UserIcon />
            </Link>
          </header>
          <p className="mx-4 mb-2 flex items-center justify-center gap-1.5 rounded-lg bg-brand-soft px-3 py-1.5 text-xs text-brand">
            <HeartIcon className="h-3.5 w-3.5" />
            <span><span className="font-semibold">We care.</span> We&apos;re on your side with every loan.</span>
          </p>
          <SaveErrors />
          <main className="px-4">{children}</main>
        </div>
        <Nav />
        </SessionProvider>
      </body>
    </html>
  );
}

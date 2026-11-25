import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "./globals.css";
import { MoneyCapture } from "@/components/MoneyCapture";
import { Shell } from "@/components/Nav";
import { SessionProvider } from "@/components/Session";
import { themeScript } from "@/lib/theme";

export const metadata: Metadata = {
  title: "Afueni by Risk Radar",
  description: "See all your loans in one place, know what they really cost, and get help before a loan goes bad.",
  applicationName: "Afueni",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }, { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  appleWebApp: { capable: true, title: "Afueni", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f2ed" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0c10" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="antialiased">
        <SessionProvider>
          <Shell>{children}</Shell>
          <MoneyCapture />
        </SessionProvider>
      </body>
    </html>
  );
}

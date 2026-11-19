import type { CapacitorConfig } from "@capacitor/cli";

// The Afueni Android app: a native shell around the live website plus one
// plugin (AfueniSms) that reads money SMS. See docs/ANDROID-sms.md.
// AFUENI_URL picks the site the app opens; it defaults to production.
const config: CapacitorConfig = {
  appId: "com.riskradar.afueni",
  appName: "Afueni",
  webDir: "android-shell",
  server: {
    url: process.env.AFUENI_URL || "https://risk-radar-borrower.vercel.app",
    errorPath: "index.html",
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;

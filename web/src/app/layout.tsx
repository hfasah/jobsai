import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Inter, Plus_Jakarta_Sans, Geist_Mono, Fraunces } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { I18nProvider } from "@/lib/i18n";
import { MarketingPopups } from "@/components/marketing/marketing-popups";
import { SupportWidget } from "@/components/marketing/support-widget";
import { AffiliateTracker } from "@/components/affiliate-tracker";
import { CookieConsent } from "@/components/cookie-consent";
import { PostHogTracker } from "@/components/analytics/posthog-provider";
import "./globals.css";

// Body — Notion's primary font: clean, highly legible, modern
const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

// Display headings — geometric grotesque, close to Apple SF Pro Display on web
const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-display-sans",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Editorial serif for AI-output surfaces (scores, report headers)
const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  axes: ["opsz", "SOFT"],
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://jobsai.work";

// The same codebase powers two deploys. NEXT_PUBLIC_SITE=enterprise (set on the
// jobsai-enterprise project) switches the default site metadata to the recruiter
// product so app.jobsai.work doesn't show the consumer "auto-apply" message.
const IS_ENTERPRISE = process.env.NEXT_PUBLIC_SITE === "enterprise";

const SITE_NAME = IS_ENTERPRISE ? "JobsAI Enterprise" : "JobsAI";
const SITE_TITLE = IS_ENTERPRISE
  ? "JobsAI Enterprise — Talent Acquisition Operating System"
  : "JobsAI — Auto-apply to jobs and land interviews, guaranteed";
const SITE_DESC = IS_ENTERPRISE
  ? "The Talent Acquisition Operating System that combines applicant tracking, recruiting CRM, sourcing, interviews, outreach, and analytics in one platform."
  : "JobsAI auto-applies to thousands of jobs and reaches recruiters directly for you — so you stop grinding applications and start landing interviews, guaranteed. Plus AI interview prep built from your resume and the role.";
const SITE_TEMPLATE = IS_ENTERPRISE ? "%s | JobsAI Enterprise" : "%s | JobsAI";

export const metadata: Metadata = {
  title: {
    default: SITE_TITLE,
    template: SITE_TEMPLATE,
  },
  description: SITE_DESC,
  metadataBase: new URL(APP_URL),
  openGraph: {
    type: "website",
    url: APP_URL,
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESC,
    images: [
      {
        url: "/og-image.png",
        width: 680,
        height: 680,
        alt: SITE_NAME,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESC,
    images: ["/og-image.png"],
  },
  icons: {
    icon: [
      { url: "/icon.png", type: "image/png", sizes: "any" },
      { url: "/favicon.ico", sizes: "64x64" },
    ],
    apple: { url: "/apple-icon.png", sizes: "180x180" },
    shortcut: "/icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider afterSignOutUrl="/enterprise/home">
      <html
        lang="en"
        className={`${inter.variable} ${plusJakarta.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
        suppressHydrationWarning
      >
        <body className="min-h-full flex flex-col" suppressHydrationWarning>
          <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
            <I18nProvider>
              {children}
              <MarketingPopups />
              <SupportWidget />
              <AffiliateTracker />
              <CookieConsent />
              <PostHogTracker />
            </I18nProvider>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}

import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Editorial display serif for AI-output surfaces (scores, report headers)
const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  axes: ["opsz", "SOFT"],
});

export const metadata: Metadata = {
  title: {
    default: "JobsAI",
    template: "%s | JobsAI",
  },
  description:
    "AI-powered job application assistant — match jobs, tailor resumes, and track applications.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html
        lang="en"
        className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
        suppressHydrationWarning
      >
        <body className="min-h-full flex flex-col" suppressHydrationWarning>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}

"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { UserButton, useUser } from "@clerk/nextjs";
import { APP_NAME } from "@/lib/constants";

const NAV = [
  { href: "/#how", label: "How it works" },
  { href: "/#features", label: "Features" },
  { href: "/#interview", label: "Interview Prep" },
  { href: "/salaries", label: "Salaries" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/#faq", label: "FAQ" },
];

// Marketing header (dark). Auth-aware: signed-out visitors get Log In / Get
// started; signed-in users get a Dashboard button + account menu (with sign out).
export function MarketingHeader() {
  const { isSignedIn } = useUser();

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="text-lg font-bold tracking-tight">
          <span className="text-gradient">{APP_NAME}</span>
        </Link>

        <nav className="ml-2 hidden items-center gap-1 lg:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {isSignedIn ? (
            <>
              <Link
                href="/dashboard"
                className="btn-cta inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm"
              >
                Dashboard
                <ArrowRight className="h-4 w-4" />
              </Link>
              <UserButton appearance={{ elements: { avatarBox: "h-8 w-8" } }} />
            </>
          ) : (
            <>
              <Link
                href="/sign-up"
                className="btn-cta inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm"
              >
                Get started
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/sign-in"
                className="rounded-full border border-primary/50 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-primary/10"
              >
                Log In
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

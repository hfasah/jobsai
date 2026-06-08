"use client";

import Link from "next/link";
import { useUser } from "@clerk/nextjs";

// Auth-aware CTA: a signed-in user goes to their dashboard; a signed-out user
// goes to the given auth page (sign-up / sign-in). Works as a client island
// inside server components.
export function AuthCta({
  href,
  className,
  children,
}: {
  href: string; // where a logged-out user should go (e.g. /sign-up or /sign-in)
  className?: string;
  children: React.ReactNode;
}) {
  const { isSignedIn } = useUser();
  return (
    <Link href={isSignedIn ? "/dashboard" : href} className={className}>
      {children}
    </Link>
  );
}

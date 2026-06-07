"use client";

import Link from "next/link";
import { SignOutButton } from "@clerk/nextjs";
import { ShieldCheck, Building2, LogOut } from "lucide-react";

// Friendly full-screen notice shown when an Admin or Enterprise account tries to
// use the job-seeker dashboard. Keeps the three account types strictly separate.
export function AccountTypeNotice({ role, email }: { role: "admin" | "enterprise"; email?: string }) {
  const isAdmin = role === "admin";
  const Icon = isAdmin ? ShieldCheck : Building2;
  const label = isAdmin ? "Admin" : "Enterprise";
  const portalHref = isAdmin ? "/admin" : "/enterprise/dashboard";
  const portalLabel = isAdmin ? "Go to Admin Portal" : "Go to Enterprise Workspace";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center text-foreground">
      <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${isAdmin ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
        <Icon className="h-7 w-7" />
      </div>
      <h1 className="mt-5 text-2xl font-bold tracking-tight">This is an {label} login</h1>
      <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
        {email ? <>The email <span className="font-medium text-foreground">{email}</span> is</> : "This email is"} registered as {isAdmin ? "a JobsAI Admin" : "an Enterprise"} account, so it can't be used for job search on the job board. Each email can belong to only one account type.
      </p>
      <p className="mx-auto mt-2 max-w-md text-xs text-muted-foreground">
        To use JobsAI as a job seeker, sign out and sign in with a different email.
      </p>

      <div className="mt-7 flex flex-col items-center gap-3 sm:flex-row">
        <Link href={portalHref} className="btn-cta inline-flex h-11 items-center justify-center rounded-xl px-6 text-sm font-semibold">
          {portalLabel}
        </Link>
        <SignOutButton redirectUrl="/sign-in">
          <button className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border px-6 text-sm font-medium transition-colors hover:bg-muted">
            <LogOut className="h-4 w-4" /> Sign in with a different account
          </button>
        </SignOutButton>
      </div>
    </div>
  );
}

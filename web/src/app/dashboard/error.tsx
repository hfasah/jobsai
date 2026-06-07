"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

// Friendly fallback for any unhandled render error inside the dashboard, so users
// see an in-app message + recovery instead of a blank/broken browser page.
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard error boundary:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-1 flex-col items-center justify-center px-4 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10">
        <AlertTriangle className="h-6 w-6 text-destructive" />
      </div>
      <h1 className="mt-4 text-xl font-bold tracking-tight">Something went wrong</h1>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        This page hit an unexpected error. Try again, or head back to your dashboard.
      </p>
      <div className="mt-5 flex items-center gap-2">
        <button onClick={reset} className="btn-cta inline-flex h-10 items-center rounded-xl px-5 text-sm">
          Try again
        </button>
        <Link href="/dashboard" className="inline-flex h-10 items-center rounded-xl border border-border px-5 text-sm font-medium hover:bg-muted">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}

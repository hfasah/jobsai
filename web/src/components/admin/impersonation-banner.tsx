"use client";

import { useAuth, useUser, useClerk } from "@clerk/nextjs";
import { useState } from "react";
import { ShieldAlert, Loader2 } from "lucide-react";

// Fixed banner shown whenever the current session is an admin impersonation
// (Clerk sets `actor` on the session when signed in via an actor token). Lets
// the admin exit back to their own account. Rendered app-wide from the root
// layout; renders nothing for normal sessions.
export function ImpersonationBanner() {
  const { isLoaded, actor } = useAuth();
  const { user } = useUser();
  const { signOut } = useClerk();
  const [exiting, setExiting] = useState(false);

  if (!isLoaded || !actor) return null;

  const who = user?.primaryEmailAddress?.emailAddress || user?.fullName || "this account";

  return (
    <div className="fixed inset-x-0 top-0 z-[100] flex items-center justify-center gap-3 bg-amber-500 px-4 py-2 text-sm font-medium text-amber-950 shadow-md">
      <ShieldAlert className="h-4 w-4 shrink-0" />
      <span className="truncate">
        Viewing as <strong>{who}</strong> — admin view
      </span>
      <button
        onClick={() => { setExiting(true); signOut({ redirectUrl: "/admin/users" }); }}
        disabled={exiting}
        className="ml-1 inline-flex items-center gap-1.5 rounded-md bg-amber-950/90 px-2.5 py-1 text-xs font-semibold text-amber-50 transition-colors hover:bg-amber-950 disabled:opacity-60"
      >
        {exiting ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
        Exit
      </button>
    </div>
  );
}

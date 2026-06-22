"use client";

import { useAuth, useUser, useClerk } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { ShieldAlert, Loader2 } from "lucide-react";

// Per-tab flag the handoff sets when an admin opens a user's account. We use it
// because the mirror now signs in via a Clerk sign-in token (uncapped), which
// carries no `actor` claim — so we can't rely on Clerk to mark the session as an
// impersonation. (Still honor `actor` too, in case actor tokens are used.)
export const IMPERSONATION_FLAG = "jobsai_imp";

// Fixed banner shown whenever the current session is an admin impersonation.
// Lets the admin exit back to their own account. Rendered app-wide from the root
// layout; renders nothing for normal sessions.
export function ImpersonationBanner() {
  const { isLoaded, actor } = useAuth();
  const { user } = useUser();
  const { signOut } = useClerk();
  const [exiting, setExiting] = useState(false);
  const [flag, setFlag] = useState(false);

  useEffect(() => {
    try { setFlag(sessionStorage.getItem(IMPERSONATION_FLAG) === "1"); } catch {}
  }, []);

  if (!isLoaded) return null;
  if (!actor && !flag) return null;

  const who = user?.primaryEmailAddress?.emailAddress || user?.fullName || "this account";

  const exit = () => {
    setExiting(true);
    try { sessionStorage.removeItem(IMPERSONATION_FLAG); } catch {}
    // Return to the unified admin portal (signs out the impersonated session;
    // the admin signs back in as themselves there).
    signOut({ redirectUrl: "https://app.jobsai.work/admin/users" });
  };

  return (
    <div className="fixed inset-x-0 top-0 z-[100] flex items-center justify-center gap-3 bg-amber-500 px-4 py-2 text-sm font-medium text-amber-950 shadow-md">
      <ShieldAlert className="h-4 w-4 shrink-0" />
      <span className="truncate">
        Viewing as <strong>{who}</strong> — admin view
      </span>
      <button
        onClick={exit}
        disabled={exiting}
        className="ml-1 inline-flex items-center gap-1.5 rounded-md bg-amber-950/90 px-2.5 py-1 text-xs font-semibold text-amber-50 transition-colors hover:bg-amber-950 disabled:opacity-60"
      >
        {exiting ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
        Exit
      </button>
    </div>
  );
}

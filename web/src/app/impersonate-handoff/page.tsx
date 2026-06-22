"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth, useClerk } from "@clerk/nextjs";
import { Loader2, ShieldAlert } from "lucide-react";

// Keys shared with the ImpersonationBanner.
const TICKET_KEY = "imp_ticket";   // the Clerk sign-in token to consume this run
const DEST_KEY = "imp_dest";       // where to land after sign-in
const SETFLAG_KEY = "imp_setflag"; // "1" → set the banner flag (impersonation-in)
const IMP_FLAG = "jobsai_imp";     // banner shows while this is set
const RETURN_KEY = "jobsai_return"; // admin return token, kept during impersonation

// Completes a Clerk sign-in via a one-time token, on jobsai.work, then redirects.
// Used both to ENTER a user's account (admin impersonation) and to RETURN to the
// admin as themselves on Exit. Single-session Clerk rejects a ticket sign-in
// while a session is active, so we sign out first, hard-reload, then complete.
export default function ImpersonateHandoff() {
  const { isLoaded, isSignedIn } = useAuth();
  const clerk = useClerk();
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (!isLoaded || ran.current) return;
    ran.current = true;

    const params = new URLSearchParams(window.location.search);
    const phase = params.get("phase");

    // First entry: capture params into sessionStorage (so the sign-out reload
    // keeps a clean URL). The return token (rt), if present, is stashed for the
    // eventual Exit and survives the impersonation session.
    if (phase !== "signedout") {
      const ticket = params.get("ticket");
      if (!ticket) { setError("Missing sign-in token."); return; }
      try {
        sessionStorage.setItem(TICKET_KEY, ticket);
        sessionStorage.setItem(DEST_KEY, params.get("dest") || "/dashboard");
        if (params.get("imp") === "1") sessionStorage.setItem(SETFLAG_KEY, "1");
        else sessionStorage.removeItem(SETFLAG_KEY);
        const rt = params.get("rt");
        if (rt) sessionStorage.setItem(RETURN_KEY, rt);
      } catch {}
    }

    // End any active session first (shared Clerk instance), then hard-reload.
    if (isSignedIn && phase !== "signedout") {
      const back = `${window.location.origin}/impersonate-handoff?phase=signedout`;
      clerk.signOut({ redirectUrl: back }).finally(() => { window.location.href = back; });
      return;
    }

    (async () => {
      let ticket: string | null = null;
      let dest = "/dashboard";
      let setFlag = false;
      try {
        ticket = sessionStorage.getItem(TICKET_KEY);
        dest = sessionStorage.getItem(DEST_KEY) || "/dashboard";
        setFlag = sessionStorage.getItem(SETFLAG_KEY) === "1";
      } catch {}
      if (!ticket) { setError("Missing sign-in token."); return; }
      try {
        const signIn = await clerk.client.signIn.create({ strategy: "ticket", ticket });
        if (signIn.status !== "complete" || !signIn.createdSessionId) {
          setError("Could not complete sign-in — the token may have expired (they last a few minutes).");
          return;
        }
        await clerk.setActive({ session: signIn.createdSessionId });
        try {
          sessionStorage.removeItem(TICKET_KEY);
          sessionStorage.removeItem(DEST_KEY);
          sessionStorage.removeItem(SETFLAG_KEY);
          if (setFlag) {
            sessionStorage.setItem(IMP_FLAG, "1");   // entering: show the banner
          } else {
            sessionStorage.removeItem(IMP_FLAG);     // returning: hide it
            sessionStorage.removeItem(RETURN_KEY);   // return token consumed
          }
        } catch {}
        window.location.replace(dest);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Sign-in failed.");
      }
    })();
  }, [isLoaded, isSignedIn, clerk]);

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      {error ? (
        <div className="max-w-sm text-center">
          <ShieldAlert className="mx-auto mb-3 h-8 w-8 text-red-500" />
          <p className="font-semibold">Couldn&apos;t open the account</p>
          <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          <a href="https://app.jobsai.work/admin/users" className="mt-4 inline-block text-sm text-primary hover:underline">
            Back to admin
          </a>
        </div>
      ) : (
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> One moment…
        </div>
      )}
    </div>
  );
}

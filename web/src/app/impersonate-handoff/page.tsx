"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth, useClerk } from "@clerk/nextjs";
import { Loader2, ShieldAlert } from "lucide-react";

const TICKET_KEY = "imp_ticket";

// Consumer-side landing for admin impersonation initiated from the enterprise
// admin portal (app.jobsai.work). The enterprise side mints a Clerk actor token
// (same Clerk instance) and redirects here with ?ticket=. We complete the
// sign-in as the impersonated user on jobsai.work so the admin lands in the real
// consumer dashboard (the app-wide ImpersonationBanner then shows, with Exit).
// Not under /admin, so the jobsai.work/admin → app.jobsai.work redirect doesn't
// catch it.
export default function ImpersonateHandoff() {
  const { isLoaded, isSignedIn } = useAuth();
  const clerk = useClerk();
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (!isLoaded || ran.current) return;
    ran.current = true;

    const params = new URLSearchParams(window.location.search);
    const phase = params.get("phase"); // undefined → start; "signedout" → after sign-out
    const urlTicket = params.get("ticket");
    if (urlTicket) {
      try { sessionStorage.setItem(TICKET_KEY, urlTicket); } catch {}
    }
    let ticket: string | null = null;
    try { ticket = sessionStorage.getItem(TICKET_KEY); } catch {}
    if (!ticket) { setError("Missing impersonation ticket."); return; }

    const complete = async (t: string) => {
      try {
        const signIn = await clerk.client.signIn.create({ strategy: "ticket", ticket: t });
        if (signIn.status !== "complete" || !signIn.createdSessionId) {
          setError("Could not complete sign-in — the ticket may have expired (they last 10 minutes).");
          return;
        }
        try { sessionStorage.removeItem(TICKET_KEY); } catch {}
        await clerk.setActive({ session: signIn.createdSessionId });
        // Mark this tab as an admin impersonation so the ImpersonationBanner
        // shows (sign-in tokens carry no Clerk `actor` claim).
        try { sessionStorage.setItem("jobsai_imp", "1"); } catch {}
        window.location.replace("/dashboard");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Impersonation failed.");
      }
    };

    // Single-session Clerk rejects a ticket sign-in while a session is active
    // ("you're already signed in"), and the admin's own session is active here
    // (shared Clerk instance). End that session first, then hard-reload back to
    // this page (ticket kept in sessionStorage) to complete the sign-in.
    if (isSignedIn && phase !== "signedout") {
      const back = `${window.location.origin}/impersonate-handoff?phase=signedout`;
      clerk.signOut({ redirectUrl: back }).finally(() => { window.location.href = back; });
      return;
    }

    complete(ticket);
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
          <Loader2 className="h-5 w-5 animate-spin" /> Opening account…
        </div>
      )}
    </div>
  );
}

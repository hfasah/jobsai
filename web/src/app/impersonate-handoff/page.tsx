"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth, useClerk } from "@clerk/nextjs";
import { Loader2, ShieldAlert } from "lucide-react";

// Consumer-side landing for admin impersonation initiated from the enterprise
// admin portal (app.jobsai.work). The enterprise side mints a Clerk actor token
// (same Clerk instance) and redirects here with ?ticket=. We complete the
// sign-in as the impersonated user on jobsai.work, so the admin lands in the
// real consumer dashboard (the app-wide ImpersonationBanner then shows, with an
// Exit action). Not under /admin, so the jobsai.work/admin → app.jobsai.work
// redirect doesn't catch it.
export default function ImpersonateHandoff() {
  const { isLoaded } = useAuth();
  const clerk = useClerk();
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (!isLoaded || ran.current) return;
    ran.current = true;

    const ticket = new URLSearchParams(window.location.search).get("ticket");
    if (!ticket) { setError("Missing impersonation ticket."); return; }

    (async () => {
      try {
        const signIn = await clerk.client.signIn.create({ strategy: "ticket", ticket });
        if (signIn.status !== "complete" || !signIn.createdSessionId) {
          setError("Could not complete sign-in — the ticket may have expired (they last 10 minutes).");
          return;
        }
        await clerk.setActive({ session: signIn.createdSessionId });
        window.location.replace("/dashboard");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Impersonation failed.");
      }
    })();
  }, [isLoaded, clerk]);

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

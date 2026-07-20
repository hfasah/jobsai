"use client";

import { use, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUser, useSignUp, useClerk } from "@clerk/nextjs";
import { CheckCircle2, Loader2, Users, KeyRound, LogOut } from "lucide-react";

export default function AcceptInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const ticket = searchParams.get("__clerk_ticket");

  const { isLoaded: userLoaded, isSignedIn, user } = useUser();
  const { signUp } = useSignUp();
  const { signOut } = useClerk();

  const [info, setInfo] = useState<{ email: string; role: string; org: { name: string } } | null>(null);
  const [error, setError] = useState("");
  const [accepting, setAccepting] = useState(false);
  const [done, setDone] = useState(false);

  // Password-creation form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [existingAccount, setExistingAccount] = useState(false);

  useEffect(() => {
    fetch(`/api/enterprise/invite/${token}`)
      .then((r) => r.json())
      .then((j) => { if (j.data) setInfo(j.data); else setError(j.error ?? "Invalid invitation."); });
  }, [token]);

  // Already signed in → accept directly (joins this workspace, no recreation).
  const accept = async () => {
    setAccepting(true); setError("");
    const res = await fetch(`/api/enterprise/invite/${token}`, { method: "POST" });
    if (res.status === 401) {
      window.location.href = `/enterprise-login?redirect_url=${encodeURIComponent(`/enterprise/invite/${token}`)}`;
      return;
    }
    const json = await res.json();
    if (!res.ok) { setError(json.error ?? "Failed to accept."); setAccepting(false); return; }
    setDone(true);
    setTimeout(() => router.push("/enterprise/dashboard"), 1500);
  };

  // First-time owner → create a password via the invitation ticket. The ticket
  // auto-verifies their email (no second email/code); on success they're signed
  // in and /launch joins them to this workspace via the pending invite.
  const createPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticket) return;
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirmPassword) { setError("Passwords don't match."); return; }
    setAccepting(true); setError(""); setExistingAccount(false);

    const { error } = await signUp.create({ strategy: "ticket", ticket, password, firstName, lastName });
    if (error) {
      const ce = error as unknown as { code?: string; longMessage?: string; message?: string };
      // Email already has an account → they should sign in instead.
      if (ce.code === "form_identifier_exists" || /already|exists/i.test(ce.message ?? "")) {
        setExistingAccount(true);
        setError("You already have an account with this email.");
      } else {
        setError(ce.longMessage ?? ce.message ?? "Couldn't create your password. Please try again.");
      }
      setAccepting(false);
      return;
    }

    if (signUp.status === "complete") {
      setDone(true);
      await signUp.finalize();      // sets the new session active
      window.location.href = "/launch"; // /launch joins them to this workspace
      return;
    }
    setError("Couldn't finish setting up your account. Please try again.");
    setAccepting(false);
  };

  const signInUrl = `/enterprise-login?redirect_url=${encodeURIComponent(`/enterprise/invite/${token}`)}`;

  if (done) return (
    <Shell>
      <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-green-400" />
      <p className="text-lg font-semibold">You&apos;re in! Taking you to your workspace…</p>
    </Shell>
  );

  // Wait for invite info + Clerk to load
  const loading = !info && !error;
  if (loading || !userLoaded) return (
    <Shell><Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" /></Shell>
  );

  if (error && !info) return (
    <Shell>
      <p className="text-sm text-destructive">{error}</p>
      <a href="/enterprise-login"
        className="mt-4 inline-flex items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">
        Sign in to your workspace
      </a>
    </Shell>
  );

  const inviteEmail = info!.email?.toLowerCase() ?? "";
  const emailMatches = !!isSignedIn && !!user?.emailAddresses?.some((e) => e.emailAddress.toLowerCase() === inviteEmail);
  const currentEmail = user?.primaryEmailAddress?.emailAddress ?? user?.emailAddresses?.[0]?.emailAddress ?? "";
  const wrongAccount = !!isSignedIn && !emailMatches;
  const showPasswordStep = !isSignedIn && !!ticket && !existingAccount;

  // Sign out, then reload this same URL (ticket preserved) so the owner can set
  // a password / sign in as the invited email.
  const switchAccount = async () => {
    setAccepting(true);
    await signOut({ redirectUrl: window.location.href });
  };

  return (
    <Shell>
      <h1 className="text-xl font-bold">You&apos;re invited to join</h1>
      <p className="mt-2 text-2xl font-bold text-primary">{info!.org.name}</p>
      <p className="mt-2 text-sm text-muted-foreground">
        As a <span className="font-semibold capitalize text-foreground">{info!.role}</span> on JobsAI Enterprise
      </p>

      {/* Signed in as the invited email → one-click accept */}
      {isSignedIn && emailMatches && (
        <>
          <button onClick={accept} disabled={accepting}
            className="btn-cta mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold disabled:opacity-60">
            {accepting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {accepting ? "Accepting…" : "Accept invitation"}
          </button>
          {error && <p className="mt-3 text-xs text-destructive">{error}</p>}
        </>
      )}

      {/* Signed in as the WRONG account → switch to the invited email */}
      {wrongAccount && (
        <>
          <p className="mt-5 text-sm text-muted-foreground">
            You&apos;re signed in as <span className="font-medium text-foreground">{currentEmail}</span>, but this invitation is for{" "}
            <span className="font-medium text-foreground">{inviteEmail}</span>.
          </p>
          <button onClick={switchAccount} disabled={accepting}
            className="btn-cta mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold disabled:opacity-60">
            {accepting ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
            {accepting ? "Switching…" : "Sign out & continue as " + inviteEmail}
          </button>
        </>
      )}

      {/* First-time owner → create a password right here (no second email) */}
      {showPasswordStep && (
        <form onSubmit={createPassword} className="mt-6 space-y-3 text-left">
          <p className="text-center text-sm text-muted-foreground">
            Create your password to finish setting up <span className="font-medium text-foreground">{info!.email}</span>.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name" autoComplete="given-name"
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name" autoComplete="family-name"
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Create a password (min 8 characters)"
            autoComplete="new-password" required minLength={8}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm password"
            autoComplete="new-password" required minLength={8}
            className={`w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary ${confirmPassword && password !== confirmPassword ? "border-destructive" : "border-border"}`} />
          {confirmPassword && password !== confirmPassword && (
            <p className="text-xs text-destructive">Passwords don&apos;t match.</p>
          )}
          {/* Clerk bot-protection mount point */}
          <div id="clerk-captcha" />
          <button type="submit" disabled={accepting || !password || password !== confirmPassword}
            className="btn-cta inline-flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold disabled:opacity-60">
            {accepting ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
            {accepting ? "Setting up…" : "Create password & enter workspace"}
          </button>
          {error && <p className="text-center text-xs text-destructive">{error}</p>}
        </form>
      )}

      {/* Existing account, or no ticket → send them to sign in */}
      {!isSignedIn && (existingAccount || !ticket) && (
        <>
          <a href={signInUrl}
            className="btn-cta mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold">
            <KeyRound className="h-4 w-4" /> Sign in to accept
          </a>
          {error && <p className="mt-3 text-xs text-muted-foreground">{error}</p>}
        </>
      )}

      <p className="mt-3 text-xs text-muted-foreground">Enterprise accounts use email sign-in only.</p>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-brand shadow-glow">
          <Users className="h-8 w-8 text-white" />
        </div>
        {children}
      </div>
    </div>
  );
}

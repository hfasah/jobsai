"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Users } from "lucide-react";

export default function AcceptInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const router = useRouter();
  const [info, setInfo] = useState<{ email: string; role: string; org: { name: string } } | null>(null);
  const [error, setError] = useState("");
  const [accepting, setAccepting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch(`/api/enterprise/invite/${token}`)
      .then((r) => r.json())
      .then((j) => { if (j.data) setInfo(j.data); else setError(j.error ?? "Invalid invitation."); });
  }, [token]);

  const accept = async () => {
    setAccepting(true);
    const res = await fetch(`/api/enterprise/invite/${token}`, { method: "POST" });
    const json = await res.json();
    if (!res.ok) { setError(json.error ?? "Failed to accept."); setAccepting(false); return; }
    setDone(true);
    setTimeout(() => router.push("/enterprise/dashboard"), 2000);
  };

  if (done) return (
    <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <div className="text-center">
        <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-green-400" />
        <p className="text-lg font-semibold">You're in! Redirecting…</p>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-brand shadow-glow">
          <Users className="h-8 w-8 text-white" />
        </div>
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : !info ? (
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
        ) : (
          <>
            <h1 className="text-xl font-bold">You're invited to join</h1>
            <p className="mt-2 text-2xl font-bold text-primary">{info.org.name}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              As a <span className="font-semibold capitalize text-foreground">{info.role}</span> on JobsAI Enterprise
            </p>
            <button onClick={accept} disabled={accepting}
              className="btn-cta mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold disabled:opacity-60">
              {accepting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {accepting ? "Accepting…" : "Accept invitation"}
            </button>
            <p className="mt-3 text-xs text-muted-foreground">You need to be signed in to accept. If not signed in, you'll be redirected after login.</p>
          </>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

// Lets a stuck recruiter leave a pending workspace and register a different
// company, instead of being trapped on the locked screen. Uses an inline
// confirmation (no jarring native browser dialog).
export function StartOverButton() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const startOver = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/enterprise/org/leave", { method: "POST" });
      if (!res.ok) {
        setError((await res.json().catch(() => ({}))).error ?? "Could not start over.");
        return;
      }
      router.push("/enterprise/onboard");
      router.refresh();
    } catch {
      setError("Could not start over.");
    } finally {
      setBusy(false);
    }
  };

  if (confirming) {
    return (
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-4 text-center">
        <p className="text-sm text-foreground">Leave this pending workspace and set up a different company?</p>
        <p className="mt-1 text-xs text-muted-foreground">This pending workspace will be removed. You can&apos;t undo this.</p>
        <div className="mt-3 flex justify-center gap-2">
          <button
            onClick={startOver}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Yes, start over
          </button>
          <button
            onClick={() => setConfirming(false)}
            disabled={busy}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted disabled:opacity-60"
          >
            Cancel
          </button>
        </div>
        {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        onClick={() => setConfirming(true)}
        className="text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        Register a different company
      </button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

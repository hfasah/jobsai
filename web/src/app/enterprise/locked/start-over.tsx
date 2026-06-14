"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

// Lets a stuck recruiter leave a pending workspace and register a different
// company, instead of being trapped on the locked screen.
export function StartOverButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const startOver = async () => {
    if (!confirm("Leave this pending workspace and set up a different company? This pending workspace will be removed.")) return;
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

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        onClick={startOver}
        disabled={busy}
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground disabled:opacity-60"
      >
        {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        Register a different company
      </button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

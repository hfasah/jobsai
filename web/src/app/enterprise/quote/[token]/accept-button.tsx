"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Loader2, ArrowRight } from "lucide-react";

export function AcceptButton({ token, accepted }: { token: string; accepted: boolean }) {
  const [done, setDone] = useState(accepted);
  const [loading, setLoading] = useState(false);

  // Once accepted, offer the next step — creating the workspace — but never
  // before the client has reviewed and accepted the quote.
  if (done) {
    return (
      <div className="space-y-2">
        <div className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500/10 px-6 py-3 text-sm font-semibold text-emerald-600">
          <Check className="h-4 w-4" /> Quote accepted — we&apos;ll be in touch
        </div>
        <Link
          href="/enterprise/onboard"
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-brand px-6 py-3 text-sm font-semibold text-white shadow-glow"
        >
          Create your workspace <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  const accept = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/enterprise/quote/${token}`, { method: "POST" });
      if (res.ok) setDone(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={accept}
      disabled={loading}
      className="inline-flex items-center gap-2 rounded-xl bg-gradient-brand px-6 py-3 text-sm font-semibold text-white shadow-glow disabled:opacity-60"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
      Accept this quote
    </button>
  );
}

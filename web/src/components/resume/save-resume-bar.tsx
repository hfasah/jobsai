"use client";

import { useState } from "react";
import Link from "next/link";
import { Save, Loader2, Check, Download, AlertCircle } from "lucide-react";
import type { TailoredJson } from "@/types/phase3";

// Saves an optimized resume (TailoredJson) as a new resume version, then links to
// the templated preview (which prints to PDF). Used by Builder + Optimizer.
export function SaveResumeBar({ tj, label }: { tj: TailoredJson; label: string }) {
  const [state, setState] = useState<"idle" | "saving" | "error">("idle");
  const [versionId, setVersionId] = useState<string | null>(null);

  async function save() {
    setState("saving");
    try {
      const res = await fetch("/api/resumes/save-version", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label,
          headline: tj.headline,
          summary: tj.summary,
          experience: tj.experience,
          skills: tj.skills,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      setVersionId(json.data.versionId);
      setState("idle");
    } catch {
      setState("error");
    }
  }

  if (versionId) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm">
        <span className="inline-flex items-center gap-1.5 font-medium text-emerald-400">
          <Check className="h-4 w-4" /> Saved to your resumes
        </span>
        <a
          href={`/dashboard/resumes/preview/${versionId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-cta inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs"
        >
          <Download className="h-3.5 w-3.5" /> Download PDF
        </a>
        <Link href="/dashboard/resumes" className="text-primary hover:underline">View in Resumes</Link>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        onClick={save}
        disabled={state === "saving"}
        className="inline-flex items-center gap-2 rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-70"
      >
        {state === "saving"
          ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
          : <><Save className="h-4 w-4" /> Save as resume version</>}
      </button>
      {state === "error" && (
        <span className="inline-flex items-center gap-1 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5" /> Couldn&apos;t save — try again.
        </span>
      )}
    </div>
  );
}

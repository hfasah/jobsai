"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Wand2, Loader2, ArrowLeft, ArrowRight, AlertCircle, Plus, ExternalLink } from "lucide-react";
import { TailoredOutput } from "@/components/resume/tailored-output";
import { SaveResumeBar } from "@/components/resume/save-resume-bar";
import type { TailoredJson, TailorChange } from "@/types/phase3";

type JobItem = { id: string; status: string; parsed: { title: string | null; company: string | null } | null };
type TailorResult = { headline: string; summary: string; tailored_json: TailoredJson; changes: TailorChange[] };

export default function ResumeOptimizerPage() {
  const [jobs, setJobs] = useState<JobItem[] | null>(null);
  const [jobId, setJobId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TailorResult | null>(null);
  const [detail, setDetail] = useState<"concise" | "expanded">("concise");

  useEffect(() => {
    let active = true;
    fetch("/api/jobs").then((r) => r.json())
      .then((j) => { if (active) setJobs((j.data ?? []).filter((x: JobItem) => x.status === "ready")); })
      .catch(() => { if (active) setJobs([]); });
    return () => { active = false; };
  }, []);

  async function optimize() {
    if (!jobId) { setError("Pick a job first."); return; }
    setLoading(true); setError(null); setResult(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}/tailor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ detail }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Optimize failed");
      setResult(json.data as TailorResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Optimize failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6">
      <Link href="/dashboard/resumes" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Resume tools
      </Link>

      <div className="mt-6 flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-brand text-white shadow-glow">
          <Wand2 className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Resume Optimizer</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Tailor your resume to a specific job — aligned keywords and impact bullets, drawn from your real experience.
          </p>
        </div>
      </div>

      {/* Job picker */}
      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        {jobs === null ? (
          <div className="flex h-11 items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading your jobs…</div>
        ) : jobs.length === 0 ? (
          <div className="flex flex-1 items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
            No ready jobs yet.
            <Link href="/dashboard/jobs/import" className="inline-flex items-center gap-1 text-primary hover:underline"><Plus className="h-4 w-4" /> Add a job</Link>
          </div>
        ) : (
          <>
            <select value={jobId} onChange={(e) => setJobId(e.target.value)} className="h-11 flex-1 rounded-xl border border-border bg-card px-3 text-sm outline-none">
              <option value="">Select a job to optimize for…</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>{j.parsed?.title ?? "Untitled role"}{j.parsed?.company ? ` — ${j.parsed.company}` : ""}</option>
              ))}
            </select>
            <button onClick={optimize} disabled={loading || !jobId} className="btn-cta inline-flex h-11 items-center justify-center gap-2 rounded-xl px-6 text-sm disabled:opacity-70">
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Optimizing…</> : <><Wand2 className="h-4 w-4" /> Optimize</>}
            </button>
          </>
        )}
      </div>

      {jobs && jobs.length > 0 && (
        <div className="mt-3">
          <span className="text-xs font-semibold text-foreground">Length</span>
          <div className="mt-1.5 grid grid-cols-2 gap-2 sm:max-w-md">
            {([
              { value: "concise", title: "Concise", hint: "~1 page" },
              { value: "expanded", title: "Expanded", hint: "~2 pages · more bullets/role" },
            ] as const).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setDetail(opt.value)}
                aria-pressed={detail === opt.value}
                className={`rounded-xl border px-3 py-2 text-left transition-colors ${
                  detail === opt.value
                    ? "border-primary bg-primary/10 ring-1 ring-primary"
                    : "border-border bg-card hover:bg-muted/50"
                }`}
              >
                <span className="block text-sm font-semibold text-foreground">{opt.title}</span>
                <span className="block text-[11px] text-muted-foreground">{opt.hint}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {result && (
        <div className="mt-8">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold tracking-tight">Optimized resume</h2>
            {jobId && (
              <Link href={`/dashboard/jobs/${jobId}/resume-preview`} className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
                Open full preview <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
          <div className="mb-6">
            <SaveResumeBar
              tj={result.tailored_json}
              label={(() => {
                const j = jobs?.find((x) => x.id === jobId);
                const t = j?.parsed?.title;
                return t ? `${t} — tailored` : "Tailored resume";
              })()}
            />
          </div>
          <TailoredOutput tj={result.tailored_json} changes={result.changes} />
          {jobId && (
            <Link href={`/dashboard/jobs/${jobId}`} className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
              Continue to this job — cover letter & apply <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      )}
    </main>
  );
}

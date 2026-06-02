"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Loader2, MapPin, Building2, Briefcase, RefreshCw, Trash2, ExternalLink,
  ClipboardList, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/layout/site-header";
import { MatchDetail } from "@/components/job/match-score";
import { JobTabs } from "@/components/job/job-tabs";
import type { Job } from "@/types/job";

export default function JobDetailPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = use(params);
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [rematching, setRematching] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [tracked, setTracked] = useState(false);

  const fetchJob = useCallback(async () => {
    const res = await fetch(`/api/jobs/${jobId}`);
    if (!res.ok) { setLoading(false); return; }
    const json = await res.json();
    setJob(json.data);
    setLoading(false);
    return json.data as Job;
  }, [jobId]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    fetchJob().then((j) => {
      if (j && (j.status === "processing" || j.status === "created")) {
        interval = setInterval(async () => {
          const updated = await fetchJob();
          if (updated && updated.status !== "processing" && updated.status !== "created") {
            if (interval) clearInterval(interval);
          }
        }, 3000);
      }
    });
    return () => { if (interval) clearInterval(interval); };
  }, [fetchJob]);

  const rematch = async () => {
    setRematching(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/match`, { method: "POST" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        alert(json.error ?? "Re-match failed.");
        return;
      }
      await fetchJob();
    } finally {
      setRematching(false);
    }
  };

  const track = async () => {
    setTracking(true);
    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_id: jobId }),
      });
      if (res.ok) setTracked(true);
      else {
        const json = await res.json().catch(() => ({}));
        alert(json.error ?? "Could not add to tracker.");
      }
    } finally {
      setTracking(false);
    }
  };

  const remove = async () => {
    if (!confirm("Delete this job?")) return;
    await fetch(`/api/jobs/${jobId}`, { method: "DELETE" });
    router.push("/dashboard/jobs");
  };

  if (loading) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        </main>
      </>
    );
  }

  if (!job) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
          <p className="text-muted-foreground">Job not found.</p>
          <Button className="mt-4" nativeButton={false} render={<Link href="/dashboard/jobs" />}>
            Back to jobs
          </Button>
        </main>
      </>
    );
  }

  const parsed = job.parsed;
  const processing = job.status === "processing" || job.status === "created";

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <Link
          href="/dashboard/jobs"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          All jobs
        </Link>

        {/* Header */}
        <div className="mt-4 flex items-start justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight">
              {parsed?.title ?? (processing ? "Parsing job…" : "Untitled role")}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              {parsed?.company && (
                <span className="flex items-center gap-1"><Building2 className="h-4 w-4" />{parsed.company}</span>
              )}
              {parsed?.location && (
                <span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{parsed.location}</span>
              )}
              {parsed?.seniority && (
                <span className="flex items-center gap-1 capitalize"><Briefcase className="h-4 w-4" />{parsed.seniority}</span>
              )}
            </div>
            {parsed?.compensation && (
              <p className="mt-1 text-sm font-medium text-green-600">{parsed.compensation}</p>
            )}
          </div>
          <div className="flex gap-2">
            {!processing && job.status === "ready" && (
              <Button variant="outline" size="sm" onClick={track} disabled={tracking || tracked}>
                {tracking ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : tracked ? (
                  <Check className="mr-2 h-4 w-4" />
                ) : (
                  <ClipboardList className="mr-2 h-4 w-4" />
                )}
                {tracked ? "Tracking" : "Track"}
              </Button>
            )}
            {!processing && (
              <Button variant="outline" size="sm" onClick={rematch} disabled={rematching}>
                {rematching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={remove} className="text-destructive">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {job.source_url && (
          <a
            href={job.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            View original posting
          </a>
        )}

        {/* Processing state */}
        {processing && (
          <div className="mt-8 rounded-xl border border-border bg-card p-6">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <div>
                <p className="font-medium">Analyzing job…</p>
                <p className="text-sm text-muted-foreground">
                  Parsing the description and scoring your match.
                </p>
              </div>
            </div>
          </div>
        )}

        {job.status === "failed" && (
          <div className="mt-8 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            <p className="font-medium">Processing failed</p>
            <p className="mt-1">{job.parse_error_msg ?? "Something went wrong."}</p>
          </div>
        )}

        {/* Tabbed surfaces: Overview / ATS / Tailor / Cover Letter */}
        {!processing && job.status === "ready" && (
          <JobTabs
            jobId={jobId}
            overview={
              <div className="space-y-8">
                {/* Match */}
                {job.match ? (
                  <section className="rounded-2xl border border-border bg-card p-6">
                    <h2 className="mb-4 font-display text-lg">Resume Match</h2>
                    <MatchDetail match={job.match} />
                  </section>
                ) : (
                  <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
                    <p className="font-medium">No match score yet.</p>
                    <p className="mt-1">Set a primary resume to see how well you match this job.</p>
                    <Button size="sm" className="mt-3" onClick={rematch} disabled={rematching}>
                      {rematching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                      Run match
                    </Button>
                  </div>
                )}

                {/* Parsed details */}
                {parsed && (
                  <section className="space-y-6">
                    {parsed.summary && (
                      <div>
                        <h3 className="mb-2 font-semibold">Summary</h3>
                        <p className="text-sm text-muted-foreground">{parsed.summary}</p>
                      </div>
                    )}
                    {parsed.skills?.length > 0 && (
                      <div>
                        <h3 className="mb-2 font-semibold">Skills</h3>
                        <div className="flex flex-wrap gap-1.5">
                          {parsed.skills.map((s, i) => (
                            <span key={i} className="rounded-full border border-border px-2.5 py-0.5 text-xs">{s}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {parsed.requirements?.length > 0 && (
                      <div>
                        <h3 className="mb-2 font-semibold">Requirements</h3>
                        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                          {parsed.requirements.map((r, i) => <li key={i}>{r}</li>)}
                        </ul>
                      </div>
                    )}
                    {parsed.responsibilities?.length > 0 && (
                      <div>
                        <h3 className="mb-2 font-semibold">Responsibilities</h3>
                        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                          {parsed.responsibilities.map((r, i) => <li key={i}>{r}</li>)}
                        </ul>
                      </div>
                    )}
                  </section>
                )}
              </div>
            }
          />
        )}
      </main>
    </>
  );
}

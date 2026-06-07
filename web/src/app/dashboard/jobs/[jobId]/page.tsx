"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Loader2, MapPin, Building2, Briefcase, RefreshCw, Trash2, ExternalLink,
  ClipboardList, Check, Send, AlertCircle, Copy, Mic, AudioLines, Video, Zap, Puzzle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MatchDetail } from "@/components/job/match-score";
import { ResumeUsedBadge } from "@/components/job/resume-used-badge";
import { JobTabs } from "@/components/job/job-tabs";
import type { TabKey } from "@/components/job/job-tabs";
import type { Job } from "@/types/job";
import { boardForUrl } from "@/lib/job-boards";
import { runExtensionApply } from "@/lib/extension-bridge";

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

  type ApplyState = "idle" | "applying" | "submitted" | "manual_required" | "failed" | "need_extension";
  const [applyState, setApplyState] = useState<ApplyState>("idle");
  const [applyMsg, setApplyMsg] = useState<string | null>(null);
  const [coverLetterBody, setCoverLetterBody] = useState<string | null>(null);
  const [copiedCover, setCopiedCover] = useState(false);
  const [tabOverride, setTabOverride] = useState<TabKey | undefined>(undefined);

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

  const applyNow = async () => {
    setApplyState("applying");
    setApplyMsg(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}/apply`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setApplyState("failed");
        setApplyMsg(json.error ?? "Apply failed.");
        return;
      }
      const status = json.data?.status;
      setApplyState(status === "submitted" ? "submitted" : status === "manual_required" ? "manual_required" : "failed");
      setApplyMsg(json.data?.message ?? null);
      if (status === "manual_required") {
        fetch(`/api/jobs/${jobId}/cover-letter`)
          .then((r) => r.json())
          .then((j) => { if (j.data?.body) setCoverLetterBody(j.data.body); })
          .catch(() => null);
      }
    } catch {
      setApplyState("failed");
      setApplyMsg("Network error. Please try again.");
    }
  };

  // Apply via the in-browser extension (LinkedIn/Indeed/ZipRecruiter/Dice/Workable).
  const applyViaExtension = (j: Job) => {
    const parsed = (Array.isArray(j.parsed) ? j.parsed[0] : j.parsed) as { title?: string; company?: string; posting_url?: string } | null;
    const url = j.posting_url || parsed?.posting_url || j.source_url || null;
    setApplyState("applying");
    setApplyMsg(null);
    runExtensionApply(
      [{ id: jobId, url, title: parsed?.title ?? "this job", company: parsed?.company ?? null }],
      {},
      (e) => {
        if (e.type === "unavailable") {
          setApplyState("need_extension");
        } else if (e.type === "progress") {
          if (e.status === "applying" || e.status === "queued") setApplyState("applying");
          else if (e.status === "applied") setApplyState("submitted");
          else if (e.status === "review") {
            setApplyState("manual_required");
            setApplyMsg("Autofilled on the board — review the fields and submit. Turn on 1-click for this board in the extension to auto-submit.");
            fetch(`/api/jobs/${jobId}/cover-letter`).then((r) => r.json()).then((jr) => { if (jr.data?.body) setCoverLetterBody(jr.data.body); }).catch(() => null);
          } else if (e.status === "failed") {
            setApplyState("failed");
            setApplyMsg("Couldn't complete the application on the board. Open the posting to apply manually.");
          }
        }
      }
    );
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

  // Board-aware apply: extension boards (LinkedIn/Indeed/…) apply in-browser via
  // the extension; ATS boards (Lever/Ashby/…) use the server apply agent.
  const applyUrl = job.posting_url || job.parsed?.posting_url || job.source_url || null;
  const applyBoard = boardForUrl(applyUrl);
  const useExtension = !!applyBoard.adapter && !!applyUrl;

  return (
    <>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
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
              {!processing && <ResumeUsedBadge jobId={jobId} />}
            </div>
            {parsed?.compensation && (
              <p className="mt-1 text-sm font-medium text-desyn-success">{parsed.compensation}</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {!processing && job.status === "ready" && applyState !== "submitted" && (
              <Button
                size="sm"
                variant={applyState === "manual_required" ? "outline" : "default"}
                onClick={
                  applyState === "manual_required" && applyUrl
                    ? () => window.open(applyUrl, "_blank")
                    : useExtension
                    ? () => applyViaExtension(job)
                    : applyNow
                }
                disabled={applyState === "applying"}
                className={applyState === "manual_required" ? "border-desyn-warning/40 text-desyn-warning hover:bg-desyn-warning/15" : ""}
              >
                {applyState === "applying" ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Applying…</>
                ) : applyState === "manual_required" ? (
                  <><AlertCircle className="mr-2 h-4 w-4" />Review &amp; submit</>
                ) : applyState === "failed" || applyState === "need_extension" ? (
                  <><Send className="mr-2 h-4 w-4" />Retry apply</>
                ) : useExtension ? (
                  <><Zap className="mr-2 h-4 w-4" />Apply on {applyBoard.label}</>
                ) : (
                  <><Send className="mr-2 h-4 w-4" />Apply</>
                )}
              </Button>
            )}
            {applyState === "submitted" && (
              <span className="flex items-center gap-1.5 rounded-lg bg-desyn-success/15 px-3 py-1.5 text-sm font-medium text-desyn-success">
                <Check className="h-4 w-4" />
                Applied
              </span>
            )}
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
            {!processing && job.status === "ready" && (
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={<Link href={`/dashboard/jobs/${jobId}/voice-interview`} />}
                title="AI Voice Interviewer — live spoken mock interview"
              >
                <AudioLines className="h-4 w-4" />
              </Button>
            )}
            {!processing && job.status === "ready" && (
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={<Link href={`/dashboard/jobs/${jobId}/avatar-interview`} />}
                title="AI Avatar Room — face-to-face video interview"
              >
                <Video className="h-4 w-4" />
              </Button>
            )}
            {!processing && job.status === "ready" && (
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={<Link href={`/dashboard/jobs/${jobId}/interview-buddy`} />}
                title="Interview Buddy — live coaching"
              >
                <Mic className="h-4 w-4" />
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={remove} className="text-destructive">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Needs the extension to apply on this board */}
        {applyState === "need_extension" && (
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-2.5 text-sm">
            <Puzzle className="h-4 w-4 shrink-0 text-amber-500" />
            <p className="flex-1 text-foreground">
              Applying on {applyBoard.label} runs in your browser via the JobsAI extension. Connecting is optional —
              you can also open the posting and apply manually.
            </p>
            <Link href="/dashboard/extension" className="btn-cta inline-flex h-8 items-center rounded-lg px-3 text-xs">Set up extension</Link>
            {applyUrl && (
              <button onClick={() => window.open(applyUrl, "_blank")} className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-3 text-xs text-muted-foreground hover:text-foreground">
                Open posting <ExternalLink className="h-3 w-3" />
              </button>
            )}
          </div>
        )}

        {/* Apply status messages */}
        {(applyState === "manual_required" || applyState === "failed") && (
          <div className={`mt-3 rounded-lg border px-4 py-2.5 text-sm ${
            applyState === "manual_required"
              ? "border-desyn-warning/30 bg-desyn-warning/15 text-desyn-warning"
              : "border-destructive/30 bg-destructive/5 text-destructive"
          }`}>
            <p>{applyMsg ?? (applyState === "manual_required" ? "This platform requires manual submission." : "Apply failed.")}</p>
            {applyState === "manual_required" && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {coverLetterBody && (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(coverLetterBody);
                      setCopiedCover(true);
                      setTimeout(() => setCopiedCover(false), 2000);
                    }}
                    className="inline-flex items-center gap-1.5 rounded border border-desyn-warning/40 bg-card px-2.5 py-1 text-xs font-medium text-desyn-warning hover:bg-desyn-warning/15 transition-colors"
                  >
                    {copiedCover ? <Check className="h-3 w-3 text-desyn-success" /> : <Copy className="h-3 w-3" />}
                    {copiedCover ? "Copied!" : "Copy cover letter"}
                  </button>
                )}
                <button
                  onClick={() => {
                    setTabOverride("cover");
                    document.getElementById("job-tabs")?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="inline-flex items-center gap-1.5 rounded border border-desyn-warning/40 bg-card px-2.5 py-1 text-xs font-medium text-desyn-warning hover:bg-desyn-warning/15 transition-colors"
                >
                  View cover letter ↓
                </button>
              </div>
            )}
          </div>
        )}

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
          <div id="job-tabs">
          <JobTabs
            jobId={jobId}
            activeTab={tabOverride}
            companyName={parsed?.company ?? undefined}
            overview={
              <div className="space-y-8">
                {/* Match */}
                {job.match ? (
                  <section className="rounded-2xl border border-border bg-card p-6">
                    <h2 className="mb-4 font-display text-lg">Resume Match</h2>
                    <MatchDetail match={job.match} />
                  </section>
                ) : (
                  <div className="rounded-xl border border-desyn-warning/30 bg-desyn-warning/15 p-4 text-sm text-desyn-warning">
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
          </div>
        )}
      </main>
    </>
  );
}

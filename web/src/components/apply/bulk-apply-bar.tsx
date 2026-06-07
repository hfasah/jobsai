"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Zap, X, ChevronDown, Loader2, CheckCircle2, AlertTriangle, Puzzle,
} from "lucide-react";
import { LINKEDIN_EXTENSION_ID } from "@/lib/constants";
import { boardForUrl } from "@/lib/job-boards";

export interface BulkJob {
  id: string;
  title: string;
  company: string | null;
  url: string | null;
}

type JobStatus = "queued" | "applying" | "applied" | "review" | "failed";

// Minimal typed view of the chrome extension bridge available on the page.
type ChromePort = {
  postMessage: (m: unknown) => void;
  onMessage: { addListener: (cb: (m: unknown) => void) => void };
  onDisconnect: { addListener: (cb: () => void) => void };
};
type ChromeRuntime = {
  connect?: (id: string, info?: { name?: string }) => ChromePort;
  sendMessage?: (id: string, msg: unknown, cb: (r?: unknown) => void) => void;
  lastError?: unknown;
};
function getChrome(): { runtime?: ChromeRuntime } | undefined {
  return (window as unknown as { chrome?: { runtime?: ChromeRuntime } }).chrome;
}

interface ResumeDoc { id: string; label: string; is_primary?: boolean }

export function BulkApplyBar({ jobs, onClear }: { jobs: BulkJob[]; onClear: () => void }) {
  const [resumes, setResumes] = useState<ResumeDoc[]>([]);
  const [resumeId, setResumeId] = useState<string>("");
  const [running, setRunning] = useState(false);
  const [notInstalled, setNotInstalled] = useState(false);
  const [progress, setProgress] = useState<Record<string, JobStatus>>({});
  const portRef = useRef<ChromePort | null>(null);

  // Load resumes for the "apply as" selector.
  useEffect(() => {
    let active = true;
    fetch("/api/resumes")
      .then((r) => r.json())
      .then((j) => {
        if (!active) return;
        const docs: ResumeDoc[] = (j.data ?? []).map((d: ResumeDoc) => ({ id: d.id, label: d.label, is_primary: d.is_primary }));
        setResumes(docs);
        const primary = docs.find((d) => d.is_primary) ?? docs[0];
        if (primary) setResumeId(primary.id);
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const counts = useMemo(() => {
    const v = Object.values(progress);
    return {
      applied: v.filter((s) => s === "applied").length,
      review: v.filter((s) => s === "review").length,
      failed: v.filter((s) => s === "failed").length,
      done: v.filter((s) => s === "applied" || s === "review" || s === "failed").length,
    };
  }, [progress]);

  const directCount = useMemo(
    () => jobs.filter((j) => boardForUrl(j.url).applyMode === "direct").length,
    [jobs]
  );

  function applyAll() {
    const chrome = getChrome();
    if (!chrome?.runtime?.connect) { setNotInstalled(true); return; }

    let port: ChromePort;
    try {
      port = chrome.runtime.connect(LINKEDIN_EXTENSION_ID, { name: "jobsai-bulk-apply" });
    } catch {
      setNotInstalled(true);
      return;
    }
    portRef.current = port;

    const initial: Record<string, JobStatus> = {};
    jobs.forEach((j) => { initial[j.id] = "queued"; });
    setProgress(initial);
    setRunning(true);
    setNotInstalled(false);

    let acked = false;
    port.onMessage.addListener((raw) => {
      const msg = raw as { type?: string; jobId?: string; status?: JobStatus };
      if (msg.type === "ACK") acked = true;
      if (msg.type === "PROGRESS" && msg.jobId && msg.status) {
        setProgress((p) => ({ ...p, [msg.jobId!]: msg.status! }));
      }
      if (msg.type === "DONE") setRunning(false);
    });
    port.onDisconnect.addListener(() => {
      // If we never got an ACK, the extension isn't installed/reachable.
      if (!acked) { setNotInstalled(true); setRunning(false); setProgress({}); }
      else setRunning(false);
    });

    port.postMessage({
      type: "BULK_APPLY",
      apiBase: window.location.origin,
      resumeId,
      resumeLabel: resumes.find((r) => r.id === resumeId)?.label ?? null,
      jobs: jobs.map((j) => ({ id: j.id, url: j.url, title: j.title, company: j.company })),
    });
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur md:left-60">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-2 px-4 py-3 sm:px-6">
        {/* Optional-connection nudge — never blocks, always dismissible. */}
        {notInstalled && (
          <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
            <Puzzle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <div className="flex-1">
              <p className="font-medium text-foreground">Connect the JobsAI extension to Apply-to-All</p>
              <p className="text-xs text-muted-foreground">
                It applies in your own browser using your board logins. Optional — you can also open each job and apply manually.
              </p>
            </div>
            <Link href="/dashboard/extension" className="btn-cta inline-flex h-8 shrink-0 items-center rounded-lg px-3 text-xs">
              Set up
            </Link>
            <button onClick={() => setNotInstalled(false)} className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Progress summary while running / after finishing */}
        {Object.keys(progress).length > 0 && (
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5 text-desyn-success"><CheckCircle2 className="h-3.5 w-3.5" /> {counts.applied} applied</span>
            {counts.review > 0 && <span className="flex items-center gap-1.5 text-amber-500"><AlertTriangle className="h-3.5 w-3.5" /> {counts.review} need review</span>}
            {counts.failed > 0 && <span className="flex items-center gap-1.5 text-destructive"><X className="h-3.5 w-3.5" /> {counts.failed} failed</span>}
            <span className="text-muted-foreground">{counts.done}/{jobs.length}</span>
          </div>
        )}

        <div className="flex items-center gap-3">
          <button onClick={onClear} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
            <span className="tabular-nums">{jobs.length}</span> selected
            <X className="h-3.5 w-3.5" />
          </button>

          <span className="hidden text-xs text-muted-foreground sm:inline">
            {directCount === jobs.length
              ? "All direct-apply"
              : `${directCount} direct · ${jobs.length - directCount} assisted/manual`}
          </span>

          {/* Apply as (resume) */}
          <div className="relative ml-auto">
            <select
              value={resumeId}
              onChange={(e) => setResumeId(e.target.value)}
              disabled={running}
              className="h-9 appearance-none rounded-lg border border-border bg-background py-1.5 pl-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60"
            >
              {resumes.length === 0 ? (
                <option value="">No resume</option>
              ) : (
                resumes.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)
              )}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          </div>

          <button
            onClick={applyAll}
            disabled={running || jobs.length === 0}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#f5c518] px-4 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {running ? <><Loader2 className="h-4 w-4 animate-spin" /> Applying…</> : <><Zap className="h-4 w-4" /> Apply to All</>}
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  MessageSquareText, Mic, Video, Briefcase, Loader2, Plus, ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface JobItem {
  id: string;
  status: string;
  parsed: { title: string | null; company: string | null } | null;
}

type Mode = "written" | "voice" | "avatar";

const MODES: { key: Mode; label: string; icon: React.ElementType; blurb: string }[] = [
  { key: "written", label: "Written Coach", icon: MessageSquareText, blurb: "Typed Q&A with instant scoring" },
  { key: "voice", label: "Voice Interviewer", icon: Mic, blurb: "Spoken mock interview" },
  { key: "avatar", label: "Avatar Room", icon: Video, blurb: "Face-to-face video round" },
];

function hrefFor(jobId: string, mode: Mode) {
  if (mode === "voice") return `/dashboard/jobs/${jobId}/voice-interview`;
  if (mode === "avatar") return `/dashboard/jobs/${jobId}/avatar-interview`;
  return `/dashboard/jobs/${jobId}`; // written coach lives on the job's Mock tab
}

export default function InterviewLauncher() {
  const search = useSearchParams();
  const selected = (search.get("mode") as Mode) ?? null;

  const [jobs, setJobs] = useState<JobItem[] | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/jobs")
      .then((r) => r.json())
      .then((j) => { if (active) setJobs((j.data ?? []).filter((x: JobItem) => x.status === "ready")); })
      .catch(() => { if (active) setJobs([]); });
    return () => { active = false; };
  }, []);

  const heading = selected ? MODES.find((m) => m.key === selected)?.label ?? "Interview Prep" : "Interview Prep";

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight">{heading}</h1>
      <p className="mt-2 text-muted-foreground">
        Pick a job to practice for. We build the interview from your resume and that exact role.
      </p>

      {/* mode switch */}
      <div className="mt-6 flex flex-wrap gap-2">
        {MODES.map((m) => {
          const Icon = m.icon;
          const on = selected === m.key;
          return (
            <Link
              key={m.key}
              href={`/dashboard/interview?mode=${m.key}`}
              className={cn(
                "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                on ? "bg-gradient-brand text-white shadow-glow" : "border border-border text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" /> {m.label}
            </Link>
          );
        })}
      </div>

      {/* jobs */}
      <div className="mt-8">
        {jobs === null ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading your jobs…
          </div>
        ) : jobs.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-8 text-center">
            <Briefcase className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 font-medium">No ready jobs yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Add a job and we&apos;ll tailor interview practice to it.</p>
            <Link href="/dashboard/jobs/import" className="btn-cta mt-5 inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm">
              <Plus className="h-4 w-4" /> Add a job
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => (
              <div key={job.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{job.parsed?.title ?? "Untitled role"}</p>
                  <p className="truncate text-sm text-muted-foreground">{job.parsed?.company ?? "—"}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {MODES.map((m) => {
                    const Icon = m.icon;
                    const emphasize = selected === m.key;
                    return (
                      <Link
                        key={m.key}
                        href={hrefFor(job.id, m.key)}
                        title={m.blurb}
                        className={cn(
                          "flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                          emphasize
                            ? "bg-gradient-brand text-white shadow-glow"
                            : "border border-border text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        <span className="hidden sm:inline">{m.label.split(" ")[0]}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
            <Link href="/dashboard/jobs" className="inline-flex items-center gap-1.5 pt-2 text-sm text-primary hover:underline">
              See all jobs <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}

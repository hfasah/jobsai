"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { CheckCircle2, Clock, XCircle, Loader2, Briefcase, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

const STAGES = ["applied", "screening", "interview", "offer", "hired"] as const;
type Stage = typeof STAGES[number];

const STAGE_ICONS: Record<string, React.ReactNode> = {
  applied:   <Clock className="h-5 w-5" />,
  screening: <Clock className="h-5 w-5" />,
  interview: <CheckCircle2 className="h-5 w-5" />,
  offer:     <CheckCircle2 className="h-5 w-5" />,
  hired:     <CheckCircle2 className="h-5 w-5" />,
  rejected:  <XCircle className="h-5 w-5" />,
};

type StatusData = {
  candidate_name: string;
  job_title: string;
  org_name: string;
  org_logo: string | null;
  show_powered_by: boolean;
  stage: string;
  stage_label: string;
  stage_message: string;
  applied_at: string;
  stage_updated_at: string;
};

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export default function CandidateStatusPage() {
  const { token } = useParams<{ token: string }>();
  const [status, setStatus] = useState<StatusData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/candidate/status/${token}`)
      .then(r => r.json())
      .then(j => {
        if (j.error) setError(j.error);
        else setStatus(j.data);
      })
      .catch(() => setError("Failed to load application status."));
  }, [token]);

  if (!status && !error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="text-center">
          <XCircle className="mx-auto mb-4 h-12 w-12 text-destructive" />
          <h1 className="text-xl font-semibold">Application not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">This link may have expired or the application was removed.</p>
        </div>
      </div>
    );
  }

  const d = status!;
  const isRejected = d.stage === "rejected";
  const isHired = d.stage === "hired";
  const activeIdx = isRejected ? -1 : STAGES.indexOf(d.stage as Stage);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="mx-auto max-w-lg px-4 py-12">
        {/* Org header */}
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          {d.org_logo ? (
            <Image src={d.org_logo} alt={d.org_name} width={56} height={56} className="rounded-xl object-contain" />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
              <Building2 className="h-7 w-7 text-primary" />
            </div>
          )}
          <div>
            <p className="text-sm text-muted-foreground">{d.org_name}</p>
            <h1 className="text-xl font-bold">{d.job_title}</h1>
          </div>
        </div>

        {/* Status card */}
        <div className={cn(
          "mb-6 rounded-2xl border p-6 text-center",
          isHired     ? "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30" :
          isRejected  ? "border-border bg-card" :
                        "border-primary/20 bg-primary/5",
        )}>
          <div className={cn(
            "mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full",
            isHired    ? "bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400" :
            isRejected ? "bg-muted text-muted-foreground" :
                         "bg-primary/10 text-primary",
          )}>
            {STAGE_ICONS[d.stage] ?? <Clock className="h-5 w-5" />}
          </div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Current Status</p>
          <h2 className="mt-1 text-2xl font-bold">{d.stage_label}</h2>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{d.stage_message}</p>
          <p className="mt-3 text-xs text-muted-foreground">Last updated {fmt(d.stage_updated_at)}</p>
        </div>

        {/* Progress timeline (not shown for rejected) */}
        {!isRejected && (
          <div className="mb-6 rounded-2xl border bg-card p-5">
            <h3 className="mb-4 text-sm font-semibold text-foreground">Your Progress</h3>
            <ol className="space-y-0">
              {STAGES.map((s, i) => {
                const done = i < activeIdx;
                const active = i === activeIdx;
                const upcoming = i > activeIdx;
                return (
                  <li key={s} className="flex items-start gap-3">
                    <div className="flex flex-col items-center">
                      <div className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold",
                        done   ? "border-primary bg-primary text-primary-foreground" :
                        active ? "border-primary bg-background text-primary" :
                                 "border-border bg-background text-muted-foreground",
                      )}>
                        {done ? "✓" : i + 1}
                      </div>
                      {i < STAGES.length - 1 && (
                        <div className={cn("mt-0.5 w-0.5 flex-1 min-h-[20px]", done ? "bg-primary" : "bg-border")} />
                      )}
                    </div>
                    <p className={cn(
                      "pt-1 pb-3 text-sm",
                      active   ? "font-semibold text-foreground" :
                      done     ? "text-foreground" :
                                 "text-muted-foreground",
                    )}>
                      {s === "applied"   ? "Application Received" :
                       s === "screening" ? "Under Review" :
                       s === "interview" ? "Interview" :
                       s === "offer"     ? "Offer" :
                                          "Hired"}
                    </p>
                  </li>
                );
              })}
            </ol>
          </div>
        )}

        {/* Application info */}
        <div className="rounded-2xl border bg-card px-5 py-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Briefcase className="h-4 w-4 shrink-0" />
            <span>Applied for <strong className="text-foreground">{d.job_title}</strong> on {fmt(d.applied_at)}</span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground pl-6">Hi {d.candidate_name} — this page is private to you.</p>
        </div>

        {d.show_powered_by && (
          <p className="mt-8 text-center text-xs text-muted-foreground">
            Powered by{" "}
            <a href="https://jobsai.work" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              JobsAI.Work
            </a>
          </p>
        )}
      </div>
    </div>
  );
}

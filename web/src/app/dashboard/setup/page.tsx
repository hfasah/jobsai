"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, FileText, SlidersHorizontal, IdCard, CheckCircle2, Circle, ArrowRight, Search, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface Status { has_resume: boolean; has_preferences: boolean; has_profile: boolean }
interface ResumeDoc { id: string; label: string }

export default function SetupPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [resumes, setResumes] = useState<ResumeDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/onboard/status").then((r) => r.json()).catch(() => null),
      fetch("/api/resumes").then((r) => r.json()).catch(() => null),
    ]).then(([st, rs]) => {
      if (!active) return;
      if (st) setStatus({ has_resume: !!st.has_resume, has_preferences: !!st.has_preferences, has_profile: !!st.has_profile });
      if (rs?.data) setResumes((rs.data as { id: string; label?: string }[]).map((d) => ({ id: d.id, label: d.label ?? "Résumé" })));
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  if (loading) return <div className="flex h-64 items-center justify-center text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…</div>;

  const s = status ?? { has_resume: false, has_preferences: false, has_profile: false };
  const doneCount = [s.has_resume, s.has_preferences, s.has_profile].filter(Boolean).length;
  const allDone = doneCount === 3;

  const steps = [
    {
      done: s.has_resume,
      icon: FileText,
      title: "Résumés",
      href: "/dashboard/resumes",
      cta: s.has_resume ? "Manage résumés" : "Upload a résumé",
      desc: "Upload and name a résumé for each role you target — e.g. HPC Engineer, DevOps Admin, Cloud Engineer, Linux Admin, System Admin. We tailor the right one per job.",
      extra: resumes.length > 0 ? `${resumes.length} résumé${resumes.length > 1 ? "s" : ""}: ${resumes.slice(0, 4).map((r) => r.label).join(", ")}${resumes.length > 4 ? "…" : ""}` : null,
    },
    {
      done: s.has_preferences,
      icon: SlidersHorizontal,
      title: "Job Preferences",
      href: "/dashboard/preferences",
      cta: s.has_preferences ? "Edit preferences" : "Set preferences",
      desc: "Target titles, locations, salary floor, employment type and your auto-apply rules. This drives job discovery and matching.",
      extra: null,
    },
    {
      done: s.has_profile,
      icon: IdCard,
      title: "Apply Profile",
      href: "/dashboard/apply-profile",
      cta: s.has_profile ? "Edit apply profile" : "Complete apply profile",
      desc: "Personal info, work authorization / permit, sponsorship, relocation, driver's licence, references and EEO — used to auto-fill applications.",
      extra: null,
    },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-6 py-2">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Set Up Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Finish these three to start applying. You can <Link href="/dashboard/job-search" className="text-primary hover:underline">search jobs</Link> anytime — but you&apos;ll need at least one résumé and your details before you apply.
        </p>
      </div>

      {/* Progress */}
      <div className={cn("rounded-2xl border p-5", allDone ? "border-desyn-success/30 bg-desyn-success/5" : "border-primary/30 bg-primary/5")}>
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">{allDone ? "You're all set! 🎉" : `${doneCount} of 3 complete`}</p>
          <span className="text-xs text-muted-foreground">{allDone ? "Ready to apply" : "Complete to unlock applying"}</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
          <div className={cn("h-full rounded-full transition-all", allDone ? "bg-desyn-success" : "bg-gradient-brand")} style={{ width: `${(doneCount / 3) * 100}%` }} />
        </div>
        {allDone && (
          <Link href="/dashboard/job-search" className="btn-cta mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold">
            <Search className="h-4 w-4" /> Find &amp; apply to jobs <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </div>

      {/* Steps */}
      <div className="space-y-3">
        {steps.map((step) => {
          const Icon = step.icon;
          return (
            <Link key={step.title} href={step.href}
              className="block rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40">
              <div className="flex items-start gap-4">
                <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", step.done ? "bg-desyn-success/15 text-desyn-success" : "bg-primary/10 text-primary")}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold">{step.title}</h2>
                    {step.done
                      ? <span className="inline-flex items-center gap-1 text-xs font-medium text-desyn-success"><CheckCircle2 className="h-3.5 w-3.5" /> Done</span>
                      : <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground"><Circle className="h-3.5 w-3.5" /> To do</span>}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{step.desc}</p>
                  {step.extra && <p className="mt-1.5 text-xs font-medium text-foreground">{step.extra}</p>}
                  <span className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary">
                    {step.cta} <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5" /> Tip: name each résumé by role so JobsAI applies with the best fit for every job.
      </p>
    </div>
  );
}

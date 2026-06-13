"use client";

import { useState } from "react";
import Link from "next/link";

// Transparent estimate: recruiter automation (4 hrs/wk saved @ $50/hr) +
// faster screening/scheduling per open job. 5 recruiters × 20 jobs ≈ $78k/yr.
function savings(recruiters: number, jobsPerMonth: number): number {
  return recruiters * 10_400 + jobsPerMonth * 1_300;
}

function Field({ label, value, set, min, max }: { label: string; value: number; set: (n: number) => void; min: number; max: number }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">{label}</label>
        <span className="text-sm font-bold text-primary">{value}</span>
      </div>
      <input type="range" min={min} max={max} value={value} onChange={(e) => set(parseInt(e.target.value))} className="mt-2 w-full accent-[var(--primary,#2563eb)]" />
    </div>
  );
}

export function RoiCalculator() {
  const [recruiters, setRecruiters] = useState(5);
  const [jobs, setJobs] = useState(20);
  const annual = savings(recruiters, jobs);

  return (
    <div className="grid items-center gap-8 rounded-2xl border border-border bg-card p-8 md:grid-cols-2">
      <div className="space-y-5">
        <Field label="Recruiters" value={recruiters} set={setRecruiters} min={1} max={50} />
        <Field label="Open jobs per month" value={jobs} set={setJobs} min={1} max={200} />
        <p className="text-xs text-muted-foreground">Estimate based on automating sourcing, screening, and scheduling across your team.</p>
      </div>
      <div className="rounded-xl bg-gradient-brand p-6 text-center text-white">
        <p className="text-sm font-medium text-white/80">Estimated annual savings</p>
        <p className="mt-1 text-4xl font-bold">${annual.toLocaleString()}</p>
        <p className="mt-1 text-xs text-white/70">per year with JobsAI Enterprise</p>
        <Link href="/enterprise-login" className="mt-4 inline-flex items-center justify-center rounded-lg bg-white px-5 py-2 text-sm font-semibold text-primary">Start free trial</Link>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, MapPin, Briefcase } from "lucide-react";

interface JobInfo {
  id: string; title: string; department: string | null;
  location: string | null; employment_type: string;
  description: string | null; responsibilities: string | null;
  qualifications: string | null; salary_min: number | null;
  salary_max: number | null; salary_currency: string;
}

export default function ApplyForm({ job, orgName }: { job: JobInfo; orgName: string }) {
  const [form, setForm] = useState({ candidate_name: "", candidate_email: "", candidate_phone: "", linkedin_url: "", portfolio_url: "", cover_letter: "" });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.candidate_name.trim() || !form.candidate_email.trim()) { setError("Name and email are required."); return; }
    setSubmitting(true); setError("");
    try {
      const res = await fetch(`/api/enterprise/jobs/${job.id}/applications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, source: "direct" }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Submission failed. Please try again."); return; }
      setDone(true);
    } finally { setSubmitting(false); }
  };

  if (done) return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center text-foreground">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-500/15 mb-6">
        <CheckCircle2 className="h-10 w-10 text-green-400" />
      </div>
      <h1 className="text-2xl font-bold">Application submitted!</h1>
      <p className="mt-3 max-w-md text-muted-foreground">
        Thank you for applying to <strong>{job.title}</strong> at {orgName}. We&apos;ll review your application and be in touch soon.
      </p>
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Job header */}
      <div className="border-b border-border bg-card px-4 py-8 text-center sm:px-6">
        <p className="text-sm font-semibold text-primary">{orgName}</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">{job.title}</h1>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-3 text-sm text-muted-foreground">
          {job.location && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{job.location}</span>}
          <span className="flex items-center gap-1 capitalize"><Briefcase className="h-3.5 w-3.5" />{job.employment_type}</span>
          {job.salary_min && job.salary_max && (
            <span>${job.salary_min.toLocaleString()}–${job.salary_max.toLocaleString()} {job.salary_currency}</span>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-5">
          {/* Job details */}
          <div className="lg:col-span-2 space-y-4">
            {job.description && (
              <div>
                <h3 className="mb-2 font-semibold">About the role</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{job.description}</p>
              </div>
            )}
            {job.responsibilities && (
              <div>
                <h3 className="mb-2 font-semibold">Responsibilities</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{job.responsibilities}</p>
              </div>
            )}
            {job.qualifications && (
              <div>
                <h3 className="mb-2 font-semibold">Requirements</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{job.qualifications}</p>
              </div>
            )}
          </div>

          {/* Application form */}
          <div className="lg:col-span-3">
            <form onSubmit={submit} className="rounded-2xl border border-border bg-card p-6 space-y-4">
              <h2 className="font-semibold text-lg">Apply for this role</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Full name *</label>
                  <input required value={form.candidate_name} onChange={(e) => set("candidate_name", e.target.value)}
                    placeholder="Jane Smith"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Email *</label>
                  <input required type="email" value={form.candidate_email} onChange={(e) => set("candidate_email", e.target.value)}
                    placeholder="jane@example.com"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">Phone</label>
                  <input type="tel" value={form.candidate_phone} onChange={(e) => set("candidate_phone", e.target.value)}
                    placeholder="+1 555 000 0000"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium">LinkedIn URL</label>
                  <input value={form.linkedin_url} onChange={(e) => set("linkedin_url", e.target.value)}
                    placeholder="https://linkedin.com/in/…"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Portfolio / website</label>
                <input value={form.portfolio_url} onChange={(e) => set("portfolio_url", e.target.value)}
                  placeholder="https://…"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Cover letter</label>
                <textarea value={form.cover_letter} onChange={(e) => set("cover_letter", e.target.value)}
                  rows={5} placeholder="Tell us why you're a great fit…"
                  className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground" />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <button type="submit" disabled={submitting}
                className="btn-cta flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold disabled:opacity-60">
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {submitting ? "Submitting…" : "Submit application"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

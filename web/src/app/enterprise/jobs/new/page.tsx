"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Sparkles, Loader2, Save, ArrowLeft, CheckCircle2, Globe } from "lucide-react";

const EMPLOYMENT_TYPES = ["full-time", "part-time", "contract", "internship"];
const DEPARTMENTS = ["Engineering", "Product", "Design", "Marketing", "Sales", "Operations", "Finance", "HR", "Legal", "Customer Success", "Other"];

export default function NewJobPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    title: "", department: "", location: "", employment_type: "full-time",
    description: "", responsibilities: "", qualifications: "", nice_to_have: "",
    salary_min: "", salary_max: "", extra_context: "", status: "draft",
  });
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  // Step 1: Create stub job first so we have an ID for the JD generator
  const ensureJobId = async (): Promise<string | null> => {
    if (jobId) return jobId;
    if (!form.title.trim()) { setError("Enter a job title first."); return null; }
    const res = await fetch("/api/enterprise/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: form.title, department: form.department, location: form.location, employment_type: form.employment_type, status: "draft" }),
    });
    const json = await res.json();
    if (!res.ok) { setError(json.error ?? "Failed to create job."); return null; }
    setJobId(json.data.id);
    return json.data.id;
  };

  const generateJD = async () => {
    if (!form.title.trim()) { setError("Enter a job title to generate a description."); return; }
    setGenerating(true);
    setError("");
    try {
      const id = await ensureJobId();
      if (!id) return;
      const res = await fetch(`/api/enterprise/jobs/${id}/generate-jd`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: form.title, department: form.department, location: form.location, employment_type: form.employment_type, extra_context: form.extra_context }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Generation failed."); return; }
      const d = json.data;
      setForm((f) => ({
        ...f,
        description: d.description ?? f.description,
        responsibilities: d.responsibilities ?? f.responsibilities,
        qualifications: d.qualifications ?? f.qualifications,
        nice_to_have: d.nice_to_have ?? f.nice_to_have,
      }));
    } finally {
      setGenerating(false);
    }
  };

  const save = async (publish = false) => {
    if (!form.title.trim()) { setError("Job title is required."); return; }
    setSaving(true);
    setError("");
    try {
      const id = await ensureJobId();
      if (!id) return;
      const res = await fetch(`/api/enterprise/jobs/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          salary_min: form.salary_min ? Number(form.salary_min) : null,
          salary_max: form.salary_max ? Number(form.salary_max) : null,
          status: publish ? "active" : "draft",
        }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Save failed."); return; }
      router.push(`/enterprise/jobs/${id}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="flex-1 overflow-y-auto px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.back()} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Post a new job</h1>
            <p className="text-sm text-muted-foreground">Fill in the basics, then use AI to generate the full description.</p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Basic info */}
          <section className="rounded-2xl border border-border bg-card p-6">
            <h2 className="mb-4 font-semibold">Job details</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-sm font-medium">Job title *</label>
                <input value={form.title} onChange={(e) => set("title", e.target.value)}
                  placeholder="e.g. Senior DevOps Engineer"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Department</label>
                <select value={form.department} onChange={(e) => set("department", e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                  <option value="">Select…</option>
                  {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Employment type</label>
                <select value={form.employment_type} onChange={(e) => set("employment_type", e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                  {EMPLOYMENT_TYPES.map((t) => <option key={t} value={t} className="capitalize">{t}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Location</label>
                <input value={form.location} onChange={(e) => set("location", e.target.value)}
                  placeholder="Toronto, ON · Remote"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Salary range</label>
                <div className="flex items-center gap-2">
                  <input value={form.salary_min} onChange={(e) => set("salary_min", e.target.value)}
                    placeholder="Min" type="number"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                  <span className="text-muted-foreground">–</span>
                  <input value={form.salary_max} onChange={(e) => set("salary_max", e.target.value)}
                    placeholder="Max" type="number"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
              </div>
            </div>
          </section>

          {/* AI JD Generator */}
          <section className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-semibold">Job description</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Write manually or generate with AI in one click.</p>
              </div>
              <button onClick={generateJD} disabled={generating || !form.title.trim()}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-brand px-4 py-2 text-sm font-semibold text-white shadow-glow transition-opacity hover:opacity-90 disabled:opacity-50">
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {generating ? "Generating…" : "Generate with AI"}
              </button>
            </div>

            <div className="mb-3">
              <label className="mb-1.5 block text-sm font-medium text-muted-foreground">Extra context for AI (optional)</label>
              <input value={form.extra_context} onChange={(e) => set("extra_context", e.target.value)}
                placeholder="e.g. Uses AWS, Terraform, Kubernetes. Canadian bank environment."
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>

            {generating && (
              <div className="mb-3 flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-primary">
                <Sparkles className="h-4 w-4 animate-pulse" />
                Generating full job description with AI…
              </div>
            )}

            <div className="space-y-4">
              {[
                { key: "description", label: "Overview", rows: 4, placeholder: "Compelling 2-3 paragraph overview of the role…" },
                { key: "responsibilities", label: "Responsibilities", rows: 6, placeholder: "• Lead infrastructure design and deployment…" },
                { key: "qualifications", label: "Required qualifications", rows: 5, placeholder: "• 5+ years of DevOps experience…" },
                { key: "nice_to_have", label: "Nice to have", rows: 3, placeholder: "• Experience with FinTech environments…" },
              ].map(({ key, label, rows, placeholder }) => (
                <div key={key}>
                  <label className="mb-1.5 block text-sm font-medium">{label}</label>
                  <textarea value={form[key as keyof typeof form]} onChange={(e) => set(key, e.target.value)}
                    rows={rows} placeholder={placeholder}
                    className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground" />
                </div>
              ))}
            </div>
          </section>

          {error && <p className="text-sm text-destructive">{error}</p>}

          {/* Actions */}
          <div className="pb-6">
            <div className="flex items-center gap-3">
              <button onClick={() => save(false)} disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-5 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50 transition-colors">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save draft
              </button>
              <button onClick={() => save(true)} disabled={saving}
                className="btn-cta inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-60">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Publish job
              </button>
            </div>
            <p className="mt-2.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Globe className="h-3.5 w-3.5" />
              Publishing distributes this role to Google for Jobs and every job board connected on the <Link href="/enterprise/boards" className="text-primary hover:underline">Job Boards</Link> page.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

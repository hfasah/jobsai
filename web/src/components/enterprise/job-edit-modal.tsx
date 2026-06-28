"use client";

import { useState } from "react";
import { Loader2, X } from "lucide-react";
import type { EnterpriseJob } from "@/types/enterprise";
import { SALARY_CURRENCIES, SALARY_PERIODS } from "@/types/enterprise";

const EMPLOYMENT_TYPES = ["full-time", "part-time", "contract", "internship"];

// Edit a job's details (works for drafts before publishing and for live jobs).
// Location carries the work mode too, e.g. "Remote, Canada" / "Toronto · Hybrid".
export function JobEditModal({ job, onClose, onSaved }: {
  job: EnterpriseJob;
  onClose: () => void;
  onSaved: (patch: Partial<EnterpriseJob>) => void;
}) {
  const [form, setForm] = useState({
    title: job.title ?? "",
    department: job.department ?? "",
    location: job.location ?? "",
    employment_type: job.employment_type ?? "full-time",
    salary_min: job.salary_min?.toString() ?? "",
    salary_max: job.salary_max?.toString() ?? "",
    salary_currency: job.salary_currency ?? "USD",
    salary_period: job.salary_period ?? "year",
    description: job.description ?? "",
    responsibilities: job.responsibilities ?? "",
    qualifications: job.qualifications ?? "",
    nice_to_have: job.nice_to_have ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.title.trim()) { setError("Title is required."); return; }
    setSaving(true);
    setError(null);
    const payload = {
      title: form.title.trim(),
      department: form.department.trim() || null,
      location: form.location.trim() || null,
      employment_type: form.employment_type,
      salary_min: form.salary_min.trim() ? Number(form.salary_min) : null,
      salary_max: form.salary_max.trim() ? Number(form.salary_max) : null,
      salary_currency: form.salary_currency,
      salary_period: form.salary_period,
      description: form.description.trim() || null,
      responsibilities: form.responsibilities.trim() || null,
      qualifications: form.qualifications.trim() || null,
      nice_to_have: form.nice_to_have.trim() || null,
    };
    const res = await fetch(`/api/enterprise/jobs/${job.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    setSaving(false);
    if (res.ok) { onSaved(payload as Partial<EnterpriseJob>); onClose(); }
    else setError(json.error ?? "Couldn't save the job.");
  };

  const input = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="my-8 w-full max-w-2xl rounded-2xl border border-border bg-card p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Edit job</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"><X className="h-4 w-4" /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Title</label>
            <input value={form.title} onChange={(e) => set("title", e.target.value)} className={input} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Department</label>
              <input value={form.department} onChange={(e) => set("department", e.target.value)} className={input} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Employment type</label>
              <select value={form.employment_type} onChange={(e) => set("employment_type", e.target.value)} className={input}>
                {EMPLOYMENT_TYPES.map((t) => <option key={t} value={t} className="capitalize">{t}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Location <span className="font-normal text-muted-foreground">(include work mode, e.g. “Toronto · Hybrid” or “Remote, Canada”)</span></label>
            <input value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="Toronto, ON · Remote" className={input} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Salary min</label>
              <input value={form.salary_min} onChange={(e) => set("salary_min", e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" placeholder="90000" className={input} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Salary max</label>
              <input value={form.salary_max} onChange={(e) => set("salary_max", e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" placeholder="120000" className={input} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Currency</label>
              <select value={form.salary_currency} onChange={(e) => set("salary_currency", e.target.value)} className={input}>
                {SALARY_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Pay period</label>
              <select value={form.salary_period} onChange={(e) => set("salary_period", e.target.value)} className={input}>
                {SALARY_PERIODS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Overview</label>
            <textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={4} className={input} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Responsibilities</label>
            <textarea value={form.responsibilities} onChange={(e) => set("responsibilities", e.target.value)} rows={4} className={input} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Required criteria</label>
            <textarea value={form.qualifications} onChange={(e) => set("qualifications", e.target.value)} rows={4} className={input} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Nice to have</label>
            <textarea value={form.nice_to_have} onChange={(e) => set("nice_to_have", e.target.value)} rows={3} className={input} />
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted">Cancel</button>
          <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save changes
          </button>
        </div>
      </div>
    </div>
  );
}

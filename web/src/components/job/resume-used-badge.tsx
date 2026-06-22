"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, ChevronDown, Check, Loader2 } from "lucide-react";

type Resume = { versionId: string; label: string };

// Shows — and lets the user switch — the resume this job uses for tailoring,
// ATS scans, cover letters, and auto-apply. The choice is pinned to the job
// (jobs.resume_version_id); clearing it falls back to the best-match auto-pick.
export function ResumeUsedBadge({ jobId }: { jobId: string }) {
  const [current, setCurrent] = useState<Resume | null>(null);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/jobs/${jobId}/resume-pick`)
      .then((r) => r.json())
      .then((j) => {
        if (!active) return;
        if (j.data) setCurrent(j.data);
        if (Array.isArray(j.resumes)) setResumes(j.resumes);
      })
      .catch(() => {});
    return () => { active = false; };
  }, [jobId]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const choose = async (r: Resume) => {
    setOpen(false);
    if (r.versionId === current?.versionId) return;
    const prev = current;
    setCurrent(r);
    setSaving(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/resume-pick`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionId: r.versionId }),
      });
      if (!res.ok) setCurrent(prev); // revert on failure
    } catch {
      setCurrent(prev);
    } finally {
      setSaving(false);
    }
  };

  if (!current && resumes.length === 0) return null;
  const switchable = resumes.length > 1;

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => switchable && setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/15 disabled:cursor-default"
        disabled={!switchable}
        title={switchable ? "Choose the resume used for this job" : "Resume used for this job"}
      >
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
        Using: {current?.label ?? "Select resume"}
        {switchable && <ChevronDown className="h-3 w-3" />}
      </button>
      {open && (
        <div className="absolute left-0 z-20 mt-1 max-h-72 w-72 overflow-auto rounded-xl border border-border bg-card p-1 shadow-lg">
          <p className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Use resume for this job</p>
          {resumes.map((r) => (
            <button
              key={r.versionId}
              onClick={() => choose(r)}
              className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-muted"
            >
              <span className="truncate">{r.label}</span>
              {r.versionId === current?.versionId && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

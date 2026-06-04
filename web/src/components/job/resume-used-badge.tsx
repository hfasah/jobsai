"use client";

import { useEffect, useState } from "react";
import { FileText } from "lucide-react";

// Shows which role-targeted resume auto-apply will use for this job.
export function ResumeUsedBadge({ jobId }: { jobId: string }) {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/jobs/${jobId}/resume-pick`)
      .then((r) => r.json())
      .then((j) => { if (active && j.data?.label) setLabel(j.data.label); })
      .catch(() => {});
    return () => { active = false; };
  }, [jobId]);

  if (!label) return null;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
      title="Auto-apply and tailoring will use this resume for this job"
    >
      <FileText className="h-3.5 w-3.5" /> Using: {label}
    </span>
  );
}

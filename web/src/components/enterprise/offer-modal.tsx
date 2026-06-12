"use client";

import { useState } from "react";
import { X, Loader2, Sparkles, FileText } from "lucide-react";

type Offer = {
  id: string;
  candidate_name: string;
  candidate_email: string;
  job_title: string;
  salary: string | null;
  start_date: string | null;
  content: string;
  notes: string | null;
  status: string;
  job_id: string | null;
  application_id: string | null;
};

interface Props {
  offer?: Offer | null;
  defaultCandidateName?: string;
  defaultCandidateEmail?: string;
  defaultJobTitle?: string;
  jobId?: string | null;
  applicationId?: string | null;
  onClose: () => void;
  onSaved: (offer: Offer) => void;
}

export default function OfferModal({
  offer,
  defaultCandidateName = "",
  defaultCandidateEmail = "",
  defaultJobTitle = "",
  jobId = null,
  applicationId = null,
  onClose,
  onSaved,
}: Props) {
  const isEdit = !!offer;

  const [candidateName, setCandidateName] = useState(offer?.candidate_name ?? defaultCandidateName);
  const [candidateEmail, setCandidateEmail] = useState(offer?.candidate_email ?? defaultCandidateEmail);
  const [jobTitle, setJobTitle] = useState(offer?.job_title ?? defaultJobTitle);
  const [salary, setSalary] = useState(offer?.salary ?? "");
  const [startDate, setStartDate] = useState(offer?.start_date ?? "");
  const [content, setContent] = useState(offer?.content ?? "");
  const [notes, setNotes] = useState(offer?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  const generateContent = async () => {
    if (!candidateName.trim() || !jobTitle.trim()) {
      setError("Fill in candidate name and job title first.");
      return;
    }
    setGenerating(true);
    setError("");
    const res = await fetch("/api/enterprise/offers/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        candidate_name: candidateName,
        job_title: jobTitle,
        salary: salary || undefined,
        start_date: startDate || undefined,
        notes: notes || undefined,
      }),
    });
    const j = await res.json();
    if (j.content) {
      setContent(j.content);
    } else {
      setError(j.error ?? "Generation failed.");
    }
    setGenerating(false);
  };

  const handleSave = async () => {
    if (!candidateName.trim() || !candidateEmail.trim() || !jobTitle.trim()) {
      setError("Candidate name, email, and job title are required.");
      return;
    }
    setSaving(true);
    setError("");

    let res: Response;
    if (isEdit) {
      res = await fetch(`/api/enterprise/offers/${offer.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, salary, start_date: startDate, notes }),
      });
    } else {
      res = await fetch("/api/enterprise/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidate_name: candidateName,
          candidate_email: candidateEmail,
          job_title: jobTitle,
          salary: salary || undefined,
          start_date: startDate || undefined,
          content: content || undefined,
          notes: notes || undefined,
          job_id: jobId,
          application_id: applicationId,
          generate: !content,
        }),
      });
    }

    const j = await res.json();
    if (res.ok) {
      onSaved(j.data);
    } else {
      setError(j.error ?? "Failed to save.");
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2.5">
            <FileText className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">{isEdit ? "Edit Offer Letter" : "New Offer Letter"}</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-xs">Candidate Name *</label>
              <input
                value={candidateName}
                onChange={(e) => setCandidateName(e.target.value)}
                disabled={isEdit}
                className="input-field mt-1"
                placeholder="Jane Smith"
              />
            </div>
            <div>
              <label className="label-xs">Candidate Email *</label>
              <input
                type="email"
                value={candidateEmail}
                onChange={(e) => setCandidateEmail(e.target.value)}
                disabled={isEdit}
                className="input-field mt-1"
                placeholder="jane@example.com"
              />
            </div>
          </div>

          <div>
            <label className="label-xs">Job Title *</label>
            <input
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              disabled={isEdit}
              className="input-field mt-1"
              placeholder="Senior Software Engineer"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-xs">Compensation</label>
              <input
                value={salary}
                onChange={(e) => setSalary(e.target.value)}
                className="input-field mt-1"
                placeholder="$120,000 / year"
              />
            </div>
            <div>
              <label className="label-xs">Start Date</label>
              <input
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="input-field mt-1"
                placeholder="July 1, 2026"
              />
            </div>
          </div>

          <div>
            <label className="label-xs">Internal Notes</label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input-field mt-1"
              placeholder="Context for AI generation (not shown to candidate)"
            />
          </div>

          {/* Content */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="label-xs">Offer Letter Content (HTML)</label>
              <button
                onClick={generateContent}
                disabled={generating}
                className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary hover:bg-primary/20 disabled:opacity-60"
              >
                {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                {generating ? "Generating…" : "AI Generate"}
              </button>
            </div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={10}
              className="input-field mt-0 resize-y font-mono text-xs"
              placeholder="Leave blank to auto-generate with AI, or paste/write HTML here…"
            />
            {content && (
              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">Preview rendered letter</summary>
                <div
                  className="mt-2 rounded-xl border border-border bg-background/50 p-4 text-sm leading-relaxed prose prose-sm max-w-none dark:prose-invert"
                  dangerouslySetInnerHTML={{ __html: content }}
                />
              </details>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-4">
          <button onClick={onClose} className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-cta inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isEdit ? "Save Changes" : "Create Offer"}
          </button>
        </div>
      </div>
    </div>
  );
}

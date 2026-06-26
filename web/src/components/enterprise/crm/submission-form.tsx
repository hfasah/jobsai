"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { SUBMISSION_STATUSES, type CrmSubmission } from "@/lib/crm-shared";
import { SlideOver, Field, TextInput, TextArea, Select, inputCls } from "./crm-ui";

// Submit a candidate to a client. Used from company, contact, and job-order
// detail. `companyId` is fixed; `jobOrders` are this company's open orders.
export function SubmissionForm({
  open, onClose, submission, companyId, jobOrders, defaultJobOrderId, defaultContactId, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  submission?: CrmSubmission | null;
  companyId: string;
  jobOrders: { id: string; title: string }[];
  defaultJobOrderId?: string;
  defaultContactId?: string;
  onSaved: (s: CrmSubmission) => void;
}) {
  const editing = !!submission;
  const [form, setForm] = useState({
    candidate_name: submission?.candidate_name ?? "",
    candidate_email: submission?.candidate_email ?? "",
    candidate_phone: submission?.candidate_phone ?? "",
    job_order_id: submission?.job_order_id ?? defaultJobOrderId ?? "",
    status: submission?.status ?? "submitted",
    resume_url: submission?.resume_url ?? "",
    notes: submission?.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.candidate_name.trim()) { setError("Candidate name is required."); return; }
    setSaving(true); setError("");
    const payload = { ...form, company_id: companyId, job_order_id: form.job_order_id || null, contact_id: submission?.contact_id ?? defaultContactId ?? null };
    const res = await fetch(
      editing ? `/api/enterprise/crm/submissions/${submission!.id}` : "/api/enterprise/crm/submissions",
      { method: editing ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
    );
    const json = await res.json();
    setSaving(false);
    if (!res.ok) { setError(json.error ?? "Could not save."); return; }
    onSaved(json.data);
    onClose();
  };

  return (
    <SlideOver open={open} onClose={onClose} title={editing ? "Edit submission" : "Submit candidate"}
      footer={
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-xl border border-border py-2 text-sm font-medium hover:bg-muted">Cancel</button>
          <button onClick={save} disabled={saving} className="btn-cta flex-1 rounded-xl py-2 text-sm font-semibold disabled:opacity-60">
            {saving ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : editing ? "Save changes" : "Submit"}
          </button>
        </div>
      }>
      <Field label="Candidate name" required><TextInput value={form.candidate_name} onChange={(e) => set("candidate_name", e.target.value)} autoFocus /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Email"><TextInput type="email" value={form.candidate_email} onChange={(e) => set("candidate_email", e.target.value)} /></Field>
        <Field label="Phone"><TextInput value={form.candidate_phone} onChange={(e) => set("candidate_phone", e.target.value)} /></Field>
      </div>
      <Field label="Job order">
        <select value={form.job_order_id} onChange={(e) => set("job_order_id", e.target.value)} className={inputCls}>
          <option value="">— No specific order —</option>
          {jobOrders.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Status"><Select value={form.status} onChange={(e) => set("status", e.target.value)} options={SUBMISSION_STATUSES} /></Field>
        <Field label="Resume URL"><TextInput value={form.resume_url} onChange={(e) => set("resume_url", e.target.value)} placeholder="https://…" /></Field>
      </div>
      <Field label="Notes"><TextArea value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Why this candidate fits…" /></Field>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </SlideOver>
  );
}

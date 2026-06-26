"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { JOB_TYPES, JOB_ORDER_STATUSES, PRIORITIES, WORK_MODES, type CrmJobOrder } from "@/lib/crm-shared";
import { SlideOver, Field, TextInput, TextArea, Select, inputCls } from "./crm-ui";

const toDateInput = (v: string | null | undefined) => (v ? new Date(v).toISOString().slice(0, 10) : "");
const numStr = (v: number | null | undefined) => (v != null ? String(v) : "");

export function JobOrderForm({
  open, onClose, jobOrder, companies, defaultCompanyId, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  jobOrder?: CrmJobOrder | null;
  companies: { id: string; name: string }[];
  defaultCompanyId?: string;
  onSaved: (j: CrmJobOrder) => void;
}) {
  const editing = !!jobOrder;
  const [form, setForm] = useState({
    title: jobOrder?.title ?? "",
    company_id: jobOrder?.company_id ?? defaultCompanyId ?? "",
    job_type: jobOrder?.job_type ?? "permanent",
    status: jobOrder?.status ?? "intake",
    priority: jobOrder?.priority ?? "medium",
    openings: jobOrder?.openings != null ? String(jobOrder.openings) : "1",
    location: jobOrder?.location ?? "",
    work_mode: jobOrder?.work_mode ?? "onsite",
    salary_min: numStr(jobOrder?.salary_min),
    salary_max: numStr(jobOrder?.salary_max),
    pay_rate: numStr(jobOrder?.pay_rate),
    bill_rate: numStr(jobOrder?.bill_rate),
    fee_pct: numStr(jobOrder?.fee_pct),
    markup: numStr(jobOrder?.markup),
    placement_value: numStr(jobOrder?.placement_value),
    expected_close_at: toDateInput(jobOrder?.expected_close_at),
    description: jobOrder?.description ?? "",
    internal_notes: jobOrder?.internal_notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.title.trim()) { setError("Job title is required."); return; }
    if (!form.company_id) { setError("Select a client company."); return; }
    setSaving(true); setError("");
    const payload = {
      ...form,
      openings: form.openings === "" ? 1 : Number(form.openings),
      expected_close_at: form.expected_close_at ? new Date(form.expected_close_at).toISOString() : null,
    };
    const res = await fetch(
      editing ? `/api/enterprise/crm/job-orders/${jobOrder!.id}` : "/api/enterprise/crm/job-orders",
      { method: editing ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
    );
    const json = await res.json();
    setSaving(false);
    if (!res.ok) { setError(json.error ?? "Could not save."); return; }
    onSaved(json.data);
    onClose();
  };

  return (
    <SlideOver open={open} onClose={onClose} title={editing ? "Edit job order" : "New job order"}
      footer={
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-xl border border-border py-2 text-sm font-medium hover:bg-muted">Cancel</button>
          <button onClick={save} disabled={saving} className="btn-cta flex-1 rounded-xl py-2 text-sm font-semibold disabled:opacity-60">
            {saving ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : editing ? "Save changes" : "Add job order"}
          </button>
        </div>
      }>
      <Field label="Job title" required><TextInput value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Senior Backend Engineer" autoFocus /></Field>
      <Field label="Client company" required>
        <select value={form.company_id} onChange={(e) => set("company_id", e.target.value)} className={inputCls}>
          <option value="">— Select company —</option>
          {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Job type"><Select value={form.job_type} onChange={(e) => set("job_type", e.target.value)} options={JOB_TYPES} /></Field>
        <Field label="Status"><Select value={form.status} onChange={(e) => set("status", e.target.value)} options={JOB_ORDER_STATUSES} /></Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Priority"><Select value={form.priority} onChange={(e) => set("priority", e.target.value)} options={PRIORITIES} /></Field>
        <Field label="Openings"><TextInput type="number" min={1} value={form.openings} onChange={(e) => set("openings", e.target.value)} /></Field>
        <Field label="Work mode"><Select value={form.work_mode} onChange={(e) => set("work_mode", e.target.value)} options={WORK_MODES} /></Field>
      </div>
      <Field label="Location"><TextInput value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="Remote · US" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Salary min ($)"><TextInput type="number" value={form.salary_min} onChange={(e) => set("salary_min", e.target.value)} /></Field>
        <Field label="Salary max ($)"><TextInput type="number" value={form.salary_max} onChange={(e) => set("salary_max", e.target.value)} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Pay rate ($/hr)"><TextInput type="number" value={form.pay_rate} onChange={(e) => set("pay_rate", e.target.value)} /></Field>
        <Field label="Bill rate ($/hr)"><TextInput type="number" value={form.bill_rate} onChange={(e) => set("bill_rate", e.target.value)} /></Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Fee %"><TextInput type="number" value={form.fee_pct} onChange={(e) => set("fee_pct", e.target.value)} placeholder="20" /></Field>
        <Field label="Markup %"><TextInput type="number" value={form.markup} onChange={(e) => set("markup", e.target.value)} /></Field>
        <Field label="Placement value ($)"><TextInput type="number" value={form.placement_value} onChange={(e) => set("placement_value", e.target.value)} placeholder="30000" /></Field>
      </div>
      <Field label="Expected close"><TextInput type="date" value={form.expected_close_at} onChange={(e) => set("expected_close_at", e.target.value)} /></Field>
      <Field label="Description"><TextArea value={form.description} onChange={(e) => set("description", e.target.value)} /></Field>
      <Field label="Internal notes"><TextArea value={form.internal_notes} onChange={(e) => set("internal_notes", e.target.value)} /></Field>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </SlideOver>
  );
}

"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { COMPANY_STATUSES, type CrmCompany } from "@/lib/enterprise-crm";
import { SlideOver, Field, TextInput, TextArea, Select } from "./crm-ui";

const toDateInput = (v: string | null | undefined) => (v ? new Date(v).toISOString().slice(0, 10) : "");

// Create or edit a client company. Pass `company` to edit; omit to create.
export function CompanyForm({
  open, onClose, company, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  company?: CrmCompany | null;
  onSaved: (c: CrmCompany) => void;
}) {
  const editing = !!company;
  const [form, setForm] = useState({
    name: company?.name ?? "",
    status: company?.status ?? "prospect",
    industry: company?.industry ?? "",
    website: company?.website ?? "",
    location: company?.location ?? "",
    size: company?.size ?? "",
    source: company?.source ?? "",
    tags: (company?.tags ?? []).join(", "),
    next_follow_up_at: toDateInput(company?.next_follow_up_at),
    notes: company?.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.name.trim()) { setError("Company name is required."); return; }
    setSaving(true); setError("");
    const payload = {
      ...form,
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      next_follow_up_at: form.next_follow_up_at ? new Date(form.next_follow_up_at).toISOString() : null,
    };
    const res = await fetch(
      editing ? `/api/enterprise/crm/companies/${company!.id}` : "/api/enterprise/crm/companies",
      { method: editing ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
    );
    const json = await res.json();
    setSaving(false);
    if (!res.ok) { setError(json.error ?? "Could not save."); return; }
    onSaved(json.data);
    onClose();
  };

  return (
    <SlideOver open={open} onClose={onClose} title={editing ? "Edit company" : "New company"}
      footer={
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-xl border border-border py-2 text-sm font-medium hover:bg-muted">Cancel</button>
          <button onClick={save} disabled={saving} className="btn-cta flex-1 rounded-xl py-2 text-sm font-semibold disabled:opacity-60">
            {saving ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : editing ? "Save changes" : "Add company"}
          </button>
        </div>
      }>
      <Field label="Company name" required>
        <TextInput value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Acme Staffing" autoFocus />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Status"><Select value={form.status} onChange={(e) => set("status", e.target.value)} options={COMPANY_STATUSES} /></Field>
        <Field label="Industry"><TextInput value={form.industry} onChange={(e) => set("industry", e.target.value)} placeholder="SaaS" /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Website"><TextInput value={form.website} onChange={(e) => set("website", e.target.value)} placeholder="acme.com" /></Field>
        <Field label="Location"><TextInput value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="Austin, TX" /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Company size"><TextInput value={form.size} onChange={(e) => set("size", e.target.value)} placeholder="51–200" /></Field>
        <Field label="Source"><TextInput value={form.source} onChange={(e) => set("source", e.target.value)} placeholder="Referral" /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Tags (comma-separated)"><TextInput value={form.tags} onChange={(e) => set("tags", e.target.value)} placeholder="key account, tech" /></Field>
        <Field label="Next follow-up"><TextInput type="date" value={form.next_follow_up_at} onChange={(e) => set("next_follow_up_at", e.target.value)} /></Field>
      </div>
      <Field label="Notes"><TextArea value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Context, relationship history, preferences…" /></Field>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </SlideOver>
  );
}

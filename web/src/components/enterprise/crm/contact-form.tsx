"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { CONTACT_TYPES, RELATIONSHIP_STATUSES, type CrmContact } from "@/lib/crm-shared";
import { SlideOver, Field, TextInput, TextArea, Select, inputCls } from "./crm-ui";

const toDateInput = (v: string | null | undefined) => (v ? new Date(v).toISOString().slice(0, 10) : "");

export function ContactForm({
  open, onClose, contact, companies, defaultCompanyId, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  contact?: CrmContact | null;
  companies: { id: string; name: string }[];
  defaultCompanyId?: string;
  onSaved: (c: CrmContact) => void;
}) {
  const editing = !!contact;
  const [form, setForm] = useState({
    first_name: contact?.first_name ?? "",
    last_name: contact?.last_name ?? "",
    title: contact?.title ?? "",
    email: contact?.email ?? "",
    phone: contact?.phone ?? "",
    linkedin_url: contact?.linkedin_url ?? "",
    company_id: contact?.company_id ?? defaultCompanyId ?? "",
    contact_type: contact?.contact_type ?? "other",
    relationship_status: contact?.relationship_status ?? "new",
    tags: (contact?.tags ?? []).join(", "),
    next_follow_up_at: toDateInput(contact?.next_follow_up_at),
    notes: contact?.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.first_name.trim()) { setError("First name is required."); return; }
    setSaving(true); setError("");
    const payload = {
      ...form,
      company_id: form.company_id || null,
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      next_follow_up_at: form.next_follow_up_at ? new Date(form.next_follow_up_at).toISOString() : null,
    };
    const res = await fetch(
      editing ? `/api/enterprise/crm/contacts/${contact!.id}` : "/api/enterprise/crm/contacts",
      { method: editing ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
    );
    const json = await res.json();
    setSaving(false);
    if (!res.ok) { setError(json.error ?? "Could not save."); return; }
    onSaved(json.data);
    onClose();
  };

  return (
    <SlideOver open={open} onClose={onClose} title={editing ? "Edit contact" : "New contact"}
      footer={
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-xl border border-border py-2 text-sm font-medium hover:bg-muted">Cancel</button>
          <button onClick={save} disabled={saving} className="btn-cta flex-1 rounded-xl py-2 text-sm font-semibold disabled:opacity-60">
            {saving ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : editing ? "Save changes" : "Add contact"}
          </button>
        </div>
      }>
      <div className="grid grid-cols-2 gap-3">
        <Field label="First name" required><TextInput value={form.first_name} onChange={(e) => set("first_name", e.target.value)} autoFocus /></Field>
        <Field label="Last name"><TextInput value={form.last_name} onChange={(e) => set("last_name", e.target.value)} /></Field>
      </div>
      <Field label="Title"><TextInput value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="VP of Engineering" /></Field>
      <Field label="Company">
        <select value={form.company_id} onChange={(e) => set("company_id", e.target.value)} className={inputCls}>
          <option value="">— No company —</option>
          {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Email"><TextInput type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="name@company.com" /></Field>
        <Field label="Phone"><TextInput value={form.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
      </div>
      <Field label="LinkedIn URL"><TextInput value={form.linkedin_url} onChange={(e) => set("linkedin_url", e.target.value)} placeholder="linkedin.com/in/…" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Contact type"><Select value={form.contact_type} onChange={(e) => set("contact_type", e.target.value)} options={CONTACT_TYPES} /></Field>
        <Field label="Relationship"><Select value={form.relationship_status} onChange={(e) => set("relationship_status", e.target.value)} options={RELATIONSHIP_STATUSES} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Tags (comma-separated)"><TextInput value={form.tags} onChange={(e) => set("tags", e.target.value)} placeholder="decision-maker" /></Field>
        <Field label="Next follow-up"><TextInput type="date" value={form.next_follow_up_at} onChange={(e) => set("next_follow_up_at", e.target.value)} /></Field>
      </div>
      <Field label="Notes"><TextArea value={form.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </SlideOver>
  );
}

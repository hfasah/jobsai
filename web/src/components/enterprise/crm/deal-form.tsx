"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { DEAL_STAGES, type CrmDeal } from "@/lib/crm-shared";
import { SlideOver, Field, TextInput, TextArea, Select, inputCls } from "./crm-ui";

const toDateInput = (v: string | null | undefined) => (v ? new Date(v).toISOString().slice(0, 10) : "");

export function DealForm({
  open, onClose, deal, companies, defaultCompanyId, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  deal?: CrmDeal | null;
  companies: { id: string; name: string }[];
  defaultCompanyId?: string;
  onSaved: (d: CrmDeal) => void;
}) {
  const editing = !!deal;
  const [form, setForm] = useState({
    name: deal?.name ?? "",
    company_id: deal?.company_id ?? defaultCompanyId ?? "",
    value: deal?.value != null ? String(deal.value) : "",
    stage: deal?.stage ?? "lead",
    probability: deal?.probability != null ? String(deal.probability) : "",
    expected_close_at: toDateInput(deal?.expected_close_at),
    next_action: deal?.next_action ?? "",
    notes: deal?.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.name.trim()) { setError("Deal name is required."); return; }
    setSaving(true); setError("");
    const payload = {
      ...form,
      company_id: form.company_id || null,
      value: form.value === "" ? null : Number(form.value),
      probability: form.probability === "" ? null : Number(form.probability),
      expected_close_at: form.expected_close_at ? new Date(form.expected_close_at).toISOString() : null,
    };
    const res = await fetch(
      editing ? `/api/enterprise/crm/deals/${deal!.id}` : "/api/enterprise/crm/deals",
      { method: editing ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
    );
    const json = await res.json();
    setSaving(false);
    if (!res.ok) { setError(json.error ?? "Could not save."); return; }
    onSaved(json.data);
    onClose();
  };

  return (
    <SlideOver open={open} onClose={onClose} title={editing ? "Edit deal" : "New deal"}
      footer={
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-xl border border-border py-2 text-sm font-medium hover:bg-muted">Cancel</button>
          <button onClick={save} disabled={saving} className="btn-cta flex-1 rounded-xl py-2 text-sm font-semibold disabled:opacity-60">
            {saving ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : editing ? "Save changes" : "Add deal"}
          </button>
        </div>
      }>
      <Field label="Deal name" required><TextInput value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Acme — Q3 engineering roles" autoFocus /></Field>
      <Field label="Company">
        <select value={form.company_id} onChange={(e) => set("company_id", e.target.value)} className={inputCls}>
          <option value="">— No company —</option>
          {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Stage"><Select value={form.stage} onChange={(e) => set("stage", e.target.value)} options={DEAL_STAGES} /></Field>
        <Field label="Estimated value ($)"><TextInput type="number" min={0} value={form.value} onChange={(e) => set("value", e.target.value)} placeholder="25000" /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Probability (%)"><TextInput type="number" min={0} max={100} value={form.probability} onChange={(e) => set("probability", e.target.value)} placeholder="60" /></Field>
        <Field label="Expected close"><TextInput type="date" value={form.expected_close_at} onChange={(e) => set("expected_close_at", e.target.value)} /></Field>
      </div>
      <Field label="Next action"><TextInput value={form.next_action} onChange={(e) => set("next_action", e.target.value)} placeholder="Send proposal" /></Field>
      <Field label="Notes"><TextArea value={form.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </SlideOver>
  );
}

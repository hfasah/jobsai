"use client";

// Per-campaign subsequences: configurable trigger → action rules. When a lead
// replies with a given category (or finishes the sequence), the chosen actions
// run automatically. Opened as a modal from a campaign.
import { useEffect, useState } from "react";
import { Workflow, Loader2, X, Plus, Trash2, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Action { type: string; config?: { campaign_id?: string; subject?: string; body?: string; tag?: string } }
interface Rule { id: string; name: string; trigger_type: string; trigger_config: { category?: string }; actions: Action[]; enabled: boolean }
interface CampaignOpt { id: string; name: string }

const CATEGORIES = [
  { key: "interested", label: "Interested" },
  { key: "meeting_requested", label: "Meeting requested" },
  { key: "question", label: "Has a question" },
  { key: "referral", label: "Referral" },
  { key: "not_interested", label: "Not interested" },
];
const ACTIONS = [
  { key: "notify_recruiter", label: "Notify the team" },
  { key: "move_to_pipeline", label: "Move to ATS pipeline" },
  { key: "add_to_campaign", label: "Add to another campaign" },
  { key: "send_email", label: "Send an email" },
  { key: "add_tag", label: "Tag the candidate" },
];
const TRIGGER_LABEL: Record<string, string> = { reply_category: "Reply", sequence_completed: "Sequence completed" };

export default function SubsequencesPanel({ campaignId, campaignName, onClose, embedded = false }: { campaignId: string; campaignName: string; onClose: () => void; embedded?: boolean }) {
  const base = `/api/enterprise/campaigns/${campaignId}/subsequences`;
  const [loading, setLoading] = useState(true);
  const [rules, setRules] = useState<Rule[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignOpt[]>([]);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // new-rule draft
  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState("reply_category");
  const [category, setCategory] = useState("interested");
  const [actionTypes, setActionTypes] = useState<Set<string>>(new Set(["notify_recruiter"]));
  const [targetCampaign, setTargetCampaign] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [tag, setTag] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(base).then((r) => r.json()).then((j) => setRules(j.data ?? [])).catch(() => {}).finally(() => setLoading(false));
    fetch("/api/enterprise/campaigns").then((r) => r.json()).then((j) => setCampaigns((j.data ?? []).filter((c: CampaignOpt) => c.id !== campaignId).map((c: CampaignOpt) => ({ id: c.id, name: c.name })))).catch(() => {});
  }, [base, campaignId]);

  const toggleAction = (k: string) => setActionTypes((prev) => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n; });

  const addRule = async () => {
    setError(null);
    if (!name.trim()) { setError("Name the rule."); return; }
    if (actionTypes.size === 0) { setError("Pick at least one action."); return; }
    if (actionTypes.has("add_to_campaign") && !targetCampaign) { setError("Pick the campaign to add them to."); return; }
    if (actionTypes.has("send_email") && !(emailSubject.trim() && emailBody.trim())) { setError("Give the email a subject and body."); return; }
    if (actionTypes.has("add_tag") && !tag.trim()) { setError("Enter the tag to apply."); return; }
    const actions: Action[] = [...actionTypes].map((t) => {
      if (t === "add_to_campaign") return { type: t, config: { campaign_id: targetCampaign } };
      if (t === "send_email") return { type: t, config: { subject: emailSubject.trim(), body: emailBody.trim() } };
      if (t === "add_tag") return { type: t, config: { tag: tag.trim() } };
      return { type: t };
    });
    setSaving(true);
    const res = await fetch(base, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, trigger_type: trigger, trigger_config: trigger === "reply_category" ? { category } : {}, actions }),
    });
    setSaving(false);
    if (!res.ok) { const j = await res.json().catch(() => ({})); setError(j.error ?? "Could not save."); return; }
    const j = await res.json();
    setRules((r) => [...r, j.data]);
    setName(""); setActionTypes(new Set(["notify_recruiter"])); setTargetCampaign(""); setEmailSubject(""); setEmailBody(""); setTag(""); setAdding(false);
  };

  const remove = async (id: string) => {
    setRules((r) => r.filter((x) => x.id !== id));
    await fetch(`${base}?subId=${id}`, { method: "DELETE" }).catch(() => {});
  };

  const describe = (r: Rule) => {
    const trig = r.trigger_type === "reply_category" ? `When a lead replies "${CATEGORIES.find((c) => c.key === r.trigger_config?.category)?.label ?? r.trigger_config?.category}"` : "When the sequence finishes";
    const acts = (r.actions ?? []).map((a) => ACTIONS.find((x) => x.key === a.type)?.label ?? a.type).join(", ");
    return { trig, acts };
  };

  return (
    <div
      className={embedded ? "overflow-hidden rounded-2xl border border-border bg-card" : "fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"}
      onClick={embedded ? undefined : onClose}
    >
      <div onClick={(e) => e.stopPropagation()} className={embedded ? "flex w-full flex-col" : "flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"}>
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="flex items-center gap-2 font-semibold"><Workflow className="h-4 w-4 text-primary" /> Subsequences{!embedded && <> — <span className="text-muted-foreground">{campaignName}</span></>}</h2>
          {!embedded && <button onClick={onClose} aria-label="Close"><X className="h-4 w-4 text-muted-foreground" /></button>}
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          <p className="text-[11px] text-muted-foreground">Automate what happens when a lead reacts — beyond the built-in actions. Rules run in addition to the defaults.</p>

          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : rules.length === 0 && !adding ? (
            <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">No rules yet.</p>
          ) : (
            rules.map((r) => {
              const d = describe(r);
              return (
                <div key={r.id} className="flex items-start gap-2 rounded-xl border border-border px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{r.name}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
                      <span className="rounded bg-muted px-1.5 py-0.5">{TRIGGER_LABEL[r.trigger_type]}</span>
                      {d.trig} <ArrowRight className="h-3 w-3" /> <span className="text-foreground/80">{d.acts}</span>
                    </p>
                  </div>
                  <button onClick={() => remove(r.id)} className="shrink-0 text-muted-foreground hover:text-red-400" aria-label="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              );
            })
          )}

          {adding && (
            <div className="space-y-2.5 rounded-xl border border-primary/30 bg-primary/5 p-3">
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Rule name (e.g. Interested → book a call)" className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
              <div className="grid grid-cols-2 gap-2">
                <label className="text-[11px]">
                  <span className="mb-1 block font-semibold uppercase tracking-wide text-muted-foreground">When</span>
                  <select value={trigger} onChange={(e) => setTrigger(e.target.value)} className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary">
                    <option value="reply_category">A lead replies…</option>
                    <option value="sequence_completed">Sequence finishes (no reply)</option>
                  </select>
                </label>
                {trigger === "reply_category" && (
                  <label className="text-[11px]">
                    <span className="mb-1 block font-semibold uppercase tracking-wide text-muted-foreground">Category</span>
                    <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary">
                      {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                    </select>
                  </label>
                )}
              </div>
              <div>
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Then</span>
                <div className="space-y-1">
                  {ACTIONS.map((a) => (
                    <label key={a.key} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={actionTypes.has(a.key)} onChange={() => toggleAction(a.key)} /> {a.label}
                    </label>
                  ))}
                  {actionTypes.has("add_to_campaign") && (
                    <select value={targetCampaign} onChange={(e) => setTargetCampaign(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary">
                      <option value="">Select a campaign…</option>
                      {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  )}
                  {actionTypes.has("send_email") && (
                    <div className="mt-1 space-y-1 rounded-lg border border-border p-2">
                      <input value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} placeholder="Email subject" className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                      <textarea value={emailBody} onChange={(e) => setEmailBody(e.target.value)} rows={3} placeholder="Email body — supports {{first_name}}, {{org_name}}…" className="w-full resize-y rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                    </div>
                  )}
                  {actionTypes.has("add_tag") && (
                    <input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="Tag to apply (e.g. warm-lead)" className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                  )}
                </div>
              </div>
              {error && <p className="text-xs text-red-400">{error}</p>}
              <div className="flex justify-end gap-1.5">
                <button onClick={() => { setAdding(false); setError(null); }} className="rounded-lg px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground">Cancel</button>
                <button onClick={addRule} disabled={saving} className="btn-cta inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold disabled:opacity-60">
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Add rule
                </button>
              </div>
            </div>
          )}
        </div>

        {!adding && (
          <div className="border-t border-border p-3">
            <button onClick={() => setAdding(true)} className="btn-cta inline-flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-semibold">
              <Plus className="h-4 w-4" /> New rule
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

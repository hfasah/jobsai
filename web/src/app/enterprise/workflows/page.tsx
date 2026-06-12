"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Loader2, Trash2, ToggleLeft, ToggleRight, Zap, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import WorkflowRuleModal from "@/components/enterprise/workflow-rule-modal";

type Rule = {
  id: string;
  name: string;
  active: boolean;
  trigger_type: string;
  trigger_stage: string | null;
  action_type: string;
  action_config: Record<string, unknown>;
  sort_order: number;
  created_at: string;
};

const TRIGGER_LABELS: Record<string, string> = {
  stage_change: "Stage changes to",
  application_created: "New application received",
  offer_signed: "Candidate signs offer",
  offer_declined: "Candidate declines offer",
};

const ACTION_LABELS: Record<string, string> = {
  send_candidate_email: "Send email to candidate",
  send_team_notification: "Notify team",
  assign_to: "Assign application",
  move_stage: "Move to stage",
  add_tag: "Add tag",
};

const STAGE_LABELS: Record<string, string> = {
  applied: "Applied",
  screened: "Screened",
  interview: "Interview",
  offer: "Offer",
  hired: "Hired",
  rejected: "Rejected",
};

const ACTION_COLORS: Record<string, string> = {
  send_candidate_email: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  send_team_notification: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  assign_to: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  move_stage: "bg-green-500/10 text-green-400 border-green-500/20",
  add_tag: "bg-pink-500/10 text-pink-400 border-pink-500/20",
};

function actionSummary(rule: Rule): string {
  const cfg = rule.action_config;
  switch (rule.action_type) {
    case "send_candidate_email":
      return `Subject: "${(cfg.subject as string)?.slice(0, 50) ?? "…"}"`;
    case "send_team_notification":
      return `To: ${((cfg.notify_emails as string[]) ?? []).join(", ") || "no emails set"}`;
    case "assign_to":
      return `User: ${(cfg.user_id as string) ?? "not set"}`;
    case "move_stage":
      return `→ ${STAGE_LABELS[cfg.stage as string] ?? cfg.stage}`;
    case "add_tag":
      return `Tag: "${(cfg.tag as string) ?? ""}"`;
    default:
      return "";
  }
}

export default function WorkflowsPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editRule, setEditRule] = useState<Rule | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/enterprise/workflows")
      .then((r) => r.json())
      .then((j) => setRules(j.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleActive = async (rule: Rule) => {
    setBusy(rule.id);
    await fetch(`/api/enterprise/workflows/${rule.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !rule.active }),
    });
    setRules((prev) => prev.map((r) => r.id === rule.id ? { ...r, active: !r.active } : r));
    setBusy(null);
  };

  const deleteRule = async (id: string) => {
    if (!confirm("Delete this workflow rule?")) return;
    setBusy(id);
    await fetch(`/api/enterprise/workflows/${id}`, { method: "DELETE" });
    setRules((prev) => prev.filter((r) => r.id !== id));
    setBusy(null);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Workflow Automation</h1>
          <p className="text-sm text-muted-foreground">
            Automate actions when applications move through your pipeline
          </p>
        </div>
        <button
          onClick={() => { setEditRule(null); setModalOpen(true); }}
          className="btn-cta inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold"
        >
          <Plus className="h-4 w-4" /> New Rule
        </button>
      </div>

      {/* How it works */}
      <div className="mb-6 rounded-2xl border border-border bg-card/50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">How it works</p>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span className="rounded-lg bg-muted px-2.5 py-1">Trigger</span>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="rounded-lg bg-muted px-2.5 py-1">Condition (optional)</span>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="rounded-lg bg-muted px-2.5 py-1">Action</span>
          <span className="ml-2">— rules fire automatically, in order, fire-and-forget.</span>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : rules.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16 text-center">
          <Zap className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">No workflow rules yet</p>
          <p className="mt-1 text-xs text-muted-foreground/60">Create your first rule to automate repetitive tasks</p>
          <button
            onClick={() => { setEditRule(null); setModalOpen(true); }}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
          >
            <Plus className="h-3.5 w-3.5" /> Add first rule
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className={cn(
                "rounded-2xl border bg-card p-4 transition-opacity",
                !rule.active && "opacity-60",
              )}
            >
              <div className="flex items-start gap-3">
                <div className={cn(
                  "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
                  ACTION_COLORS[rule.action_type] ?? "bg-muted text-muted-foreground border-border",
                )}>
                  <Zap className="h-4 w-4" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold leading-tight">{rule.name}</p>
                    {!rule.active && (
                      <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        Paused
                      </span>
                    )}
                  </div>

                  {/* Trigger → Action summary */}
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="rounded-md border border-border bg-muted/50 px-2 py-0.5">
                      {TRIGGER_LABELS[rule.trigger_type] ?? rule.trigger_type}
                      {rule.trigger_stage && (
                        <span className="ml-1 font-medium text-foreground">
                          {STAGE_LABELS[rule.trigger_stage] ?? rule.trigger_stage}
                        </span>
                      )}
                    </span>
                    <ChevronRight className="h-3 w-3" />
                    <span className={cn(
                      "rounded-md border px-2 py-0.5 font-medium",
                      ACTION_COLORS[rule.action_type] ?? "border-border text-muted-foreground",
                    )}>
                      {ACTION_LABELS[rule.action_type] ?? rule.action_type}
                    </span>
                  </div>

                  <p className="mt-1 text-xs text-muted-foreground/70">{actionSummary(rule)}</p>
                </div>

                {/* Controls */}
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => toggleActive(rule)}
                    disabled={busy === rule.id}
                    title={rule.active ? "Pause rule" : "Activate rule"}
                    className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted disabled:opacity-60"
                  >
                    {busy === rule.id
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : rule.active
                        ? <ToggleRight className="h-3.5 w-3.5 text-green-400" />
                        : <ToggleLeft className="h-3.5 w-3.5" />}
                    {rule.active ? "Active" : "Paused"}
                  </button>
                  <button
                    onClick={() => { setEditRule(rule); setModalOpen(true); }}
                    className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteRule(rule.id)}
                    disabled={busy === rule.id}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-red-500/10 hover:text-red-400 disabled:opacity-60"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <WorkflowRuleModal
          rule={editRule}
          onClose={() => setModalOpen(false)}
          onSaved={() => { setModalOpen(false); load(); }}
        />
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import {
  Loader2, Bot, Zap, Plus, Trash2, ToggleLeft, ToggleRight, CheckCircle2,
  XCircle, AlertTriangle, Tag, Mail, Bell, CalendarDays, ArrowRight,
  ChevronDown, ChevronUp, X, Settings2,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Condition { field: string; operator: string; value: string | number | string[] }
interface Rule {
  id: string; name: string; description: string | null; trigger_event: string;
  conditions: Condition[]; action: string; action_config: Record<string, unknown>;
  active: boolean; run_count: number; job_id: string | null;
  job: { id: string; title: string } | null;
}
interface AgentAction {
  id: string; rule_name: string; candidate_name: string; job_title: string;
  action: string; result: string; details: Record<string, unknown>; created_at: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const CONDITION_FIELDS = [
  { value: "match_score",           label: "Match score",           type: "number" },
  { value: "ats_score",             label: "ATS score",             type: "number" },
  { value: "ai_recommendation",     label: "AI recommendation",     type: "enum", options: ["strong_yes","yes","maybe","no"] },
  { value: "risk_flags",            label: "Risk flags",            type: "array" },
  { value: "ats_keywords_matched",  label: "Required skills (matched)", type: "array" },
  { value: "ats_keywords_missing",  label: "Required skills (missing)", type: "array" },
];

const OPERATORS_BY_TYPE: Record<string, { value: string; label: string }[]> = {
  number: [
    { value: "gte", label: "≥" }, { value: "lte", label: "≤" },
    { value: "gt",  label: ">"  }, { value: "lt",  label: "<" },
    { value: "eq",  label: "="  },
  ],
  enum: [
    { value: "eq",     label: "is" },
    { value: "neq",    label: "is not" },
    { value: "in",     label: "is one of" },
    { value: "not_in", label: "is not one of" },
  ],
  array: [
    { value: "contains_all",  label: "contains all of" },
    { value: "contains_any",  label: "contains any of" },
    { value: "is_empty",      label: "is empty" },
    { value: "not_empty",     label: "is not empty" },
  ],
};

const ACTIONS = [
  { value: "move_stage",           label: "Move to stage",         icon: ArrowRight,   color: "text-blue-400" },
  { value: "auto_reject",          label: "Auto-reject",           icon: XCircle,      color: "text-red-400" },
  { value: "add_tag",              label: "Add tag",               icon: Tag,          color: "text-purple-400" },
  { value: "notify_hm",            label: "Notify hiring manager", icon: Bell,         color: "text-amber-400" },
  { value: "send_interview_invite",label: "Send interview invite", icon: CalendarDays, color: "text-green-400" },
];

const ACTION_STAGES = ["screened", "interview", "offer", "hired"];

const RESULT_ICON: Record<string, React.ElementType> = {
  success: CheckCircle2, skipped: AlertTriangle, error: XCircle,
};
const RESULT_COLOR: Record<string, string> = {
  success: "text-green-400", skipped: "text-amber-400", error: "text-red-400",
};

const ACTION_LABEL: Record<string, string> = {
  move_stage: "Stage moved", auto_reject: "Auto-rejected",
  add_tag: "Tag added", notify_hm: "HM notified", send_interview_invite: "Interview sent",
};

// ── Rule builder modal ────────────────────────────────────────────────────────
function RuleModal({ onSave, onClose, jobs }: {
  onSave: (rule: Partial<Rule>) => Promise<void>;
  onClose: () => void;
  jobs: { id: string; title: string }[];
}) {
  const [name, setName] = useState("");
  const [conditions, setConditions] = useState<Condition[]>([
    { field: "match_score", operator: "gte", value: 75 },
  ]);
  const [action, setAction] = useState("move_stage");
  const [actionConfig, setActionConfig] = useState<Record<string, unknown>>({ stage: "screened" });
  const [jobId, setJobId] = useState("");
  const [saving, setSaving] = useState(false);

  const fieldType = (field: string) =>
    CONDITION_FIELDS.find((f) => f.value === field)?.type ?? "number";

  const addCondition = () =>
    setConditions((c) => [...c, { field: "match_score", operator: "gte", value: 75 }]);

  const updateCond = (i: number, k: keyof Condition, v: unknown) =>
    setConditions((prev) => prev.map((c, idx) => idx === i ? { ...c, [k]: v } : c));

  const removeCond = (i: number) => setConditions((c) => c.filter((_, idx) => idx !== i));

  const submit = async () => {
    if (!name.trim() || conditions.length === 0) return;
    setSaving(true);
    await onSave({
      name, conditions, action,
      action_config: actionConfig,
      job_id: jobId || null,
      active: true,
    });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="flex items-center gap-2 font-semibold"><Bot className="h-4 w-4 text-primary" />Create automation rule</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>

        <div className="p-5 space-y-5">
          {/* Name */}
          <div>
            <label className="mb-1.5 block text-sm font-medium">Rule name</label>
            <input value={name} onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Auto-advance strong DevOps candidates"
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>

          {/* Scope */}
          <div>
            <label className="mb-1.5 block text-sm font-medium">Apply to</label>
            <select value={jobId} onChange={(e) => setJobId(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
              <option value="">All jobs (org-wide)</option>
              {jobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
            </select>
          </div>

          {/* Conditions */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium">IF (all conditions must match)</label>
              <button onClick={addCondition}
                className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">
                <Plus className="h-3 w-3" /> Add
              </button>
            </div>
            <div className="space-y-2">
              {conditions.map((cond, i) => {
                const type = fieldType(cond.field);
                const operators = OPERATORS_BY_TYPE[type] ?? [];
                const enumField = CONDITION_FIELDS.find((f) => f.value === cond.field);
                const needsValue = !["is_empty", "not_empty"].includes(cond.operator);
                return (
                  <div key={i} className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/30 p-2.5">
                    <select value={cond.field} onChange={(e) => updateCond(i, "field", e.target.value)}
                      className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary">
                      {CONDITION_FIELDS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                    </select>
                    <select value={cond.operator} onChange={(e) => updateCond(i, "operator", e.target.value)}
                      className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary">
                      {operators.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    {needsValue && type === "number" && (
                      <input type="number" min={0} max={100} value={cond.value as number}
                        onChange={(e) => updateCond(i, "value", Number(e.target.value))}
                        className="w-16 rounded-lg border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary" />
                    )}
                    {needsValue && type === "enum" && (
                      <select value={cond.value as string} onChange={(e) => updateCond(i, "value", e.target.value)}
                        className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary">
                        {(enumField?.options ?? []).map((o) => <option key={o} value={o}>{o.replace("_", " ")}</option>)}
                      </select>
                    )}
                    {needsValue && type === "array" && (
                      <input value={Array.isArray(cond.value) ? (cond.value as string[]).join(", ") : cond.value as string}
                        onChange={(e) => updateCond(i, "value", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
                        placeholder="Kubernetes, Terraform, AWS"
                        className="flex-1 min-w-32 rounded-lg border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary" />
                    )}
                    {conditions.length > 1 && (
                      <button onClick={() => removeCond(i)} className="ml-auto text-muted-foreground hover:text-destructive">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action */}
          <div>
            <label className="mb-2 block text-sm font-medium">THEN</label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {ACTIONS.map((a) => {
                const Icon = a.icon;
                return (
                  <button key={a.value} onClick={() => {
                    setAction(a.value);
                    if (a.value === "move_stage") setActionConfig({ stage: "screened" });
                    else if (a.value === "add_tag") setActionConfig({ tag: "auto-advanced" });
                    else if (a.value === "auto_reject") setActionConfig({ send_email: true });
                    else setActionConfig({});
                  }}
                    className={cn("flex items-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-medium transition-colors",
                      action === a.value ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted hover:text-foreground")}>
                    <Icon className={cn("h-3.5 w-3.5 shrink-0", a.color)} />
                    {a.label}
                  </button>
                );
              })}
            </div>

            {/* Action config */}
            <div className="mt-3">
              {action === "move_stage" && (
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Move to stage</label>
                  <select value={actionConfig.stage as string ?? "screened"}
                    onChange={(e) => setActionConfig({ stage: e.target.value })}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary">
                    {ACTION_STAGES.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
                  </select>
                </div>
              )}
              {action === "add_tag" && (
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Tag name</label>
                  <input value={actionConfig.tag as string ?? ""}
                    onChange={(e) => setActionConfig({ tag: e.target.value })}
                    placeholder="e.g. auto-advanced, top-candidate"
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
                </div>
              )}
              {action === "auto_reject" && (
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input type="checkbox" checked={!!actionConfig.send_email}
                    onChange={(e) => setActionConfig({ send_email: e.target.checked })}
                    className="rounded border-border" />
                  Send rejection email to candidate
                </label>
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-border px-5 py-4">
          <button onClick={submit} disabled={!name.trim() || saving}
            className="btn-cta inline-flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold disabled:opacity-60">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            Create rule
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AgentPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [activity, setActivity] = useState<AgentAction[]>([]);
  const [weekTotal, setWeekTotal] = useState(0);
  const [jobs, setJobs] = useState<{ id: string; title: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [tab, setTab] = useState<"rules" | "activity">("rules");

  const load = async () => {
    setLoading(true);
    const [rulesRes, activityRes, jobsRes] = await Promise.all([
      fetch("/api/enterprise/agent/rules").then((r) => r.json()),
      fetch("/api/enterprise/agent/activity").then((r) => r.json()),
      fetch("/api/enterprise/jobs").then((r) => r.json()),
    ]);
    setRules(rulesRes.data ?? []);
    setActivity(activityRes.activity ?? []);
    setWeekTotal(activityRes.total_this_week ?? 0);
    setJobs((jobsRes.data ?? []).filter((j: { status: string }) => j.status === "active"));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const createRule = async (rule: Partial<Rule>) => {
    await fetch("/api/enterprise/agent/rules", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rule),
    });
    setModalOpen(false);
    await load();
  };

  const toggleRule = async (id: string, active: boolean) => {
    setRules((r) => r.map((rule) => rule.id === id ? { ...rule, active } : rule));
    await fetch(`/api/enterprise/agent/rules/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    });
  };

  const deleteRule = async (id: string) => {
    setRules((r) => r.filter((rule) => rule.id !== id));
    await fetch(`/api/enterprise/agent/rules/${id}`, { method: "DELETE" });
  };

  const activeCount = rules.filter((r) => r.active).length;

  if (loading) return (
    <main className="flex flex-1 items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </main>
  );

  return (
    <main className="flex-1 overflow-y-auto px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-4xl space-y-6">

        {/* Agent status header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              "flex h-12 w-12 items-center justify-center rounded-2xl shadow-glow transition-all",
              activeCount > 0 ? "bg-gradient-brand" : "bg-muted"
            )}>
              <Bot className={cn("h-6 w-6", activeCount > 0 ? "text-white" : "text-muted-foreground")} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Recruiting Agent</h1>
              <p className={cn("flex items-center gap-1.5 text-sm font-medium",
                activeCount > 0 ? "text-green-400" : "text-muted-foreground")}>
                <span className={cn("h-2 w-2 rounded-full", activeCount > 0 ? "bg-green-400 animate-pulse" : "bg-muted-foreground")} />
                {activeCount > 0 ? `Active · ${activeCount} rule${activeCount !== 1 ? "s" : ""} running` : "Inactive — no rules enabled"}
              </p>
            </div>
          </div>
          <button onClick={() => setModalOpen(true)}
            className="btn-cta inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold">
            <Plus className="h-4 w-4" /> New rule
          </button>
        </div>

        {/* Stats */}
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { label: "Active rules",    value: activeCount,          color: activeCount > 0 ? "text-green-400" : "" },
            { label: "Actions this week", value: weekTotal,           color: weekTotal > 0 ? "text-primary" : "" },
            { label: "Total rules",     value: rules.length,         color: "" },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-2xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className={cn("mt-1 text-2xl font-bold tabular-nums", color)}>{value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 rounded-xl border border-border bg-card p-1">
          {(["rules", "activity"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={cn("flex-1 rounded-lg py-1.5 text-sm font-medium transition-colors capitalize",
                tab === t ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground")}>
              {t === "rules" ? `Rules (${rules.length})` : `Activity (${activity.length})`}
            </button>
          ))}
        </div>

        {/* Rules tab */}
        {tab === "rules" && (
          <div className="space-y-3">
            {rules.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border py-16 text-center">
                <Bot className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
                <p className="font-semibold text-muted-foreground">No rules yet</p>
                <p className="mt-1 text-sm text-muted-foreground">Create your first rule to start automating your pipeline.</p>
                <button onClick={() => setModalOpen(true)}
                  className="btn-cta mt-4 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold">
                  <Plus className="h-4 w-4" /> Create first rule
                </button>
              </div>
            ) : (
              rules.map((rule) => {
                const actionMeta = ACTIONS.find((a) => a.value === rule.action);
                const ActionIcon = actionMeta?.icon ?? Zap;
                return (
                  <div key={rule.id}
                    className={cn("rounded-2xl border bg-card p-4 transition-all",
                      rule.active ? "border-border" : "border-border/50 opacity-60")}>
                    <div className="flex items-start gap-3">
                      <div className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
                        rule.active ? "bg-gradient-brand" : "bg-muted")}>
                        <ActionIcon className={cn("h-4 w-4", rule.active ? "text-white" : "text-muted-foreground")} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{rule.name}</span>
                          {rule.job && (
                            <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                              {rule.job.title}
                            </span>
                          )}
                          {!rule.job_id && (
                            <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] text-primary">
                              All jobs
                            </span>
                          )}
                        </div>

                        {/* Conditions preview */}
                        <p className="mt-1 text-xs text-muted-foreground">
                          IF {rule.conditions.map((c) => {
                            const field = CONDITION_FIELDS.find((f) => f.value === c.field)?.label ?? c.field;
                            const op = Object.values(OPERATORS_BY_TYPE).flat().find((o) => o.value === c.operator)?.label ?? c.operator;
                            const val = Array.isArray(c.value) ? (c.value as string[]).join(", ") : c.value;
                            return `${field} ${op} ${val}`;
                          }).join(" AND ")}
                          {" → "}
                          {actionMeta?.label}
                          {rule.action === "move_stage" && !!rule.action_config.stage && ` (${rule.action_config.stage as string})`}
                          {rule.action === "add_tag" && !!rule.action_config.tag && ` "${rule.action_config.tag as string}"`}
                        </p>

                        {rule.run_count > 0 && (
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            Triggered {rule.run_count} time{rule.run_count !== 1 ? "s" : ""}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button onClick={() => toggleRule(rule.id, !rule.active)}
                          className="text-muted-foreground hover:text-foreground transition-colors">
                          {rule.active
                            ? <ToggleRight className="h-5 w-5 text-green-400" />
                            : <ToggleLeft className="h-5 w-5" />}
                        </button>
                        <button onClick={() => deleteRule(rule.id)}
                          className="rounded-lg p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Activity tab */}
        {tab === "activity" && (
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            {activity.length === 0 ? (
              <div className="py-16 text-center">
                <Zap className="mx-auto mb-3 h-8 w-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No agent actions yet. Rules run automatically after each candidate is screened.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {activity.map((a) => {
                  const Icon = RESULT_ICON[a.result] ?? CheckCircle2;
                  return (
                    <div key={a.id} className="flex items-start gap-3 px-4 py-3">
                      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", RESULT_COLOR[a.result])} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm">
                          <span className="font-semibold">{a.candidate_name}</span>
                          <span className="text-muted-foreground"> · {a.job_title}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {ACTION_LABEL[a.action] ?? a.action} via <span className="text-foreground">{a.rule_name}</span>
                          {a.details?.stage ? ` → ${a.details.stage}` : ""}
                          {a.details?.tag ? ` "${a.details.tag}"` : ""}
                        </p>
                      </div>
                      <span className="shrink-0 text-[10px] text-muted-foreground whitespace-nowrap">
                        {new Date(a.created_at).toLocaleDateString([], { month: "short", day: "numeric" })}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {modalOpen && <RuleModal onSave={createRule} onClose={() => setModalOpen(false)} jobs={jobs} />}
    </main>
  );
}

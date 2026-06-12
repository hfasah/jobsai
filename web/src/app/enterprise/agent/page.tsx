"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Loader2, Bot, Zap, Plus, Trash2, ToggleLeft, ToggleRight, CheckCircle2,
  XCircle, AlertTriangle, Tag, Mail, Bell, CalendarDays, ArrowRight,
  ChevronDown, ChevronUp, X, Settings2, Sparkles, Eye, BookOpen, Wand2,
  Clock, GitMerge, UserCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Condition { field: string; operator: string; value: string | number | string[] }
interface ActionStep { action: string; action_config: Record<string, unknown> }
interface Rule {
  id: string; name: string; description: string | null; trigger_event: string;
  trigger_config: Record<string, unknown>;
  conditions: Condition[]; action: string; action_config: Record<string, unknown>;
  actions: ActionStep[] | null;
  active: boolean; run_count: number; job_id: string | null;
  job: { id: string; title: string } | null;
}
interface AgentAction {
  id: string; rule_name: string; candidate_name: string; job_title: string;
  action: string; result: string; details: Record<string, unknown>; created_at: string;
}
interface Template {
  id: string; name: string; description: string; trigger_event: string;
  trigger_config?: Record<string, unknown>;
  conditions: Condition[]; actions: ActionStep[];
}
interface PreviewMatch {
  application_id: string; candidate_name: string; stage: string;
  match_score: number | null; ai_recommendation: string | null; job_title: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────
const CONDITION_FIELDS = [
  { value: "match_score",           label: "Match score",               type: "number" },
  { value: "ats_score",             label: "ATS score",                 type: "number" },
  { value: "ai_recommendation",     label: "AI recommendation",         type: "enum",  options: ["strong_yes","yes","maybe","no"] },
  { value: "risk_flags",            label: "Risk flags",                type: "array" },
  { value: "ats_keywords_matched",  label: "Required skills (matched)", type: "array" },
  { value: "ats_keywords_missing",  label: "Required skills (missing)", type: "array" },
  { value: "stage",                 label: "Current stage",             type: "enum",  options: ["applied","screened","interview","offer","hired"] },
];

const OPERATORS_BY_TYPE: Record<string, { value: string; label: string }[]> = {
  number: [
    { value: "gte", label: "≥" }, { value: "lte", label: "≤" },
    { value: "gt", label: ">" }, { value: "lt", label: "<" },
    { value: "eq", label: "=" },
  ],
  enum: [
    { value: "eq",     label: "is" }, { value: "neq",    label: "is not" },
    { value: "in",     label: "is one of" }, { value: "not_in", label: "is not one of" },
  ],
  array: [
    { value: "contains_all",  label: "contains all of" },
    { value: "contains_any",  label: "contains any of" },
    { value: "is_empty",      label: "is empty" },
    { value: "not_empty",     label: "is not empty" },
  ],
};

const ACTIONS = [
  { value: "move_stage",            label: "Move to stage",         icon: ArrowRight,   color: "text-blue-400" },
  { value: "auto_reject",           label: "Auto-reject",           icon: XCircle,      color: "text-red-400" },
  { value: "add_tag",               label: "Add tag",               icon: Tag,          color: "text-purple-400" },
  { value: "notify_hm",             label: "Notify HM",             icon: Bell,         color: "text-amber-400" },
  { value: "send_interview_invite", label: "Send interview invite", icon: CalendarDays, color: "text-green-400" },
];

const TRIGGER_EVENTS = [
  { value: "application_screened", label: "After AI screening",     icon: Sparkles },
  { value: "stage_changed",        label: "When stage changes",     icon: GitMerge },
  { value: "interview_completed",  label: "After AI interview",     icon: UserCheck },
  { value: "stale_candidate",      label: "Candidate goes stale",   icon: Clock },
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

function defaultConfig(action: string): Record<string, unknown> {
  if (action === "move_stage") return { stage: "screened" };
  if (action === "add_tag") return { tag: "auto-advanced" };
  if (action === "auto_reject") return { send_email: true };
  return {};
}

// ── Action step builder ───────────────────────────────────────────────────────
function ActionStepRow({ step, onChange, onRemove, canRemove }: {
  step: ActionStep;
  onChange: (s: ActionStep) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <div className="grid grid-cols-3 gap-1.5 flex-1">
          {ACTIONS.map((a) => {
            const Icon = a.icon;
            return (
              <button key={a.value} onClick={() => onChange({ action: a.value, action_config: defaultConfig(a.value) })}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-[11px] font-medium transition-colors",
                  step.action === a.value ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
                )}>
                <Icon className={cn("h-3 w-3 shrink-0", a.color)} />
                {a.label}
              </button>
            );
          })}
        </div>
        {canRemove && (
          <button onClick={onRemove} className="text-muted-foreground hover:text-destructive">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Config for chosen action */}
      {step.action === "move_stage" && (
        <select value={(step.action_config.stage as string) ?? "screened"}
          onChange={(e) => onChange({ ...step, action_config: { stage: e.target.value } })}
          className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary">
          {ACTION_STAGES.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
        </select>
      )}
      {step.action === "add_tag" && (
        <input value={(step.action_config.tag as string) ?? ""}
          onChange={(e) => onChange({ ...step, action_config: { tag: e.target.value } })}
          placeholder="tag name"
          className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary" />
      )}
      {step.action === "auto_reject" && (
        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
          <input type="checkbox" checked={!!step.action_config.send_email}
            onChange={(e) => onChange({ ...step, action_config: { send_email: e.target.checked } })} />
          Send rejection email to candidate
        </label>
      )}
    </div>
  );
}

// ── Preview modal ─────────────────────────────────────────────────────────────
function PreviewModal({ conditions, jobId, onClose }: {
  conditions: Condition[]; jobId: string | null; onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [matches, setMatches] = useState<PreviewMatch[]>([]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    fetch("/api/enterprise/agent/preview", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conditions, job_id: jobId }),
    }).then((r) => r.json()).then((j) => {
      setMatches(j.matches ?? []);
      setTotal(j.total ?? 0);
    }).finally(() => setLoading(false));
  }, [conditions, jobId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="flex items-center gap-2 font-semibold"><Eye className="h-4 w-4 text-primary" />Rule preview</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-5">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : matches.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">No existing candidates match these conditions.</p>
          ) : (
            <>
              <p className="mb-4 text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{total}</span> candidate{total !== 1 ? "s" : ""} would match this rule{total > 20 ? " (showing first 20)" : ""}.
              </p>
              <div className="space-y-2">
                {matches.map((m) => (
                  <div key={m.application_id} className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-3 py-2.5">
                    <div>
                      <p className="text-sm font-medium">{m.candidate_name}</p>
                      <p className="text-xs text-muted-foreground">{m.job_title} · <span className="capitalize">{m.stage}</span></p>
                    </div>
                    {m.match_score !== null && (
                      <span className={cn("text-xs font-bold tabular-nums",
                        m.match_score >= 70 ? "text-green-400" : m.match_score >= 50 ? "text-amber-400" : "text-rose-400")}>
                        {m.match_score}%
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Rule builder modal ────────────────────────────────────────────────────────
function RuleModal({ onSave, onClose, jobs, initialData }: {
  onSave: (rule: Partial<Rule> & { actions: ActionStep[] }) => Promise<void>;
  onClose: () => void;
  jobs: { id: string; title: string }[];
  initialData?: Partial<Template>;
}) {
  const [name, setName] = useState(initialData?.name ?? "");
  const [triggerEvent, setTriggerEvent] = useState(initialData?.trigger_event ?? "application_screened");
  const [triggerConfig, setTriggerConfig] = useState<Record<string, unknown>>(initialData?.trigger_config ?? {});
  const [conditions, setConditions] = useState<Condition[]>(
    initialData?.conditions ?? [{ field: "match_score", operator: "gte", value: 75 }]
  );
  const [actions, setActions] = useState<ActionStep[]>(
    initialData?.actions ?? [{ action: "move_stage", action_config: { stage: "screened" } }]
  );
  const [jobId, setJobId] = useState("");
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const fieldType = (field: string) => CONDITION_FIELDS.find((f) => f.value === field)?.type ?? "number";

  const updateCond = (i: number, k: keyof Condition, v: unknown) =>
    setConditions((prev) => prev.map((c, idx) => idx === i ? { ...c, [k]: v } : c));

  const updateAction = (i: number, s: ActionStep) =>
    setActions((prev) => prev.map((a, idx) => idx === i ? s : a));

  const submit = async () => {
    if (!name.trim() || conditions.length === 0 || actions.length === 0) return;
    setSaving(true);
    await onSave({
      name, trigger_event: triggerEvent, trigger_config: triggerConfig,
      conditions, actions,
      job_id: jobId || null, active: true,
      action: actions[0].action,
      action_config: actions[0].action_config,
    });
    setSaving(false);
  };

  return (
    <>
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

            {/* Trigger */}
            <div>
              <label className="mb-2 block text-sm font-medium">Trigger</label>
              <div className="grid grid-cols-2 gap-2">
                {TRIGGER_EVENTS.map((t) => {
                  const Icon = t.icon;
                  return (
                    <button key={t.value} onClick={() => setTriggerEvent(t.value)}
                      className={cn("flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium text-left transition-colors",
                        triggerEvent === t.value ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted hover:text-foreground")}>
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      {t.label}
                    </button>
                  );
                })}
              </div>
              {triggerEvent === "stale_candidate" && (
                <div className="mt-2 flex items-center gap-2">
                  <label className="text-xs text-muted-foreground whitespace-nowrap">Stale after</label>
                  <input type="number" min={1} max={60}
                    value={(triggerConfig.stale_for_days as number) ?? 7}
                    onChange={(e) => setTriggerConfig({ stale_for_days: Number(e.target.value) })}
                    className="w-16 rounded-lg border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary" />
                  <span className="text-xs text-muted-foreground">days without stage change</span>
                </div>
              )}
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
                <button onClick={() => setConditions((c) => [...c, { field: "match_score", operator: "gte", value: 75 }])}
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
                          placeholder="Kubernetes, Terraform"
                          className="flex-1 min-w-32 rounded-lg border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary" />
                      )}
                      {conditions.length > 1 && (
                        <button onClick={() => setConditions((c) => c.filter((_, idx) => idx !== i))}
                          className="ml-auto text-muted-foreground hover:text-destructive">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Actions */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-sm font-medium">THEN (actions run in order)</label>
                <button onClick={() => setActions((a) => [...a, { action: "add_tag", action_config: { tag: "" } }])}
                  className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">
                  <Plus className="h-3 w-3" /> Add action
                </button>
              </div>
              <div className="space-y-2">
                {actions.map((step, i) => (
                  <ActionStepRow key={i} step={step}
                    onChange={(s) => updateAction(i, s)}
                    onRemove={() => setActions((a) => a.filter((_, idx) => idx !== i))}
                    canRemove={actions.length > 1} />
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 border-t border-border px-5 py-4">
            <button onClick={() => setShowPreview(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
              <Eye className="h-4 w-4" /> Preview
            </button>
            <button onClick={submit} disabled={!name.trim() || saving}
              className="btn-cta inline-flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold disabled:opacity-60">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              Create rule
            </button>
          </div>
        </div>
      </div>

      {showPreview && (
        <PreviewModal
          conditions={conditions}
          jobId={jobId || null}
          onClose={() => setShowPreview(false)} />
      )}
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AgentPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [activity, setActivity] = useState<AgentAction[]>([]);
  const [weekTotal, setWeekTotal] = useState(0);
  const [jobs, setJobs] = useState<{ id: string; title: string }[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTemplate, setModalTemplate] = useState<Partial<Template> | undefined>();
  const [tab, setTab] = useState<"rules" | "templates" | "activity">("rules");
  const [expandedRules, setExpandedRules] = useState<Set<string>>(new Set());
  const [previewRule, setPreviewRule] = useState<Rule | null>(null);
  const [nlpText, setNlpText] = useState("");
  const [nlpLoading, setNlpLoading] = useState(false);
  const [installedTemplates, setInstalledTemplates] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    const [rulesRes, activityRes, jobsRes, templatesRes] = await Promise.all([
      fetch("/api/enterprise/agent/rules").then((r) => r.json()),
      fetch("/api/enterprise/agent/activity").then((r) => r.json()),
      fetch("/api/enterprise/jobs").then((r) => r.json()),
      fetch("/api/enterprise/agent/templates").then((r) => r.json()),
    ]);
    setRules(rulesRes.data ?? []);
    setActivity(activityRes.activity ?? []);
    setWeekTotal(activityRes.total_this_week ?? 0);
    setJobs((jobsRes.data ?? []).filter((j: { status: string }) => j.status === "active"));
    setTemplates(templatesRes.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const createRule = async (rule: Partial<Rule> & { actions: ActionStep[] }) => {
    await fetch("/api/enterprise/agent/rules", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rule),
    });
    setModalOpen(false);
    setModalTemplate(undefined);
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

  const installTemplate = async (t: Template) => {
    setInstalledTemplates((s) => new Set([...s, t.id]));
    await fetch("/api/enterprise/agent/rules", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: t.name, trigger_event: t.trigger_event,
        trigger_config: t.trigger_config ?? {},
        conditions: t.conditions, actions: t.actions,
        action: t.actions[0]?.action, action_config: t.actions[0]?.action_config ?? {},
        active: true,
      }),
    });
    await load();
    setTab("rules");
  };

  const generateFromNlp = async () => {
    if (!nlpText.trim()) return;
    setNlpLoading(true);
    const res = await fetch("/api/enterprise/agent/from-text", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: nlpText }),
    });
    const { rule } = await res.json();
    setNlpLoading(false);
    if (rule) {
      setModalTemplate(rule);
      setModalOpen(true);
      setNlpText("");
    }
  };

  const toggleExpand = (id: string) =>
    setExpandedRules((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const activeCount = rules.filter((r) => r.active).length;

  const triggerLabel = (event: string) => TRIGGER_EVENTS.find((t) => t.value === event)?.label ?? event;

  const ruleActions = (rule: Rule): ActionStep[] =>
    Array.isArray(rule.actions) && rule.actions.length > 0
      ? rule.actions
      : [{ action: rule.action, action_config: rule.action_config ?? {} }];

  if (loading) return (
    <main className="flex flex-1 items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </main>
  );

  return (
    <main className="flex-1 overflow-y-auto px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-4xl space-y-6">

        {/* Header */}
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
          <button onClick={() => { setModalTemplate(undefined); setModalOpen(true); }}
            className="btn-cta inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold">
            <Plus className="h-4 w-4" /> New rule
          </button>
        </div>

        {/* NLP input bar */}
        <div className="flex items-center gap-2 rounded-2xl border border-border bg-card p-3">
          <Wand2 className="h-4 w-4 shrink-0 text-purple-400" />
          <input
            value={nlpText}
            onChange={(e) => setNlpText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && generateFromNlp()}
            placeholder="Describe a rule in plain English — e.g. &quot;Auto-reject anyone below 30% match and send an email&quot;"
            className="flex-1 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none" />
          <button
            onClick={generateFromNlp}
            disabled={!nlpText.trim() || nlpLoading}
            className="inline-flex items-center gap-1.5 rounded-xl bg-purple-500/20 px-3 py-1.5 text-xs font-semibold text-purple-400 hover:bg-purple-500/30 disabled:opacity-50 transition-colors">
            {nlpLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            Generate
          </button>
        </div>

        {/* Stats */}
        <div className="grid gap-3 sm:grid-cols-4">
          {[
            { label: "Active rules",      value: activeCount,    color: activeCount > 0 ? "text-green-400" : "" },
            { label: "Actions this week", value: weekTotal,      color: weekTotal > 0 ? "text-primary" : "" },
            { label: "Total rules",       value: rules.length,   color: "" },
            { label: "Triggers wired",    value: 4,              color: "text-purple-400", sub: "screening · interview · stage · stale" },
          ].map(({ label, value, color, sub }) => (
            <div key={label} className="rounded-2xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className={cn("mt-1 text-2xl font-bold tabular-nums", color)}>{value}</p>
              {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 rounded-xl border border-border bg-card p-1">
          {([
            { key: "rules",     label: `Rules (${rules.length})` },
            { key: "templates", label: `Templates (${templates.length})` },
            { key: "activity",  label: `Activity (${activity.length})` },
          ] as const).map(({ key, label }) => (
            <button key={key} onClick={() => setTab(key)}
              className={cn("flex-1 rounded-lg py-1.5 text-sm font-medium transition-colors",
                tab === key ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground")}>
              {label}
            </button>
          ))}
        </div>

        {/* Rules tab */}
        {tab === "rules" && (
          <div className="space-y-3">
            {rules.length === 0 && (
              <div className="rounded-2xl border border-dashed border-border p-12 text-center">
                <Bot className="mx-auto h-10 w-10 text-muted-foreground/50 mb-3" />
                <p className="font-medium">No rules yet</p>
                <p className="mt-1 text-sm text-muted-foreground">Browse templates or describe a rule above to get started.</p>
              </div>
            )}
            {rules.map((rule) => {
              const expanded = expandedRules.has(rule.id);
              const steps = ruleActions(rule);
              const actionMeta = ACTIONS.find((a) => a.value === rule.action);
              const ActionIcon = actionMeta?.icon ?? Settings2;

              return (
                <div key={rule.id} className="rounded-2xl border border-border bg-card">
                  <div className="flex items-start gap-3 p-4">
                    <div className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted", actionMeta?.color)}>
                      <ActionIcon className={cn("h-4 w-4", actionMeta?.color)} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{rule.name}</p>
                        <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                          {triggerLabel(rule.trigger_event)}
                          {rule.trigger_event === "stale_candidate" && !!rule.trigger_config?.stale_for_days && ` · ${rule.trigger_config.stale_for_days as number}d`}
                        </span>
                        {rule.job && (
                          <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                            {rule.job.title}
                          </span>
                        )}
                        {steps.length > 1 && (
                          <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-[10px] font-medium text-purple-400">
                            {steps.length} actions
                          </span>
                        )}
                      </div>

                      <p className="mt-1 text-xs text-muted-foreground">
                        IF {rule.conditions.map((c) => {
                          const fieldLabel = CONDITION_FIELDS.find((f) => f.value === c.field)?.label ?? c.field;
                          const op = Object.values(OPERATORS_BY_TYPE).flat().find((o) => o.value === c.operator)?.label ?? c.operator;
                          const val = Array.isArray(c.value) ? (c.value as string[]).join(", ") : String(c.value);
                          return `${fieldLabel} ${op} ${val}`;
                        }).join(" AND ")}
                        {" → "}
                        {steps.map((s) => ACTION_LABEL[s.action] ?? s.action).join(", ")}
                        {steps.length === 1 && steps[0].action === "move_stage" && !!steps[0].action_config.stage && ` (${steps[0].action_config.stage as string})`}
                        {steps.length === 1 && steps[0].action === "add_tag" && !!steps[0].action_config.tag && ` "${steps[0].action_config.tag as string}"`}
                      </p>

                      {rule.run_count > 0 && (
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          Triggered {rule.run_count} time{rule.run_count !== 1 ? "s" : ""}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => setPreviewRule(rule)}
                        className="text-muted-foreground hover:text-foreground transition-colors" title="Preview matching candidates">
                        <Eye className="h-4 w-4" />
                      </button>
                      <button onClick={() => toggleRule(rule.id, !rule.active)}
                        className="text-muted-foreground hover:text-foreground transition-colors">
                        {rule.active
                          ? <ToggleRight className="h-5 w-5 text-green-400" />
                          : <ToggleLeft className="h-5 w-5" />}
                      </button>
                      <button onClick={() => toggleExpand(rule.id)}
                        className="text-muted-foreground hover:text-foreground transition-colors">
                        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </button>
                      <button onClick={() => deleteRule(rule.id)}
                        className="text-muted-foreground hover:text-destructive transition-colors">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {expanded && steps.length > 1 && (
                    <div className="border-t border-border px-4 py-3 space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Actions:</p>
                      {steps.map((s, i) => {
                        const meta = ACTIONS.find((a) => a.value === s.action);
                        const Icon2 = meta?.icon ?? Settings2;
                        return (
                          <div key={i} className="flex items-center gap-2 text-xs">
                            <span className="text-muted-foreground">{i + 1}.</span>
                            <Icon2 className={cn("h-3.5 w-3.5 shrink-0", meta?.color)} />
                            <span>{meta?.label ?? s.action}</span>
                            {s.action === "move_stage" && !!s.action_config.stage && <span className="text-muted-foreground">→ {s.action_config.stage as string}</span>}
                            {s.action === "add_tag" && !!s.action_config.tag && <span className="text-muted-foreground">"{s.action_config.tag as string}"</span>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Templates tab */}
        {tab === "templates" && (
          <div className="grid gap-4 sm:grid-cols-2">
            {templates.map((t) => {
              const isInstalled = installedTemplates.has(t.id) ||
                rules.some((r) => r.name === t.name);
              const TriggerIcon = TRIGGER_EVENTS.find((te) => te.value === t.trigger_event)?.icon ?? Sparkles;
              return (
                <div key={t.id} className="rounded-2xl border border-border bg-card p-5 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <TriggerIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <p className="font-semibold text-sm">{t.name}</p>
                    </div>
                    <span className="shrink-0 rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] text-muted-foreground whitespace-nowrap">
                      {TRIGGER_EVENTS.find((te) => te.value === t.trigger_event)?.label ?? t.trigger_event}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{t.description}</p>
                  <div className="flex flex-wrap gap-1">
                    {t.actions.map((a, i) => {
                      const meta = ACTIONS.find((ac) => ac.value === a.action);
                      const Icon = meta?.icon ?? Settings2;
                      return (
                        <span key={i} className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2 py-0.5 text-[10px]">
                          <Icon className={cn("h-2.5 w-2.5", meta?.color)} />
                          {meta?.label ?? a.action}
                        </span>
                      );
                    })}
                  </div>
                  <div className="flex gap-2 mt-auto">
                    <button onClick={() => { setModalTemplate(t); setModalOpen(true); }}
                      className="flex-1 rounded-xl border border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                      Customize
                    </button>
                    <button onClick={() => installTemplate(t)} disabled={isInstalled}
                      className={cn("flex-1 rounded-xl px-3 py-2 text-xs font-semibold transition-colors",
                        isInstalled
                          ? "bg-green-500/10 text-green-400 cursor-default"
                          : "btn-cta")}>
                      {isInstalled ? <><CheckCircle2 className="inline h-3 w-3 mr-1" />Installed</> : "Install"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Activity tab */}
        {tab === "activity" && (
          <div className="space-y-2">
            {activity.length === 0 && (
              <p className="py-12 text-center text-sm text-muted-foreground">No activity yet — rules will log here after firing.</p>
            )}
            {activity.map((a) => {
              const Icon = RESULT_ICON[a.result] ?? AlertTriangle;
              return (
                <div key={a.id} className="flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-3">
                  <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", RESULT_COLOR[a.result])} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      <span className="font-medium">{a.candidate_name}</span>
                      <span className="mx-1 text-muted-foreground">·</span>
                      <span className="text-muted-foreground">{a.job_title}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {ACTION_LABEL[a.action] ?? a.action} via <span className="text-foreground">{a.rule_name}</span>
                    </p>
                  </div>
                  <p className="shrink-0 text-[11px] text-muted-foreground">
                    {new Date(a.created_at).toLocaleDateString()}
                  </p>
                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* Rule builder modal */}
      {modalOpen && (
        <RuleModal
          onSave={createRule}
          onClose={() => { setModalOpen(false); setModalTemplate(undefined); }}
          jobs={jobs}
          initialData={modalTemplate} />
      )}

      {/* Inline preview modal */}
      {previewRule && (
        <PreviewModal
          conditions={previewRule.conditions}
          jobId={previewRule.job_id}
          onClose={() => setPreviewRule(null)} />
      )}
    </main>
  );
}

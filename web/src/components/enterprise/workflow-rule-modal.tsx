"use client";

import { useState, useEffect } from "react";
import { X, Loader2, Zap, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Rule = {
  id: string;
  name: string;
  active: boolean;
  trigger_type: string;
  trigger_stage: string | null;
  action_type: string;
  action_config: Record<string, unknown>;
};

interface Props {
  rule?: Rule | null;
  onClose: () => void;
  onSaved: () => void;
}

const TRIGGER_OPTIONS = [
  { value: "stage_change", label: "Stage changes to…" },
  { value: "application_created", label: "New application received" },
  { value: "offer_signed", label: "Candidate signs offer" },
  { value: "offer_declined", label: "Candidate declines offer" },
];

const STAGE_OPTIONS = [
  { value: "applied", label: "Applied" },
  { value: "screened", label: "Screened" },
  { value: "interview", label: "Interview" },
  { value: "offer", label: "Offer" },
  { value: "hired", label: "Hired" },
  { value: "rejected", label: "Rejected" },
];

const ACTION_OPTIONS = [
  { value: "send_candidate_email", label: "Send email to candidate" },
  { value: "send_team_notification", label: "Notify team members" },
  { value: "assign_to", label: "Assign application to…" },
  { value: "move_stage", label: "Move to stage…" },
  { value: "add_tag", label: "Add tag…" },
];

export default function WorkflowRuleModal({ rule, onClose, onSaved }: Props) {
  const isEdit = !!rule;

  const [name, setName] = useState(rule?.name ?? "");
  const [triggerType, setTriggerType] = useState(rule?.trigger_type ?? "stage_change");
  const [triggerStage, setTriggerStage] = useState(rule?.trigger_stage ?? "interview");
  const [actionType, setActionType] = useState(rule?.action_type ?? "send_candidate_email");
  const [actionConfig, setActionConfig] = useState<Record<string, unknown>>(rule?.action_config ?? {});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Reset config when action type changes
  useEffect(() => {
    if (!isEdit) setActionConfig({});
  }, [actionType, isEdit]);

  const setCfg = (key: string, value: unknown) =>
    setActionConfig((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    if (!name.trim()) { setError("Rule name is required."); return; }
    if (actionType === "send_candidate_email" && !(actionConfig.subject as string)?.trim()) {
      setError("Email subject is required."); return;
    }
    if (actionType === "send_team_notification") {
      const emails = (actionConfig.notify_emails as string[]) ?? [];
      if (!emails.length) { setError("Add at least one notification email."); return; }
    }
    if (actionType === "move_stage" && !actionConfig.stage) {
      setError("Select a target stage."); return;
    }
    if (actionType === "add_tag" && !(actionConfig.tag as string)?.trim()) {
      setError("Tag name is required."); return;
    }

    setSaving(true);
    setError("");

    const payload = {
      name: name.trim(),
      trigger_type: triggerType,
      trigger_stage: triggerType === "stage_change" ? triggerStage : null,
      action_type: actionType,
      action_config: actionConfig,
    };

    const res = isEdit
      ? await fetch(`/api/enterprise/workflows/${rule.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      : await fetch("/api/enterprise/workflows", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

    const j = await res.json();
    if (res.ok) onSaved();
    else setError(j.error ?? "Failed to save.");
    setSaving(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col rounded-2xl border border-border bg-card shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2.5">
            <Zap className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">{isEdit ? "Edit Workflow Rule" : "New Workflow Rule"}</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {error && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
              {error}
            </div>
          )}

          {/* Rule name */}
          <div>
            <label className="label-xs">Rule name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-field mt-1"
              placeholder="e.g. Notify team when candidate moves to interview"
            />
          </div>

          {/* Trigger */}
          <div className="rounded-xl border border-border bg-background/40 p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">When…</p>
            <div>
              <label className="label-xs">Trigger</label>
              <select
                value={triggerType}
                onChange={(e) => setTriggerType(e.target.value)}
                className="input-field mt-1"
              >
                {TRIGGER_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            {triggerType === "stage_change" && (
              <div>
                <label className="label-xs">Stage</label>
                <select
                  value={triggerStage}
                  onChange={(e) => setTriggerStage(e.target.value)}
                  className="input-field mt-1"
                >
                  {STAGE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Action */}
          <div className="rounded-xl border border-border bg-background/40 p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Then…</p>
            <div>
              <label className="label-xs">Action</label>
              <select
                value={actionType}
                onChange={(e) => setActionType(e.target.value)}
                className="input-field mt-1"
              >
                {ACTION_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* Action-specific config */}
            {actionType === "send_candidate_email" && (
              <div className="space-y-3">
                <div>
                  <label className="label-xs">Email subject</label>
                  <input
                    value={(actionConfig.subject as string) ?? ""}
                    onChange={(e) => setCfg("subject", e.target.value)}
                    className="input-field mt-1"
                    placeholder="Update on your application for {{job_title}}"
                  />
                </div>
                <div>
                  <label className="label-xs">Email body (HTML)</label>
                  <textarea
                    value={(actionConfig.body as string) ?? ""}
                    onChange={(e) => setCfg("body", e.target.value)}
                    rows={5}
                    className="input-field mt-1 resize-y text-xs font-mono"
                    placeholder={`<p>Hi {{name}},</p>\n<p>We've moved your application for <strong>{{job_title}}</strong> at <strong>{{org_name}}</strong> to the next stage.</p>`}
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground/60">
                    Variables: <code className="text-[10px]">{"{{name}}"}</code>{" "}
                    <code className="text-[10px]">{"{{job_title}}"}</code>{" "}
                    <code className="text-[10px]">{"{{org_name}}"}</code>{" "}
                    <code className="text-[10px]">{"{{stage}}"}</code>
                  </p>
                </div>
              </div>
            )}

            {actionType === "send_team_notification" && (
              <div className="space-y-3">
                <EmailListInput
                  label="Notify these emails"
                  values={(actionConfig.notify_emails as string[]) ?? []}
                  onChange={(v) => setCfg("notify_emails", v)}
                />
                <div>
                  <label className="label-xs">Message template</label>
                  <input
                    value={(actionConfig.message as string) ?? ""}
                    onChange={(e) => setCfg("message", e.target.value)}
                    className="input-field mt-1"
                    placeholder="{{candidate_name}} moved to {{stage}} for {{job_title}}"
                  />
                  <p className="mt-1 text-[11px] text-muted-foreground/60">
                    Variables: <code className="text-[10px]">{"{{candidate_name}}"}</code>{" "}
                    <code className="text-[10px]">{"{{stage}}"}</code>{" "}
                    <code className="text-[10px]">{"{{job_title}}"}</code>
                  </p>
                </div>
              </div>
            )}

            {actionType === "assign_to" && (
              <div>
                <label className="label-xs">Assign to (user ID or email)</label>
                <input
                  value={(actionConfig.user_id as string) ?? ""}
                  onChange={(e) => setCfg("user_id", e.target.value)}
                  className="input-field mt-1"
                  placeholder="Clerk user ID or recruiter email"
                />
                <p className="mt-1 text-[11px] text-muted-foreground/60">
                  Find user IDs in Team &amp; Access settings.
                </p>
              </div>
            )}

            {actionType === "move_stage" && (
              <div>
                <label className="label-xs">Move application to</label>
                <select
                  value={(actionConfig.stage as string) ?? ""}
                  onChange={(e) => setCfg("stage", e.target.value)}
                  className="input-field mt-1"
                >
                  <option value="">Select a stage…</option>
                  {STAGE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            )}

            {actionType === "add_tag" && (
              <div>
                <label className="label-xs">Tag to add</label>
                <input
                  value={(actionConfig.tag as string) ?? ""}
                  onChange={(e) => setCfg("tag", e.target.value)}
                  className="input-field mt-1"
                  placeholder="e.g. fast-track, follow-up"
                />
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-4">
          <button
            onClick={onClose}
            className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-cta inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-60"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? "Save Changes" : "Create Rule"}
          </button>
        </div>
      </div>
    </div>
  );
}

function EmailListInput({
  label,
  values,
  onChange,
}: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const email = draft.trim().toLowerCase();
    if (!email || values.includes(email)) return;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return;
    onChange([...values, email]);
    setDraft("");
  };

  return (
    <div>
      <label className="label-xs">{label}</label>
      <div className="mt-1 flex flex-wrap gap-1.5 rounded-xl border border-border bg-background p-2">
        {values.map((e) => (
          <span
            key={e}
            className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2 py-0.5 text-xs text-primary"
          >
            {e}
            <button
              onClick={() => onChange(values.filter((x) => x !== e))}
              className="ml-0.5 text-primary/60 hover:text-primary"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); }
          }}
          placeholder="Add email, press Enter"
          className="min-w-[160px] flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/50"
        />
        <button
          onClick={add}
          className={cn(
            "rounded-md p-0.5",
            draft.trim() ? "text-primary hover:bg-primary/10" : "text-muted-foreground/30",
          )}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

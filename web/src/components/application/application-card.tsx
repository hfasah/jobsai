"use client";

import { useState } from "react";
import Link from "next/link";
import { Building2, CalendarClock, ExternalLink, Loader2, Pencil, Trash2, FileText, Mail, Zap, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Application, UpdateApplicationBody } from "@/types/application";

function scoreColor(score: number) {
  return score >= 75
    ? "text-green-600 bg-green-100"
    : score >= 50
      ? "text-yellow-700 bg-yellow-100"
      : "text-red-600 bg-red-100";
}

export function ApplicationCard({
  application,
  onUpdate,
  onDelete,
  onDragStart,
  dragging,
  selectable = false,
  selected = false,
  onSelect,
  applying = false,
  applied = false,
  onApply,
}: {
  application: Application;
  onUpdate: (id: string, body: UpdateApplicationBody) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onDragStart: (id: string) => void;
  dragging: boolean;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (id: string, checked: boolean) => void;
  applying?: boolean;
  applied?: boolean;
  onApply?: (jobId: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState(application.notes ?? "");
  const [nextAction, setNextAction] = useState(application.next_action ?? "");
  const [nextDate, setNextDate] = useState(application.next_action_date ?? "");
  const [saving, setSaving] = useState(false);

  const job = application.job;

  const save = async () => {
    setSaving(true);
    try {
      await onUpdate(application.id, {
        notes: notes.trim() || null,
        next_action: nextAction.trim() || null,
        next_action_date: nextDate || null,
      });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      draggable={!editing && !selectable}
      onDragStart={() => onDragStart(application.id)}
      className={cn(
        "rounded-xl border bg-card p-3 text-sm shadow-sm transition-all",
        !editing && !selectable && "cursor-grab active:cursor-grabbing hover:shadow-md",
        dragging && "opacity-40",
        selected ? "border-primary ring-1 ring-primary" : "border-border",
        applied && "border-desyn-success/40 bg-desyn-success/5",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        {/* Checkbox for selection mode */}
        {selectable && (
          <button
            onClick={() => onSelect?.(application.job_id, !selected)}
            className={cn(
              "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-colors",
              selected ? "border-primary bg-primary" : "border-border bg-background"
            )}
          >
            {selected && <span className="text-[9px] font-bold text-white">✓</span>}
          </button>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium leading-tight">
            {job?.title ?? "Untitled role"}
          </p>
          {job?.company && (
            <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
              <Building2 className="h-3 w-3 shrink-0" />
              {job.company}
            </p>
          )}
        </div>
        {(job?.match_score != null || job?.ai_score != null) && (
          <div className="flex shrink-0 items-center gap-1">
            {job?.match_score != null && (
              <span className={cn("rounded-full px-2 py-0.5 text-xs font-bold", scoreColor(job.match_score))}>
                {job.match_score}
              </span>
            )}
            {job?.ai_score != null && (
              <>
                <span className="text-xs text-muted-foreground">→</span>
                <span className={cn("rounded-full px-2 py-0.5 text-xs font-bold", scoreColor(job.ai_score))} title="AI-tailored score">
                  {job.ai_score}
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {!editing && (job?.has_tailored || job?.has_cover) && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {job?.has_tailored && (
            <Link href={`/dashboard/jobs/${application.job_id}`} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary hover:bg-primary/20">
              <FileText className="h-3 w-3" /> Tailored résumé
            </Link>
          )}
          {job?.has_cover && (
            <Link href={`/dashboard/jobs/${application.job_id}`} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary hover:bg-primary/20">
              <Mail className="h-3 w-3" /> Cover letter
            </Link>
          )}
        </div>
      )}

      {!editing && application.next_action && (
        <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-muted/60 px-2 py-1.5 text-xs text-muted-foreground">
          <CalendarClock className="mt-0.5 h-3 w-3 shrink-0" />
          <span className="min-w-0">
            {application.next_action}
            {application.next_action_date && (
              <span className="ml-1 font-medium text-foreground">
                · {new Date(application.next_action_date).toLocaleDateString()}
              </span>
            )}
          </span>
        </div>
      )}

      {!editing && application.notes && (
        <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{application.notes}</p>
      )}

      {editing && (
        <div className="mt-3 space-y-2">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes…"
            rows={3}
            className="w-full rounded-lg border border-border bg-background p-2 text-xs outline-none focus:border-primary"
          />
          <input
            value={nextAction}
            onChange={(e) => setNextAction(e.target.value)}
            placeholder="Next action (e.g. Follow up)"
            className="w-full rounded-lg border border-border bg-background p-2 text-xs outline-none focus:border-primary"
          />
          <input
            type="date"
            value={nextDate}
            onChange={(e) => setNextDate(e.target.value)}
            className="w-full rounded-lg border border-border bg-background p-2 text-xs outline-none focus:border-primary"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={save} disabled={saving} className="flex-1">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(false)} disabled={saving}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Applied status badge */}
      {applied && (
        <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-desyn-success">
          <CheckCircle2 className="h-3.5 w-3.5" /> Agent submitted
        </div>
      )}
      {applying && (
        <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-primary">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Applying…
        </div>
      )}

      {!editing && (
        <div className="mt-2.5 flex items-center justify-between border-t border-border/60 pt-2">
          <Link
            href={`/dashboard/jobs/${application.job_id}`}
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            View job
          </Link>
          <div className="flex items-center gap-1">
            {/* Per-card apply button — only for saved stage */}
            {onApply && !applied && !applying && (
              <button
                onClick={() => onApply(application.job_id)}
                className="inline-flex items-center gap-1 rounded-lg bg-[#f5c518] px-2 py-1 text-[11px] font-semibold text-black hover:opacity-90 transition-opacity"
                title="Agent Apply"
              >
                <Zap className="h-3 w-3" /> Apply
              </button>
            )}
            <button
              onClick={() => setEditing(true)}
              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Edit"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => onDelete(application.id)}
              className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
              aria-label="Remove from tracker"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

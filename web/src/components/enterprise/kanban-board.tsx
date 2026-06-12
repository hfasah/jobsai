"use client";

import { useState } from "react";
import { Sparkles, Loader2, GripVertical, ChevronRight, Mic, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EnterpriseApplication, AppStage } from "@/types/enterprise";
import { STAGE_LABELS, STAGE_COLORS } from "@/types/enterprise";

const ALL_STAGES: AppStage[] = ["applied", "screened", "interview", "offer", "hired", "rejected"];

const STAGE_ACCENT: Record<AppStage, string> = {
  applied:   "bg-slate-500",
  screened:  "bg-blue-500",
  interview: "bg-violet-500",
  offer:     "bg-amber-500",
  hired:     "bg-green-500",
  rejected:  "bg-red-500",
};

const AVATAR_GRADIENTS = [
  "from-violet-500 to-purple-600",
  "from-blue-500 to-cyan-600",
  "from-amber-500 to-orange-600",
  "from-emerald-500 to-teal-600",
  "from-pink-500 to-rose-600",
  "from-indigo-500 to-blue-600",
];

const REC_BADGE: Record<string, string> = {
  strong_yes: "bg-green-500/20 text-green-400 border-green-500/30",
  yes:        "bg-blue-500/20 text-blue-400 border-blue-500/30",
  maybe:      "bg-amber-500/20 text-amber-400 border-amber-500/30",
  no:         "bg-red-500/20 text-red-400 border-red-500/30",
};

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

function avatarGradient(name: string) {
  const hash = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length];
}

function scoreColor(n: number) {
  return n >= 75 ? "text-green-400" : n >= 50 ? "text-amber-400" : "text-red-400";
}

// ── Kanban card ───────────────────────────────────────────────────────────────
function KanbanCard({
  app, screening, isDragging, onDragStart, onDragEnd, onScreen, onReport, onVoiceScreen, onSendOffer,
}: {
  app: EnterpriseApplication;
  screening: boolean;
  isDragging: boolean;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onScreen: (id: string) => void;
  onReport: (app: EnterpriseApplication) => void;
  onVoiceScreen: (app: EnterpriseApplication) => void;
  onSendOffer: (app: EnterpriseApplication) => void;
}) {
  return (
    <div
      draggable
      onDragStart={() => onDragStart(app.id)}
      onDragEnd={onDragEnd}
      className={cn(
        "group relative rounded-xl border bg-card p-3 cursor-grab active:cursor-grabbing select-none transition-all",
        isDragging
          ? "opacity-40 scale-95 border-primary/60 shadow-glow"
          : "border-border hover:border-primary/30 hover:shadow-soft",
      )}
    >
      {/* Drag handle — shows on hover */}
      <GripVertical className="absolute right-2 top-2 h-3.5 w-3.5 text-muted-foreground/40 opacity-0 transition-opacity group-hover:opacity-100" />

      {/* Avatar + name + score */}
      <div className="flex items-start gap-2.5">
        <div className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[11px] font-bold text-white shadow-sm",
          avatarGradient(app.candidate_name),
        )}>
          {initials(app.candidate_name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1">
            <p className="truncate text-sm font-semibold leading-tight">{app.candidate_name}</p>
            {app.match_score !== null && (
              <span className={cn("shrink-0 text-xs font-bold tabular-nums", scoreColor(app.match_score))}>
                {app.match_score}%
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{app.candidate_email}</p>
        </div>
      </div>

      {/* AI summary snippet */}
      {app.ai_summary && (
        <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
          {app.ai_summary}
        </p>
      )}

      {/* Badges */}
      {(app.ai_recommendation || app.tags.length > 0 || app.is_duplicate) && (
        <div className="mt-2 flex flex-wrap gap-1">
          {app.ai_recommendation && (
            <span className={cn("rounded-full border px-1.5 py-0.5 text-[10px] font-medium capitalize", REC_BADGE[app.ai_recommendation])}>
              {app.ai_recommendation.replace("_", " ")}
            </span>
          )}
          {app.tags.slice(0, 2).map((t) => (
            <span key={t} className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">{t}</span>
          ))}
          {app.is_duplicate && (
            <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] text-amber-400">dup</span>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="mt-2.5 flex items-center gap-1.5 border-t border-border/50 pt-2">
        {!app.screened_at ? (
          <button
            onClick={(e) => { e.stopPropagation(); onScreen(app.id); }}
            disabled={screening}
            className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary hover:bg-primary/20 disabled:opacity-50"
          >
            {screening
              ? <Loader2 className="h-2.5 w-2.5 animate-spin" />
              : <Sparkles className="h-2.5 w-2.5" />}
            AI Screen
          </button>
        ) : (
          <span className="text-[10px] text-muted-foreground">Screened</span>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onVoiceScreen(app); }}
          className={cn(
            "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium",
            (app as unknown as Record<string, unknown>).voice_screen_status === "complete"
              ? "bg-green-500/10 text-green-400 hover:bg-green-500/20"
              : "bg-muted text-muted-foreground hover:text-foreground",
          )}
        >
          <Mic className="h-2.5 w-2.5" />
          {(app as unknown as Record<string, unknown>).voice_screen_status === "complete" ? "Voice ✓" : "Voice"}
        </button>
        {["offer", "hired"].includes(app.stage) && (
          <button
            onClick={(e) => { e.stopPropagation(); onSendOffer(app); }}
            className="inline-flex items-center gap-1 rounded-md bg-blue-500/10 px-2 py-1 text-[10px] font-medium text-blue-400 hover:bg-blue-500/20"
          >
            <FileText className="h-2.5 w-2.5" /> Offer
          </button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onReport(app); }}
          className="ml-auto inline-flex items-center gap-0.5 rounded-md px-2 py-1 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          View <ChevronRight className="h-2.5 w-2.5" />
        </button>
      </div>
    </div>
  );
}

// ── Kanban board ──────────────────────────────────────────────────────────────
export interface KanbanBoardProps {
  apps: EnterpriseApplication[];
  onMove: (id: string, stage: AppStage) => void;
  onScreen: (id: string) => void;
  screeningIds: Set<string>;
  onReport: (app: EnterpriseApplication) => void;
  onVoiceScreen: (app: EnterpriseApplication) => void;
  onSendOffer?: (app: EnterpriseApplication) => void;
}

export function KanbanBoard({ apps, onMove, onScreen, screeningIds, onReport, onVoiceScreen, onSendOffer }: KanbanBoardProps) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<AppStage | null>(null);

  const byStage = (stage: AppStage) =>
    apps.filter((a) => a.stage === stage).sort((a, b) => (b.match_score ?? 0) - (a.match_score ?? 0));

  const handleDrop = (stage: AppStage) => {
    if (draggedId) {
      const app = apps.find((a) => a.id === draggedId);
      if (app && app.stage !== stage) onMove(draggedId, stage);
    }
    setDraggedId(null);
    setOverStage(null);
  };

  const total = apps.filter((a) => a.stage !== "rejected").length;

  return (
    <div className="flex-1 overflow-x-auto">
      <div className="inline-flex min-h-[calc(100vh-220px)] min-w-full gap-3 p-4 sm:p-6 pb-10">
        {ALL_STAGES.map((stage) => {
          const stageApps = byStage(stage);
          const isOver = overStage === stage;
          const isRejected = stage === "rejected";
          const pct = total > 0 && !isRejected ? Math.round((stageApps.length / total) * 100) : 0;

          return (
            <div
              key={stage}
              className={cn("flex w-[252px] shrink-0 flex-col", isRejected && "opacity-70")}
              onDragOver={(e) => { e.preventDefault(); setOverStage(stage); }}
              onDragLeave={(e) => {
                // Only clear if leaving the column entirely
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverStage(null);
              }}
              onDrop={() => handleDrop(stage)}
            >
              {/* Column header */}
              <div className={cn(
                "mb-2 rounded-xl border px-3 py-2.5 transition-colors",
                isOver ? "border-primary/50 bg-primary/5" : "border-border/60 bg-card/50",
              )}>
                <div className="flex items-center justify-between">
                  <span className={cn("rounded-full border px-2.5 py-0.5 text-xs font-semibold", STAGE_COLORS[stage])}>
                    {STAGE_LABELS[stage]}
                  </span>
                  <span className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold",
                    stageApps.length > 0 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                  )}>
                    {stageApps.length}
                  </span>
                </div>
                {/* Stage fill bar */}
                {!isRejected && (
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn("h-full rounded-full transition-all duration-500", STAGE_ACCENT[stage])}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                )}
              </div>

              {/* Cards + drop zone */}
              <div className={cn(
                "flex-1 min-h-[80px] space-y-2 rounded-xl p-2 transition-colors",
                isOver && "bg-primary/5 ring-2 ring-dashed ring-primary/30",
              )}>
                {stageApps.map((app) => (
                  <KanbanCard
                    key={app.id}
                    app={app}
                    screening={screeningIds.has(app.id)}
                    isDragging={draggedId === app.id}
                    onDragStart={setDraggedId}
                    onDragEnd={() => setDraggedId(null)}
                    onScreen={onScreen}
                    onReport={onReport}
                    onVoiceScreen={onVoiceScreen}
                    onSendOffer={onSendOffer ?? (() => {})}
                  />
                ))}

                {stageApps.length === 0 && (
                  <div className={cn(
                    "rounded-xl border border-dashed px-3 py-8 text-center text-xs transition-colors",
                    isOver
                      ? "border-primary/50 bg-primary/5 text-primary"
                      : "border-border/50 text-muted-foreground",
                  )}>
                    {isOver ? "Drop here" : "No candidates"}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

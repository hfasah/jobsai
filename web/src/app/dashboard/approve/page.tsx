"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, Check, X, ExternalLink, Loader2,
  ClipboardList, Zap, Settings2, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/layout/site-header";
import { cn } from "@/lib/utils";
import type { PendingApprovalItem } from "@/app/api/approvals/route";

// ─── Types ────────────────────────────────────────────────────────────────────

type ItemState = "pending" | "approving" | "approved" | "rejected" | "failed";

interface ApprovalCard extends PendingApprovalItem {
  uiState: ItemState;
  resultMsg?: string;
}

// ─── Score badge ──────────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 80 ? "bg-desyn-success/10 text-desyn-success border-desyn-success/20" :
    score >= 65 ? "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/40" :
                  "bg-muted text-muted-foreground border-border";
  return (
    <span className={cn("rounded-full border px-2.5 py-0.5 text-xs font-bold tabular-nums", color)}>
      {score}%
    </span>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────

function ApprovalCardView({
  card,
  onApprove,
  onReject,
}: {
  card: ApprovalCard;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const isDone = card.uiState === "approved" || card.uiState === "rejected" || card.uiState === "failed";

  return (
    <div className={cn(
      "rounded-2xl border bg-card transition-all",
      isDone ? "opacity-60 border-border" :
      card.uiState === "approving" ? "border-primary/40 shadow-sm" :
      "border-border hover:shadow-sm"
    )}>
      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="font-semibold leading-snug">{card.title ?? "Untitled role"}</p>
            {card.company && (
              <p className="mt-0.5 text-sm text-muted-foreground">{card.company}</p>
            )}
          </div>
          <ScoreBadge score={card.match_score} />
        </div>

        {/* Meta */}
        <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
          {card.location && <span>{card.location}</span>}
          {card.employment_type && <span className="capitalize">{card.employment_type}</span>}
        </div>

        {/* Skills */}
        {card.skills.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1">
            {card.skills.slice(0, 6).map((s, i) => (
              <span key={i} className="rounded-full bg-muted px-2 py-0.5 text-xs">{s}</span>
            ))}
            {card.skills.length > 6 && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                +{card.skills.length - 6}
              </span>
            )}
          </div>
        )}

        {/* Result message */}
        {card.resultMsg && (
          <p className={cn(
            "mt-2 text-xs",
            card.uiState === "approved" ? "text-desyn-success" :
            card.uiState === "failed"   ? "text-destructive"   : "text-muted-foreground"
          )}>
            {card.resultMsg}
          </p>
        )}
      </div>

      {/* Actions */}
      {!isDone && (
        <div className="flex items-center gap-2 border-t border-border/60 px-5 py-3">
          <Button
            size="sm"
            className="flex-1 gap-1.5"
            onClick={() => onApprove(card.id)}
            disabled={card.uiState === "approving"}
          >
            {card.uiState === "approving"
              ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Applying…</>
              : <><Check className="h-3.5 w-3.5" />Approve &amp; Apply</>}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/5"
            onClick={() => onReject(card.id)}
            disabled={card.uiState === "approving"}
          >
            <X className="h-3.5 w-3.5" />
            Skip
          </Button>
          {card.source_url && (
            <a
              href={card.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center rounded-lg border border-border px-2.5 py-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      )}

      {isDone && (
        <div className={cn(
          "flex items-center gap-1.5 border-t px-5 py-2.5 text-xs font-medium",
          card.uiState === "approved" ? "border-desyn-success/20 text-desyn-success" :
          card.uiState === "failed"   ? "border-destructive/20 text-destructive" :
                                        "border-border text-muted-foreground"
        )}>
          {card.uiState === "approved" && <><Check className="h-3.5 w-3.5" /> Applied</>}
          {card.uiState === "rejected" && <><X className="h-3.5 w-3.5" /> Skipped</>}
          {card.uiState === "failed"   && <><X className="h-3.5 w-3.5" /> Apply failed</>}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ApprovePage() {
  const [cards, setCards] = useState<ApprovalCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [bulkState, setBulkState] = useState<"idle" | "running">("idle");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/approvals");
    const json = await res.json();
    setCards((json.data ?? []).map((item: PendingApprovalItem) => ({ ...item, uiState: "pending" as ItemState })));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const approve = useCallback(async (id: string) => {
    setCards((prev) => prev.map((c) => c.id === id ? { ...c, uiState: "approving" } : c));
    const res = await fetch(`/api/approvals/${id}/approve`, { method: "POST" });
    const json = await res.json();
    setCards((prev) => prev.map((c) => {
      if (c.id !== id) return c;
      if (!res.ok) return { ...c, uiState: "failed", resultMsg: json.error ?? "Apply failed" };
      const status = json.data?.status;
      if (status === "submitted") return { ...c, uiState: "approved", resultMsg: "Application submitted" };
      if (status === "manual_required") return { ...c, uiState: "approved", resultMsg: "Manual apply needed — cover letter ready" };
      return { ...c, uiState: "failed", resultMsg: json.data?.message ?? "Apply failed" };
    }));
  }, []);

  const reject = useCallback(async (id: string) => {
    setCards((prev) => prev.map((c) => c.id === id ? { ...c, uiState: "rejected" } : c));
    fetch(`/api/approvals/${id}/reject`, { method: "POST" }).catch(console.error);
  }, []);

  const bulkApprove = useCallback(async () => {
    const pending = cards.filter((c) => c.uiState === "pending");
    if (pending.length === 0) return;
    setBulkState("running");
    setCards((prev) => prev.map((c) => c.uiState === "pending" ? { ...c, uiState: "approving" } : c));

    const res = await fetch("/api/approvals/bulk-approve", { method: "POST" });
    const json = await res.json();

    // Refresh from server to get accurate final states
    await load();
    setBulkState("idle");

    if (res.ok) {
      console.log(`[bulk] applied=${json.applied} failed=${json.failed}`);
    }
  }, [cards, load]);

  const pendingCount = cards.filter((c) => c.uiState === "pending").length;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Dashboard
        </Link>

        {/* Header */}
        <div className="mt-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-wider text-desyn-accent">
              Auto-apply
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">Approval Queue</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Review jobs before we apply. Approve to submit, skip to dismiss.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
            {pendingCount > 1 && (
              <Button
                size="sm"
                onClick={bulkApprove}
                disabled={bulkState === "running"}
              >
                {bulkState === "running"
                  ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Applying all…</>
                  : <><Zap className="mr-1.5 h-4 w-4" />Approve all ({pendingCount})</>}
              </Button>
            )}
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="mt-12 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading…
          </div>
        ) : cards.length === 0 ? (
          <div className="mt-12 flex flex-col items-center gap-5 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
              <ClipboardList className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Queue is empty</h2>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                When jobs matching your criteria are discovered, they'll appear here for your review.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/dashboard/preferences" />}>
                <Settings2 className="mr-1.5 h-4 w-4" />
                Preferences
              </Button>
              <Button size="sm" nativeButton={false} render={<Link href="/dashboard/discover" />}>
                <Zap className="mr-1.5 h-4 w-4" />
                Discover jobs
              </Button>
            </div>
          </div>
        ) : (
          <>
            <p className="mt-4 text-sm text-muted-foreground">
              {pendingCount > 0
                ? <><span className="font-semibold text-foreground">{pendingCount}</span> job{pendingCount !== 1 ? "s" : ""} awaiting review</>
                : "All reviewed"}
              {cards.length !== pendingCount && ` · ${cards.length - pendingCount} processed this session`}
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {cards.map((card) => (
                <ApprovalCardView
                  key={card.id}
                  card={card}
                  onApprove={approve}
                  onReject={reject}
                />
              ))}
            </div>
          </>
        )}
      </main>
    </>
  );
}

"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import {
  Bell, Send, AlertCircle, TrendingUp, Zap, Crown, X, ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type NotificationType =
  | "auto_applied"
  | "manual_required"
  | "high_match"
  | "discovery_summary"
  | "plan_upgraded"
  | "pending_approval";

interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  metadata: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TYPE_META: Record<NotificationType, { icon: React.ElementType; color: string }> = {
  auto_applied:      { icon: Send,          color: "text-blue-600 bg-blue-100" },
  manual_required:   { icon: AlertCircle,   color: "text-amber-600 bg-amber-100" },
  high_match:        { icon: TrendingUp,    color: "text-desyn-success bg-desyn-success/10" },
  discovery_summary: { icon: Zap,           color: "text-purple-600 bg-purple-100" },
  plan_upgraded:     { icon: Crown,          color: "text-primary bg-primary/10" },
  pending_approval:  { icon: ClipboardList,  color: "text-orange-600 bg-orange-100 dark:text-orange-400 dark:bg-orange-950/40" },
};

function notifLink(n: AppNotification): string {
  const jobId = n.metadata?.job_id as string | undefined;
  if (jobId && ["auto_applied", "manual_required", "high_match"].includes(n.type)) {
    return `/dashboard/jobs/${jobId}`;
  }
  if (n.type === "discovery_summary") return "/dashboard/discover";
  if (n.type === "plan_upgraded")     return "/dashboard/billing";
  if (n.type === "pending_approval")  return "/dashboard/approve";
  return "/dashboard";
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function NotificationBell() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const markTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const json = await res.json();
      setNotifications(json.data ?? []);
      setUnread(json.unread_count ?? 0);
    } catch {
      // silent — network error
    }
  }, []);

  // Initial fetch + 60s poll
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60_000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Click-outside to close
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const toggleOpen = () => {
    const next = !open;
    setOpen(next);

    if (next && unread > 0) {
      // Refresh + mark all read after 1.5s so user can see which are new
      fetchNotifications();
      if (markTimer.current) clearTimeout(markTimer.current);
      markTimer.current = setTimeout(async () => {
        await fetch("/api/notifications/read-all", { method: "POST" });
        setUnread(0);
        setNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
      }, 1500);
    }
  };

  const badge = unread > 9 ? "9+" : unread > 0 ? String(unread) : null;

  return (
    <div ref={ref} className="relative">
      {/* Bell button */}
      <button
        onClick={toggleOpen}
        aria-label="Notifications"
        className={cn(
          "relative flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
          open ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Bell className="h-4 w-4" />
        {badge && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-primary-foreground">
            {badge}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-10 z-50 w-80 overflow-hidden rounded-xl border border-border bg-card shadow-lg">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-sm font-semibold">Notifications</span>
            <button
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <Bell className="h-7 w-7 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">All caught up</p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {notifications.map((n) => {
                  const meta = TYPE_META[n.type] ?? TYPE_META.auto_applied;
                  const Icon = meta.icon;
                  const isUnread = !n.read_at;
                  return (
                    <li key={n.id}>
                      <Link
                        href={notifLink(n)}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/50",
                          isUnread && "bg-primary/[0.03]"
                        )}
                      >
                        <div className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs", meta.color)}>
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className={cn("text-sm leading-snug", isUnread ? "font-semibold text-foreground" : "font-medium text-foreground/80")}>
                              {n.title}
                            </p>
                            <span className="shrink-0 text-[10px] text-muted-foreground">
                              {timeAgo(n.created_at)}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed line-clamp-2">
                            {n.body}
                          </p>
                        </div>
                        {isUnread && (
                          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="border-t border-border px-4 py-2.5">
              <Link
                href="/dashboard"
                onClick={() => setOpen(false)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                View dashboard →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

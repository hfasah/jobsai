"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { labelFor } from "@/lib/crm-shared";

// ─── Right-side slide-over (create/edit panels) ──────────────────────────────
export function SlideOver({
  open, onClose, title, children, footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-md flex-col border-l border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="border-t border-border px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

// ─── Form field primitives ───────────────────────────────────────────────────
export function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      {children}
    </div>
  );
}

export const inputCls =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary";

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(inputCls, props.className)} />;
}
export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(inputCls, "min-h-[72px] resize-y", props.className)} />;
}
export function Select({ options, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { options: readonly string[] }) {
  return (
    <select {...props} className={cn(inputCls, props.className)}>
      {options.map((o) => <option key={o} value={o}>{labelFor(o)}</option>)}
    </select>
  );
}

// ─── Status badges ───────────────────────────────────────────────────────────
const badge = "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize";

export const COMPANY_STATUS_STYLES: Record<string, string> = {
  prospect: "bg-blue-500/15 text-blue-500 border-blue-500/30",
  active_client: "bg-green-500/15 text-green-500 border-green-500/30",
  past_client: "bg-muted text-muted-foreground border-border",
  dormant: "bg-amber-500/15 text-amber-500 border-amber-500/30",
};
export const RELATIONSHIP_STYLES: Record<string, string> = {
  new: "bg-blue-500/15 text-blue-500 border-blue-500/30",
  warm: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  active: "bg-green-500/15 text-green-500 border-green-500/30",
  unresponsive: "bg-muted text-muted-foreground border-border",
  do_not_contact: "bg-red-500/15 text-red-500 border-red-500/30",
};

export function StatusBadge({ value, styles }: { value: string; styles: Record<string, string> }) {
  return <span className={cn(badge, styles[value] ?? "bg-muted text-muted-foreground border-border")}>{labelFor(value)}</span>;
}

// ─── Date helpers ────────────────────────────────────────────────────────────
export const fmtDate = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—";

export function relativeTime(v: string | null | undefined): string {
  if (!v) return "—";
  const diff = Date.now() - new Date(v).getTime();
  const day = 24 * 60 * 60 * 1000;
  if (diff < 0) return fmtDate(v);
  if (diff < day) return "today";
  const days = Math.floor(diff / day);
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

// True when a follow-up/due date is in the past (for amber/red highlighting).
export const isOverdue = (v: string | null | undefined) => !!v && new Date(v).getTime() < Date.now();

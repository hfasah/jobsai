"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

type StatRingProps = {
  /** 0–100 */
  value: number;
  size?: number;
  strokeWidth?: number;
  /** big centered text; defaults to `${value}%` */
  label?: string;
  /** small text under the label */
  sublabel?: string;
  /** stroke gradient: brand blue→purple→cyan, or success green */
  tone?: "brand" | "success" | "warning";
  className?: string;
};

const TONE_STOPS: Record<NonNullable<StatRingProps["tone"]>, [string, string]> = {
  brand: ["var(--desyn-gradient-start)", "var(--desyn-gradient-end)"],
  success: ["var(--desyn-success)", "var(--desyn-cyan)"],
  warning: ["var(--desyn-warning)", "var(--desyn-brand)"],
};

// Animated SVG donut for scores (match %, ATS score, confidence, etc.).
// Draws on mount via a CSS keyframe — no client JS / state required.
export function StatRing({
  value,
  size = 132,
  strokeWidth = 12,
  label,
  sublabel,
  tone = "brand",
  className,
}: StatRingProps) {
  const id = useId();
  const pct = Math.max(0, Math.min(100, value));
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct / 100);
  const [from, to] = TONE_STOPS[tone];

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={`ring-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={from} />
            <stop offset="100%" stopColor={to} />
          </linearGradient>
        </defs>
        {/* track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--muted)"
          strokeWidth={strokeWidth}
        />
        {/* value arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#ring-${id})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circ}
          className="animate-ring"
          style={{
            // final state (also the reduced-motion fallback); animates from
            // empty (--ring-circ) to this offset via the ring-draw keyframe
            strokeDashoffset: offset,
            ["--ring-offset" as string]: offset,
            ["--ring-circ" as string]: circ,
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold tabular-nums text-foreground">
          {label ?? `${Math.round(pct)}%`}
        </span>
        {sublabel && (
          <span className="mt-0.5 text-[11px] font-medium text-muted-foreground">
            {sublabel}
          </span>
        )}
      </div>
    </div>
  );
}

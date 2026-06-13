"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor, Check, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

// Appearance switcher (Light / Dark / System) backed by next-themes.
// - "full" (default): a labeled, full-width button whose menu opens upward —
//   for the workspace sidebar footer.
// - "compact": an icon-only trigger whose menu opens downward, right-aligned —
//   for the public marketing header.
// Pages that use bg-background/text-foreground (no forced dark) follow the
// selected theme.
export function AppearanceMenu({ variant = "full" }: { variant?: "full" | "compact" }) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // next-themes returns undefined on the server and the first client render
  // (so SSR and hydration match), then resolves — defaulting to "system" here.
  const current = theme ?? "system";
  const active = OPTIONS.find((o) => o.value === current) ?? OPTIONS[2];
  const TriggerIcon = active.icon;
  const subtitle = current === "system"
    ? `System (${resolvedTheme === "dark" ? "Dark" : "Light"})`
    : active.label;

  return (
    <div ref={ref} className="relative">
      {variant === "compact" ? (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label="Appearance"
          title={`Appearance — ${subtitle}`}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <TriggerIcon className="h-4 w-4" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium transition-colors hover:bg-muted"
        >
          <TriggerIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="flex min-w-0 flex-1 flex-col items-start leading-tight">
            <span>Appearance</span>
            <span className="text-[10px] font-normal text-muted-foreground">{subtitle}</span>
          </span>
          <ChevronRight className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-90")} />
        </button>
      )}

      {open && (
        <div className={cn(
          "absolute z-50 overflow-hidden rounded-lg border border-border bg-card p-1 shadow-xl",
          variant === "compact" ? "top-full right-0 mt-1 w-36" : "bottom-full left-0 mb-1 w-full",
        )}>
          {OPTIONS.map(({ value, label, icon: Icon }) => {
            const isActive = current === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => { setTheme(value); setOpen(false); }}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors hover:bg-muted",
                  isActive ? "text-foreground" : "text-muted-foreground",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-left">{label}</span>
                {isActive && <Check className="h-4 w-4 shrink-0 text-primary" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

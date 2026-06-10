import { Fragment } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface JourneyStep {
  key: string;
  label: string;
  sub: string;       // shown under the current step
  href: string;
  icon: React.ElementType;
  done: boolean;
}

// The "flight simulator" path: Resume → Written → Voice → Avatar → Interview → Offer.
// Server-safe (no hooks). The first not-done step is highlighted as "next up".
export function Journey({ steps }: { steps: JourneyStep[] }) {
  const currentIdx = steps.findIndex((s) => !s.done);

  return (
    <div className="flex items-center justify-between gap-0 w-full">
      {steps.map((s, i) => {
        const isCurrent = i === currentIdx;
        const Icon = s.done ? Check : s.icon;
        return (
          <Fragment key={s.key}>
            <div className="flex flex-col items-center flex-1">
              <Link href={s.href} className="group flex flex-col items-center text-center">
                <span
                  className={cn(
                    "flex h-14 w-14 items-center justify-center rounded-full border-2 transition-all mb-3",
                    s.done
                      ? "border-transparent bg-gradient-brand text-white shadow-glow"
                      : isCurrent
                        ? "animate-pulse-ring border-primary bg-primary/10 text-primary"
                        : "border-border bg-card text-muted-foreground group-hover:border-primary/40"
                  )}
                >
                  <Icon className="h-6 w-6" />
                </span>
                <span className={cn("text-sm font-semibold leading-tight whitespace-nowrap", s.done || isCurrent ? "text-foreground" : "text-muted-foreground")}>
                  {s.label}
                </span>
                {isCurrent && <span className="mt-0.5 text-xs font-medium text-primary">{s.sub}</span>}
              </Link>
            </div>
            {i < steps.length - 1 && (
              <span
                className={cn(
                  "h-0.5 flex-1 rounded-full translate-y-[-32px]",
                  s.done ? "bg-gradient-brand" : "bg-border"
                )}
              />
            )}
          </Fragment>
        );
      })}
    </div>
  );
}

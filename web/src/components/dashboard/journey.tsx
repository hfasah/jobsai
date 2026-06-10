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
    <div className="flex items-center gap-0 overflow-x-auto pb-0">
      {steps.map((s, i) => {
        const isCurrent = i === currentIdx;
        const Icon = s.done ? Check : s.icon;
        return (
          <Fragment key={s.key}>
            <Link href={s.href} className="group flex flex-col items-center text-center shrink-0">
              <span
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all",
                  s.done
                    ? "border-transparent bg-gradient-brand text-white shadow-glow"
                    : isCurrent
                      ? "animate-pulse-ring border-primary bg-primary/10 text-primary"
                      : "border-border bg-card text-muted-foreground group-hover:border-primary/40"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
              </span>
              <span className={cn("mt-1 text-[11px] font-semibold leading-tight whitespace-nowrap", s.done || isCurrent ? "text-foreground" : "text-muted-foreground")}>
                {s.label}
              </span>
              {isCurrent && <span className="mt-0.5 text-[9px] font-medium text-primary">{s.sub}</span>}
            </Link>
            {i < steps.length - 1 && (
              <span
                className={cn(
                  "h-0.5 w-3 flex-shrink-0 rounded-full",
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

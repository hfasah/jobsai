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
    <div className="flex items-start overflow-x-auto pb-1">
      {steps.map((s, i) => {
        const isCurrent = i === currentIdx;
        const Icon = s.done ? Check : s.icon;
        return (
          <Fragment key={s.key}>
            <Link href={s.href} className="group flex w-20 shrink-0 flex-col items-center text-center">
              <span
                className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-full border-2 transition-all",
                  s.done
                    ? "border-transparent bg-gradient-brand text-white shadow-glow"
                    : isCurrent
                      ? "animate-pulse-ring border-primary bg-primary/10 text-primary"
                      : "border-border bg-card text-muted-foreground group-hover:border-primary/40"
                )}
              >
                <Icon className="h-5 w-5" />
              </span>
              <span className={cn("mt-2 text-xs font-semibold leading-tight", s.done || isCurrent ? "text-foreground" : "text-muted-foreground")}>
                {s.label}
              </span>
              {isCurrent && <span className="mt-0.5 text-[10px] font-medium text-primary">{s.sub}</span>}
            </Link>
            {i < steps.length - 1 && (
              <span
                className={cn(
                  "mt-6 h-0.5 min-w-6 flex-1 rounded-full",
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

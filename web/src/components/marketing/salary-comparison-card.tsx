import Link from "next/link";
import { Trophy, Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";
import { CURRENCY_SYMBOL, type SalaryComparison, type RegionSalary } from "@/lib/salaries";

function fmt(n: number, currency: string): string {
  const sym = CURRENCY_SYMBOL[currency] ?? "";
  return `${sym}${Math.round(n).toLocaleString()}`;
}

// Presentational (server-safe) salary comparison card, shared by the dashboard
// tool and the public /salaries page.
export function SalaryComparisonCard({ data, jobsHref }: { data: SalaryComparison; jobsHref?: string }) {
  const withData = data.regions.filter((r) => r.usd != null);
  const maxUsd = withData.reduce((m, r) => Math.max(m, r.usd ?? 0), 0) || 1;
  const top = withData.reduce<RegionSalary | null>((best, r) => (!best || (r.usd ?? 0) > (best.usd ?? 0) ? r : best), null);

  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold tracking-tight">
          Average salary for <span className="text-gradient">{data.title}</span>
        </h2>
        {top && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
            <Trophy className="h-3.5 w-3.5" /> {top.short} pays most
          </span>
        )}
      </div>

      <div className="mt-5 space-y-4">
        {data.regions.map((r) => {
          const pct = r.usd != null ? Math.max(6, Math.round((r.usd / maxUsd) * 100)) : 0;
          const isTop = top?.code === r.code;
          return (
            <div key={r.code}>
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 font-medium">
                  <span className="text-base">{r.flag}</span> {r.label}
                </span>
                <span className="tabular-nums">
                  {r.mean != null
                    ? <><span className="font-semibold">{fmt(r.mean, r.currency)}</span>
                        {r.currency !== "USD" && <span className="ml-1.5 text-xs text-muted-foreground">≈ {fmt(r.usd ?? 0, "USD")}</span>}</>
                    : <span className="text-xs text-muted-foreground">No data</span>}
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full rounded-full transition-all", isTop ? "bg-gradient-brand" : "bg-primary/50")}
                  style={{ width: `${pct}%` }}
                />
              </div>
              {r.count > 0 && (
                <p className="mt-1 text-[11px] text-muted-foreground">{r.count.toLocaleString()} listings analyzed</p>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-4 text-[11px] text-muted-foreground">
        <span>
          {data.fxLive
            ? "USD figures converted at live exchange rates."
            : "USD figures use approximate exchange rates."}
        </span>
        {jobsHref && (
          <Link href={jobsHref} className="inline-flex items-center gap-1 text-primary hover:underline">
            <Briefcase className="h-3.5 w-3.5" /> See {data.title} jobs
          </Link>
        )}
      </div>
    </div>
  );
}

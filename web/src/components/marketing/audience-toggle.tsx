import { cn } from "@/lib/utils";

const CONSUMER_URL = "https://jobsai.work";
const ENTERPRISE_URL = "https://app.jobsai.work";

// Segmented pill that switches between the job-seeker (jobsai.work) and employer
// (app.jobsai.work) sites. The current audience is highlighted; the other side
// is a cross-domain link.
export function AudienceToggle({ active, className }: { active: "seekers" | "employers"; className?: string }) {
  const seekers = active === "seekers";
  const on = "rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white shadow-sm";
  const off = "rounded-full px-3 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground";
  return (
    <div className={cn("inline-flex items-center rounded-full border border-border bg-card p-0.5", className)}>
      {seekers
        ? <span className={on}>For job seekers</span>
        : <a href={CONSUMER_URL} className={off}>For job seekers</a>}
      {seekers
        ? <a href={ENTERPRISE_URL} className={off}>For employers</a>
        : <span className={on}>For employers</span>}
    </div>
  );
}

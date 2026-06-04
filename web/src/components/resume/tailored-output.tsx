import type { TailoredJson, TailorChange } from "@/types/phase3";

function fmtDate(d?: string | null): string {
  if (!d) return "";
  const [y, m] = String(d).split("-");
  if (!m) return y ?? "";
  const month = new Date(`${y}-${m}-01`).toLocaleDateString("en-US", { month: "short" });
  return `${month} ${y}`;
}

function dateRange(e: { start_date?: string | null; end_date?: string | null; is_current?: boolean }): string {
  const start = fmtDate(e.start_date);
  const end = e.is_current ? "Present" : fmtDate(e.end_date);
  if (start && end) return `${start} – ${end}`;
  return start || end || "";
}

// Presentational render of an optimized / tailored resume (TailoredJson),
// shared by the Resume Builder and Resume Optimizer.
export function TailoredOutput({ tj, changes }: { tj: TailoredJson; changes?: TailorChange[] }) {
  return (
    <div className="space-y-6">
      {(tj.headline || tj.summary) && (
        <div className="rounded-2xl border border-border bg-card p-5">
          {tj.headline && <p className="text-base font-semibold text-foreground">{tj.headline}</p>}
          {tj.summary && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{tj.summary}</p>}
        </div>
      )}

      {tj.experience?.length ? (
        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Experience</h3>
          <div className="mt-4 space-y-5">
            {tj.experience.map((exp, i) => (
              <div key={i}>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm font-semibold text-foreground">
                    {exp.title}{exp.company ? <span className="text-muted-foreground"> — {exp.company}</span> : null}
                  </p>
                  {dateRange(exp) && <p className="shrink-0 text-xs tabular-nums text-muted-foreground">{dateRange(exp)}</p>}
                </div>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-muted-foreground">
                  {(exp.bullets ?? []).map((b, j) => <li key={j}>{b}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {tj.skills?.length ? (
        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Skills</h3>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {tj.skills.map((s, i) => (
              <span key={i} className="rounded-full border border-border bg-background px-2.5 py-1 text-xs text-foreground/90">{s}</span>
            ))}
          </div>
        </div>
      ) : null}

      {changes?.length ? (
        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">What changed</h3>
          <ul className="mt-3 space-y-3">
            {changes.map((c, i) => (
              <li key={i} className="text-sm">
                <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">{c.section}</span>
                <p className="mt-1 text-muted-foreground">{c.reason}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

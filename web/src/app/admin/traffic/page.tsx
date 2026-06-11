import { Globe, ExternalLink, CheckCircle2, Circle, MousePointerClick, Clock, MapPin, Users, Eye } from "lucide-react";
import { getTrafficStats } from "@/lib/posthog-stats";

export const revalidate = 300; // refresh the numbers every 5 minutes

function fmtDuration(sec: number | null): string {
  if (!sec || sec <= 0) return "—";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

// Traffic & engagement analytics, powered by PostHog (wired app-wide in
// PostHogTracker). Numbers are pulled natively via the PostHog query API and
// rendered as cards — no flaky iframe embed required.
export default async function AdminTrafficPage() {
  const stats = await getTrafficStats();
  const embedUrl = process.env.POSTHOG_DASHBOARD_EMBED_URL;
  const projectUrl = process.env.POSTHOG_PROJECT_URL || "https://us.posthog.com";
  const trackingLive = !!process.env.NEXT_PUBLIC_POSTHOG_KEY;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Globe className="h-6 w-6 text-primary" /> Traffic &amp; Engagement
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pageviews, clicks, session duration, and visitor location — signed-in and anonymous alike. Last 7 days.
          </p>
        </div>
        <a
          href={projectUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold transition-colors hover:bg-muted"
        >
          Open in PostHog <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      {stats ? (
        <>
          {/* Headline numbers */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat icon={Users} label="Visitors (24h)" value={stats.visitors24h.toLocaleString()} sub={`${stats.visitors7d.toLocaleString()} in 7 days`} />
            <Stat icon={Eye} label="Pageviews (24h)" value={stats.views24h.toLocaleString()} sub={`${stats.views7d.toLocaleString()} in 7 days`} />
            <Stat icon={Clock} label="Avg session" value={fmtDuration(stats.avgSessionSec)} sub="time on app per visit" />
            <Stat icon={MapPin} label="Top country" value={stats.topCountries[0]?.country ?? "—"} sub={stats.topCountries[0] ? `${stats.topCountries[0].views.toLocaleString()} views` : "no data yet"} />
          </div>

          {/* Top countries */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold"><MapPin className="h-4 w-4 text-primary" /> Top locations (7 days)</h2>
            {stats.topCountries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No location data yet — once visitors arrive, their countries appear here.</p>
            ) : (
              <ul className="space-y-2">
                {stats.topCountries.map((c) => {
                  const max = stats.topCountries[0].views || 1;
                  return (
                    <li key={c.country} className="flex items-center gap-3">
                      <span className="w-40 shrink-0 truncate text-sm">{c.country}</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round((c.views / max) * 100)}%` }} />
                      </div>
                      <span className="w-16 shrink-0 text-right text-sm font-semibold tabular-nums">{c.views.toLocaleString()}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      ) : embedUrl ? (
        <div className="space-y-3">
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200/90">
            Showing an embedded PostHog dashboard. If it&apos;s blank, the dashboard isn&apos;t <strong>shared publicly</strong> yet — in PostHog open the dashboard → Share → toggle &quot;Share publicly&quot; on, then use that embed URL. Or add a read-only API key (below) for native cards instead.
          </div>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <iframe src={embedUrl} title="PostHog dashboard" className="h-[1200px] w-full" allowFullScreen />
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card p-6">
          <p className="mb-4 flex items-center gap-2 text-sm font-semibold">
            {trackingLive
              ? <><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Tracking is live — add a read-only API key to show numbers here</>
              : <><Circle className="h-4 w-4 text-muted-foreground" /> Finish setup to start seeing traffic</>}
          </p>
          <ol className="space-y-3 text-sm text-muted-foreground">
            <li className="flex gap-2"><span className="font-semibold text-foreground">1.</span><span>Create a free project at <a href="https://posthog.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">posthog.com</a>; set <code className="rounded bg-muted px-1.5 py-0.5 text-xs">NEXT_PUBLIC_POSTHOG_KEY</code> + <code className="rounded bg-muted px-1.5 py-0.5 text-xs">NEXT_PUBLIC_POSTHOG_HOST</code> in Vercel. {trackingLive ? "(Done ✓)" : ""}</span></li>
            <li className="flex gap-2"><span className="font-semibold text-foreground">2.</span><span>For native numbers here: PostHog → Settings → <strong>Personal API keys</strong> → create one (read access). Set it as <code className="rounded bg-muted px-1.5 py-0.5 text-xs">POSTHOG_API_KEY</code>, your numeric project id as <code className="rounded bg-muted px-1.5 py-0.5 text-xs">POSTHOG_PROJECT_ID</code>, and (EU only) <code className="rounded bg-muted px-1.5 py-0.5 text-xs">POSTHOG_API_HOST</code>=https://eu.posthog.com.</span></li>
            <li className="flex gap-2"><span className="font-semibold text-foreground">3.</span><span>Redeploy. The cards above fill in automatically.</span></li>
          </ol>
          <p className="mt-4 text-xs text-muted-foreground">Until then, all traffic still flows into PostHog — use “Open in PostHog” above.</p>
        </div>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value, sub }: { icon: React.ElementType; label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <p className="mt-2 text-3xl font-bold tracking-tight">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

import { Globe, ExternalLink, CheckCircle2, Circle, MousePointerClick, Clock, MapPin } from "lucide-react";

// Traffic & engagement analytics, powered by PostHog (wired app-wide in
// PostHogTracker). PostHog captures pageviews, clicks, session duration, and
// approximate location for every visitor — signed-in or anonymous.
//
// This page embeds a PostHog "shared dashboard" inside the admin when its URL
// is provided via POSTHOG_DASHBOARD_EMBED_URL; otherwise it shows setup steps.
export default function AdminTrafficPage() {
  const configured = !!process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const embedUrl = process.env.POSTHOG_DASHBOARD_EMBED_URL;
  const projectUrl = process.env.POSTHOG_PROJECT_URL || "https://us.posthog.com";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Globe className="h-6 w-6 text-primary" /> Traffic &amp; Engagement
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pageviews, clicks, session duration, and visitor location — for signed-in and anonymous visitors alike.
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

      {/* What we capture */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { icon: MousePointerClick, label: "Clicks & pageviews", sub: "Autocaptured on every page" },
          { icon: Clock, label: "Session duration", sub: "Time on app per visit" },
          { icon: MapPin, label: "Location", sub: "Country / region / city from IP" },
        ].map(({ icon: Icon, label, sub }) => (
          <div key={label} className="rounded-xl border border-border bg-card p-4">
            <Icon className="h-4 w-4 text-primary" />
            <p className="mt-2 text-sm font-semibold">{label}</p>
            <p className="text-xs text-muted-foreground">{sub}</p>
          </div>
        ))}
      </div>

      {/* Embedded dashboard, or setup steps */}
      {configured && embedUrl ? (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <iframe
            src={embedUrl}
            title="PostHog dashboard"
            className="h-[1400px] w-full"
            allowFullScreen
          />
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card p-6">
          <p className="mb-4 flex items-center gap-2 text-sm font-semibold">
            {configured ? (
              <><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Tracking is live — finish embedding the dashboard below</>
            ) : (
              <><Circle className="h-4 w-4 text-muted-foreground" /> Finish setup to start seeing traffic</>
            )}
          </p>
          <ol className="space-y-3 text-sm text-muted-foreground">
            <li className="flex gap-2">
              <span className="font-semibold text-foreground">1.</span>
              <span>Create a free project at <a href="https://posthog.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">posthog.com</a> and copy your <strong>Project API key</strong> and host.</span>
            </li>
            <li className="flex gap-2">
              <span className="font-semibold text-foreground">2.</span>
              <span>In Vercel → Settings → Environment Variables (Production), set <code className="rounded bg-muted px-1.5 py-0.5 text-xs">NEXT_PUBLIC_POSTHOG_KEY</code> and <code className="rounded bg-muted px-1.5 py-0.5 text-xs">NEXT_PUBLIC_POSTHOG_HOST</code>, then redeploy. {configured ? "(Done ✓)" : ""}</span>
            </li>
            <li className="flex gap-2">
              <span className="font-semibold text-foreground">3.</span>
              <span>In PostHog, open <strong>Web Analytics</strong> (or build a dashboard), click <strong>Share → Embed</strong>, copy the embed URL, and set it as <code className="rounded bg-muted px-1.5 py-0.5 text-xs">POSTHOG_DASHBOARD_EMBED_URL</code> in Vercel. It will render right here.</span>
            </li>
          </ol>
          <p className="mt-4 text-xs text-muted-foreground">
            Until then, all your traffic still flows into PostHog — use the “Open in PostHog” button above to view it.
          </p>
        </div>
      )}
    </div>
  );
}

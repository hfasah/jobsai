import { Copy, ExternalLink, ArrowUp, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GuideMock } from "@/lib/enterprise-guide-mocks";

const ring = "ring-2 ring-primary ring-offset-2 ring-offset-card";

function Row({ label, sub, badge, action, highlight }: NonNullable<GuideMock["items"]>[number]) {
  return (
    <div className={cn("flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2.5", highlight && ring)}>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{label}</p>
        {sub && <p className="truncate text-xs text-muted-foreground">{sub}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {badge && <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">{badge}</span>}
        {action && <span className="rounded-md border border-border px-2 py-1 text-xs font-medium text-muted-foreground">{action}</span>}
      </div>
    </div>
  );
}

function Field({ label, value, highlight }: NonNullable<GuideMock["fields"]>[number]) {
  return (
    <div>
      <p className="mb-1 text-[11px] text-muted-foreground">{label}</p>
      <div className={cn("rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground", highlight && ring)}>{value}</div>
    </div>
  );
}

// Honest, theme-aware "app screenshot" mockup: recreates a feature's screen
// using the product's own design tokens (not a real screenshot, not claimed to
// be one), with an optional highlight ring + annotation caption that points to
// the element the surrounding steps refer to.
export function GuideMockup({ mock }: { mock: GuideMock }) {
  return (
    <figure className="my-7 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      {/* Window chrome */}
      <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-2.5">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
        </div>
        <span className="ml-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          {mock.icon && <span>{mock.icon}</span>} {mock.title}
        </span>
      </div>

      {/* Body */}
      <div className="space-y-3 p-4">
        {mock.subtitle && <p className="text-xs text-muted-foreground">{mock.subtitle}</p>}

        {mock.kind === "feed" && (
          <>
            <div className="rounded-xl border border-border bg-background p-3">
              <p className="mb-1 text-[11px] text-muted-foreground">Your job feed</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded-md border border-border bg-card px-2.5 py-1.5 text-xs text-foreground">{mock.feedUrl}</code>
                <span className="inline-flex items-center gap-1 rounded-md bg-amber-400 px-2 py-1.5 text-xs font-semibold text-black"><Copy className="h-3 w-3" /> Copy</span>
                <span className="rounded-md border border-border p-1.5 text-muted-foreground"><ExternalLink className="h-3 w-3" /></span>
              </div>
              {mock.fields?.map((f) => (
                <div key={f.label} className="mt-2 flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground">{f.label}:</span>
                  <code className={cn("flex-1 truncate rounded-md border border-border bg-card px-2.5 py-1.5 text-xs text-foreground", f.highlight && ring)}>{f.value}</code>
                </div>
              ))}
            </div>
            <div className="space-y-2">{mock.items?.map((it, i) => <Row key={i} {...it} />)}</div>
          </>
        )}

        {mock.kind === "list" && (
          <div className="space-y-2">{mock.items?.map((it, i) => <Row key={i} {...it} />)}</div>
        )}

        {mock.kind === "form" && (
          <div className="grid gap-3 sm:grid-cols-2">{mock.fields?.map((f, i) => <Field key={i} {...f} />)}</div>
        )}

        {mock.kind === "stats" && (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {mock.stats?.map((s, i) => (
              <div key={i} className={cn("rounded-xl border border-border bg-background p-3", s.highlight && ring)}>
                <p className="text-lg font-bold text-foreground">{s.value}</p>
                <p className="text-[11px] text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {mock.kind === "steps" && (
          <div className="space-y-2">
            {mock.steps?.map((s, i) => (
              <div key={i} className={cn("flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2.5", s.highlight && ring)}>
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{s.subject}</p>
                  <p className="text-[11px] text-muted-foreground">{s.day}</p>
                </div>
                {s.ai && <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary"><Sparkles className="h-3 w-3" /> AI</span>}
              </div>
            ))}
          </div>
        )}

        {mock.kind === "board" && (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {mock.columns?.map((col, i) => (
              <div key={i} className={cn("rounded-xl border border-border bg-background p-2.5", col.highlight && ring)}>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{col.title}</p>
                <div className="space-y-1.5">
                  {col.cards.map((c, j) => (
                    <div key={j} className="rounded-md border border-border bg-card px-2 py-1.5 text-xs text-foreground">{c}</div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Annotation — points to the highlighted element */}
      {mock.annotation && (
        <figcaption className="flex items-start gap-2 border-t border-border bg-primary/5 px-4 py-2.5">
          <ArrowUp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="text-xs leading-relaxed text-foreground/90">{mock.annotation}</span>
        </figcaption>
      )}
    </figure>
  );
}

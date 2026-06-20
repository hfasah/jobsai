import { Mic, Sparkles } from "lucide-react";

// Signature hero centerpiece — a live "mock interview" panel. Replaces the
// generic glowing orb: it's interview-themed (the product's real differentiator),
// concrete, and on-brand (gold). CSS-only / server-safe; motion via globals.css
// (.hero-meter, animate-ping/pulse) and honors prefers-reduced-motion.
export function HeroInterviewPanel() {
  const tags = ["STAR structure", "Quantified impact", "Confident tone"];
  return (
    <div className="relative mx-auto w-full max-w-md">
      {/* Warm glow behind the card */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-8 rounded-[2.5rem] blur-3xl"
        style={{
          background:
            "radial-gradient(55% 55% at 50% 35%, color-mix(in oklch, var(--cta) 30%, transparent), transparent 70%)",
        }}
      />
      <div className="relative overflow-hidden rounded-[1.75rem] border border-white/12 bg-card/80 p-5 text-left shadow-2xl backdrop-blur-xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--cta)] opacity-70" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[var(--cta)]" />
            </span>
            <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--cta)]">
              Live interview
            </span>
          </span>
          <span className="text-[10px] font-medium text-muted-foreground">Behavioral · Senior</span>
        </div>

        {/* Interviewer question */}
        <div className="mt-4 flex gap-2.5">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-foreground">
            <Mic className="h-3.5 w-3.5" />
          </span>
          <p className="rounded-2xl rounded-tl-sm bg-white/[0.06] px-3.5 py-2.5 text-sm leading-snug text-foreground/90">
            Tell me about a time you led a project under a tight deadline.
          </p>
        </div>

        {/* Candidate answer building, with a blinking caret */}
        <div className="mt-3 ml-9 rounded-2xl rounded-tr-sm border border-[var(--cta)]/25 bg-[var(--cta)]/[0.08] px-3.5 py-2.5 text-sm leading-snug text-foreground/90">
          “When the launch slipped, I re-scoped to the critical path, ran daily 15-minute syncs,
          and shipped three days early with zero defects
          <span className="ml-0.5 inline-block h-[1em] w-[2px] -translate-y-[1px] animate-pulse bg-[var(--cta)] align-middle" />
        </div>

        {/* Coaching readout */}
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] p-3.5">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 font-semibold text-foreground">
              <Sparkles className="h-3.5 w-3.5 text-[var(--cta)]" /> Answer strength
            </span>
            <span className="font-bold tabular-nums text-[var(--cta)]">
              92<span className="text-muted-foreground">/100</span>
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
            <div className="hero-meter h-full rounded-full bg-[var(--cta)]" />
          </div>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <span
                key={t}
                className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] text-muted-foreground"
              >
                ✓ {t}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

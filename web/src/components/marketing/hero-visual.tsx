import {
  FileText, CheckCircle2, Mic, Video, Sparkles, TrendingUp,
} from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { StatRing } from "@/components/ui/stat-ring";
import { AudioBars } from "@/components/ui/audio-bars";
import { SectionBadge } from "@/components/ui/section-badge";

// The hero's "active" product mockup: a mini dashboard showing resume parsed,
// job matched, an interview score ring, a live voice line, and an avatar tile.
export function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-md">
      {/* floating accent — ATS score */}
      <div className="animate-float absolute -left-6 top-10 z-20 hidden sm:block">
        <GlassCard variant="glass" className="flex items-center gap-2 px-3 py-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-desyn-success/15">
            <CheckCircle2 className="h-4 w-4 text-desyn-success" />
          </div>
          <div className="leading-tight">
            <p className="text-[10px] text-muted-foreground">ATS score</p>
            <p className="text-sm font-bold text-foreground">98 / 100</p>
          </div>
        </GlassCard>
      </div>

      {/* floating accent — offer */}
      <div className="animate-float-slow absolute -right-4 bottom-16 z-20 hidden sm:block">
        <GlassCard variant="glass" className="flex items-center gap-2 px-3 py-2">
          <span className="text-base">🎉</span>
          <div className="leading-tight">
            <p className="text-[10px] text-muted-foreground">Just now</p>
            <p className="text-sm font-bold text-foreground">Offer received</p>
          </div>
        </GlassCard>
      </div>

      {/* main dashboard card */}
      <GlassCard className="relative z-10 overflow-hidden p-5 shadow-soft">
        {/* header row */}
        <div className="flex items-center justify-between">
          <SectionBadge variant="gradient" icon={Sparkles}>
            Interview Suite
          </SectionBadge>
          <div className="flex gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-destructive/40" />
            <span className="h-2.5 w-2.5 rounded-full bg-desyn-warning/50" />
            <span className="h-2.5 w-2.5 rounded-full bg-desyn-success/50" />
          </div>
        </div>

        {/* resume + match */}
        <div className="mt-5 flex items-center gap-4">
          <div className="flex-1 space-y-2.5">
            <div className="flex items-center gap-2 rounded-lg border border-border bg-background/60 px-3 py-2">
              <FileText className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium text-foreground">resume.pdf</span>
              <CheckCircle2 className="ml-auto h-4 w-4 text-desyn-success" />
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-background/60 px-3 py-2">
              <TrendingUp className="h-4 w-4 text-desyn-cyan" />
              <span className="text-xs font-medium text-foreground">
                Senior PM · Stripe
              </span>
              <span className="ml-auto rounded-full bg-desyn-success/15 px-2 py-0.5 text-[10px] font-bold text-desyn-success">
                Great fit
              </span>
            </div>
          </div>
          <StatRing value={92} size={96} strokeWidth={9} sublabel="match" />
        </div>

        {/* live voice line */}
        <div className="mt-4 flex items-center gap-3 rounded-xl bg-gradient-brand p-3 text-white">
          <div className="animate-pulse-ring flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
            <Mic className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium opacity-90">Voice interview · live</p>
            <p className="truncate text-xs font-semibold">
              "Tell me about a time you led under pressure…"
            </p>
          </div>
          <AudioBars bars={7} tone="muted" className="h-7 opacity-90" />
        </div>

        {/* avatar tile */}
        <div className="mt-3 flex items-center gap-3 rounded-xl border border-border bg-background/60 p-3">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-gradient-brand text-white">
            <Video className="h-4 w-4" />
            <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-card bg-desyn-success" />
          </div>
          <div className="leading-tight">
            <p className="text-xs font-semibold text-foreground">Avatar Room</p>
            <p className="text-[11px] text-muted-foreground">Hiring Manager · 1:1</p>
          </div>
          <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
            Premium
          </span>
        </div>
      </GlassCard>
    </div>
  );
}

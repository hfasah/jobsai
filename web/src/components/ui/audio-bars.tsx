import { cn } from "@/lib/utils";

type AudioBarsProps = {
  bars?: number;
  /** false = frozen low state (idle); true = bouncing (listening/speaking) */
  active?: boolean;
  tone?: "brand" | "muted";
  className?: string;
};

// Live waveform shimmer for voice / interview surfaces — the "active image"
// that makes the voice and avatar tiers feel alive.
export function AudioBars({
  bars = 9,
  active = true,
  tone = "brand",
  className,
}: AudioBarsProps) {
  return (
    <div className={cn("flex h-6 items-center gap-1", className)}>
      {Array.from({ length: bars }).map((_, i) => (
        <span
          key={i}
          className={cn(
            "w-1 rounded-full",
            tone === "brand" ? "bg-gradient-brand" : "bg-muted-foreground/50",
            active && "animate-bar"
          )}
          style={{
            height: "100%",
            // vary delay + duration so bars desync into a natural wave
            animationDelay: `${(i % 5) * 0.12}s`,
            animationDuration: `${0.8 + (i % 3) * 0.25}s`,
            transform: active ? undefined : "scaleY(0.3)",
          }}
        />
      ))}
    </div>
  );
}

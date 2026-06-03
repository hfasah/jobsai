import { cn } from "@/lib/utils";

type SectionBadgeProps = {
  children: React.ReactNode;
  icon?: React.ElementType;
  /** gradient = filled CTA pill · soft = tinted · outline = bordered eyebrow */
  variant?: "gradient" | "soft" | "outline";
  className?: string;
};

// Pill used for eyebrows ("Interview Suite"), ribbons ("Most Popular"),
// and trust chips across the marketing site and dashboards.
export function SectionBadge({
  children,
  icon: Icon,
  variant = "soft",
  className,
}: SectionBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold tracking-wide",
        variant === "gradient" && "bg-gradient-brand text-white shadow-glow",
        variant === "soft" &&
          "border border-primary/15 bg-primary/10 text-primary",
        variant === "outline" &&
          "border border-border bg-card/80 text-muted-foreground backdrop-blur-sm",
        className
      )}
    >
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {children}
    </span>
  );
}

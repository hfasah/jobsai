import { cn } from "@/lib/utils";

type GlassCardProps = React.HTMLAttributes<HTMLDivElement> & {
  /** Frosted glass surface vs. solid elevated card. */
  variant?: "glass" | "solid";
  /** 1px blue→purple→cyan gradient border. */
  gradientBorder?: boolean;
  /** Lift + deepen shadow on hover (use for interactive cards). */
  interactive?: boolean;
};

// Premium rounded surface — the base building block for the new dashboards,
// pricing cards, and feature tiles.
export function GlassCard({
  className,
  variant = "solid",
  gradientBorder = false,
  interactive = false,
  children,
  ...props
}: GlassCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl",
        variant === "glass" ? "glass-card" : "border border-border bg-card shadow-soft",
        gradientBorder && "gradient-border",
        interactive && "hover-lift cursor-pointer",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

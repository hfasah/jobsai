import { cn } from "@/lib/utils";

type GradientBgProps = {
  /** mesh = soft radial blobs · animated = breathing blobs · grid = blueprint lines */
  variant?: "mesh" | "animated" | "grid";
  className?: string;
};

// Decorative ambient backdrop. Render as the first child of a `relative`
// section; it sits behind content via -z-10 and is hidden from a11y tree.
export function GradientBg({ variant = "mesh", className }: GradientBgProps) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 -z-10",
        variant === "mesh" && "bg-mesh",
        variant === "animated" && "bg-mesh-animated",
        variant === "grid" && "bg-grid",
        className
      )}
    />
  );
}

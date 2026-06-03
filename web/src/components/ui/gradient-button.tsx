import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Signature blue→purple→cyan CTA. Mirrors the `buttonVariants` pattern so it
// can style a <button> directly or be applied to a <Link> via the exported
// `gradientButtonVariants()` class (avoids invalid <button> inside <a>).
export const gradientButtonVariants = cva(
  "group relative inline-flex shrink-0 items-center justify-center gap-2 overflow-hidden rounded-xl font-semibold text-white whitespace-nowrap bg-gradient-brand shadow-glow transition-all outline-none hover-lift focus-visible:ring-4 focus-visible:ring-primary/30 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      size: {
        sm: "h-9 px-4 text-sm [&_svg:not([class*='size-'])]:size-4",
        default: "h-11 px-6 text-sm [&_svg:not([class*='size-'])]:size-4",
        lg: "h-12 px-7 text-base [&_svg:not([class*='size-'])]:size-5",
        xl: "h-14 px-8 text-base [&_svg:not([class*='size-'])]:size-5",
      },
    },
    defaultVariants: { size: "default" },
  }
);

type GradientButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof gradientButtonVariants>;

export function GradientButton({
  className,
  size,
  children,
  ...props
}: GradientButtonProps) {
  return (
    <button className={cn(gradientButtonVariants({ size }), className)} {...props}>
      {/* sheen sweep on hover */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full"
      />
      <span className="relative inline-flex items-center gap-2">{children}</span>
    </button>
  );
}

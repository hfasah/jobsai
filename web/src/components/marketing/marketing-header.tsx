import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { gradientButtonVariants } from "@/components/ui/gradient-button";
import { APP_NAME } from "@/lib/constants";

const NAV = [
  { href: "#interview", label: "Interview Practice" },
  { href: "#features", label: "Features" },
  { href: "#how", label: "How it works" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

// Landing-only header. Signed-in users are redirected to /dashboard before this
// renders, so it only ever shows the signed-out marketing nav.
export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="text-lg font-bold tracking-tight">
          <span className="text-gradient">{APP_NAME}</span>
        </Link>

        <nav className="ml-2 hidden items-center gap-1 lg:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/sign-in"
            className="hidden rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
          >
            Sign in
          </Link>
          <Link href="/sign-up" className={gradientButtonVariants({ size: "sm" })}>
            Start free
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </header>
  );
}

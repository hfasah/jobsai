import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { GradientBg } from "@/components/ui/gradient-bg";
import { APP_NAME } from "@/lib/constants";

// Branded fallback. Doubles as a graceful "coming soon" for marketing links
// whose pages aren't built yet (About, Blog, Privacy, Terms, Contact, …).
export default function NotFound() {
  return (
    <div className="dark relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-4 text-center text-foreground">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 0%, color-mix(in oklch, var(--desyn-purple) 26%, transparent), transparent 70%)",
        }}
      />
      <GradientBg variant="grid" className="opacity-30" />

      <div className="relative">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/15 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          <Sparkles className="h-3.5 w-3.5" /> Coming soon
        </span>
        <h1 className="mt-5 text-5xl font-bold tracking-tight sm:text-6xl">
          <span className="text-gradient">{APP_NAME}</span>
        </h1>
        <p className="mx-auto mt-4 max-w-md text-muted-foreground">
          This page isn&apos;t here yet — we&apos;re putting the finishing touches on it. In the
          meantime, everything you need is a click away.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/" className="btn-cta inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm">
            <ArrowLeft className="h-4 w-4" /> Back home
          </Link>
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-card/60 px-6 py-3 text-sm font-semibold text-foreground backdrop-blur transition-colors hover:bg-white/5"
          >
            Get started
          </Link>
        </div>
      </div>
    </div>
  );
}

import Link from "next/link";
import Image from "next/image";
import { ChevronDown, ChevronRight } from "lucide-react";
import { PERSONAS, INDUSTRIES, type Persona } from "@/lib/enterprise-personas";
import { AppearanceMenu } from "@/components/enterprise/appearance-menu";
import { AttributionCapture } from "@/components/enterprise/attribution-capture";

function MenuColumn({ label, basePath, items, seeAll }: { label: string; basePath: string; items: Persona[]; seeAll: string }) {
  return (
    <div className="flex-1">
      <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="space-y-0.5">
        {items.map((p) => (
          <Link
            key={p.slug}
            href={`${basePath}/${p.slug}`}
            className="group/item flex items-start justify-between gap-3 rounded-xl px-3 py-2 hover:bg-muted"
          >
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-foreground">{p.name}</span>
              <span className="block truncate text-xs text-muted-foreground">{p.tagline}</span>
            </span>
            <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/50 group-hover/item:text-primary" />
          </Link>
        ))}
      </div>
      <Link href={basePath} className="mt-1 flex items-center justify-center rounded-xl border border-border px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted">
        {seeAll}
      </Link>
    </div>
  );
}

// Public marketing nav for the unauthenticated enterprise site (home, built-for, pricing, demo, customers).
// `partnerMode` renders a stripped-down header for the partner area: no marketing
// nav and no customer "Sign in / Start free trial" CTAs (partners aren't customers).
export function PublicEnterpriseHeader({ partnerMode = false }: { partnerMode?: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
      <AttributionCapture />
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <Link href={partnerMode ? "/enterprise/partners" : "/enterprise/home"} className="flex items-center gap-2">
          <Image src="/logo.png" alt="JobsAI" width={28} height={28} className="rounded-lg" />
          <span className="font-bold">JobsAI</span>
          <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">{partnerMode ? "Partners" : "Enterprise"}</span>
        </Link>

        {partnerMode ? (
          <div className="flex items-center gap-2 text-sm">
            <AppearanceMenu variant="compact" />
            <Link href="/enterprise/partners" className="rounded-lg px-3 py-1.5 font-medium text-muted-foreground hover:text-foreground">Partner Program</Link>
          </div>
        ) : (
        <>
        <nav className="hidden items-center gap-1 text-sm md:flex">
          {/* Built For — persona mega-menu (CSS hover, no JS) */}
          <div className="group relative">
            <button className="flex items-center gap-1 rounded-lg px-3 py-1.5 font-medium text-muted-foreground hover:text-foreground">
              Built For <ChevronDown className="h-3.5 w-3.5 transition-transform group-hover:rotate-180" />
            </button>
            <div className="invisible absolute left-1/2 top-full z-50 -translate-x-1/2 pt-2 opacity-0 transition-all duration-150 group-hover:visible group-hover:opacity-100">
              <div className="flex w-[720px] gap-4 rounded-2xl border border-border bg-card p-4 shadow-xl">
                <MenuColumn label="Built for" basePath="/enterprise/built-for" items={PERSONAS} seeAll="See all use cases" />
                <div className="w-px bg-border" />
                <MenuColumn label="Industries" basePath="/enterprise/industries" items={INDUSTRIES} seeAll="See all industries" />
              </div>
            </div>
          </div>

          <Link href="/enterprise/home#features" className="rounded-lg px-3 py-1.5 font-medium text-muted-foreground hover:text-foreground">Features</Link>
          <Link href="/enterprise/pricing" className="rounded-lg px-3 py-1.5 font-medium text-muted-foreground hover:text-foreground">Pricing</Link>
          <Link href="/enterprise/compare" className="rounded-lg px-3 py-1.5 font-medium text-muted-foreground hover:text-foreground">Compare</Link>
          <Link href="/enterprise/partners" className="rounded-lg px-3 py-1.5 font-medium text-muted-foreground hover:text-foreground">Partners</Link>
          <Link href="/enterprise/blog" className="rounded-lg px-3 py-1.5 font-medium text-muted-foreground hover:text-foreground">Blog</Link>
        </nav>

        <div className="flex items-center gap-1 text-sm sm:gap-2">
          <AppearanceMenu variant="compact" />
          <Link href="/enterprise/demo" className="hidden rounded-lg px-3 py-1.5 font-medium text-muted-foreground hover:text-foreground sm:inline">Book a demo</Link>
          <Link href="/enterprise-login" className="rounded-lg px-3 py-1.5 font-medium text-muted-foreground hover:text-foreground">Sign in</Link>
          <Link href="/enterprise-login" className="rounded-lg bg-gradient-brand px-4 py-1.5 font-semibold text-white shadow-glow">Start free trial</Link>
        </div>
        </>
        )}
      </div>
    </header>
  );
}

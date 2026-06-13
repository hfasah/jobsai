import Link from "next/link";
import Image from "next/image";

const BOOK_DEMO = "https://api.leadconnectorhq.com/widget/booking/5HFMVFvz8AJQ4gjY7B9F";

// Public marketing nav for the unauthenticated enterprise site (home, pricing, sign-in).
export function PublicEnterpriseHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <Link href="/enterprise/home" className="flex items-center gap-2">
          <Image src="/logo.png" alt="JobsAI" width={28} height={28} className="rounded-lg" />
          <span className="font-bold">JobsAI</span>
          <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">Enterprise</span>
        </Link>

        <nav className="hidden items-center gap-1 text-sm md:flex">
          <Link href="/enterprise/home#features" className="rounded-lg px-3 py-1.5 font-medium text-muted-foreground hover:text-foreground">Features</Link>
          <Link href="/enterprise/home#solutions" className="rounded-lg px-3 py-1.5 font-medium text-muted-foreground hover:text-foreground">Solutions</Link>
          <Link href="/enterprise/pricing" className="rounded-lg px-3 py-1.5 font-medium text-muted-foreground hover:text-foreground">Pricing</Link>
          <Link href="/enterprise/home#roi" className="rounded-lg px-3 py-1.5 font-medium text-muted-foreground hover:text-foreground">ROI</Link>
        </nav>

        <div className="flex items-center gap-1 text-sm sm:gap-2">
          <a href={BOOK_DEMO} target="_blank" rel="noreferrer" className="hidden rounded-lg px-3 py-1.5 font-medium text-muted-foreground hover:text-foreground sm:inline">Book a demo</a>
          <Link href="/enterprise-login" className="rounded-lg px-3 py-1.5 font-medium text-muted-foreground hover:text-foreground">Sign in</Link>
          <Link href="/enterprise-login" className="rounded-lg bg-gradient-brand px-4 py-1.5 font-semibold text-white shadow-glow">Start free trial</Link>
        </div>
      </div>
    </header>
  );
}

"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import {
  X, Zap, FileText, Mic, BarChart3, Send, Trophy,
  CheckCircle2, Star,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Shared helpers ───────────────────────────────────────────────────────────

function getFlag(key: string) {
  try { return sessionStorage.getItem(key) === "1"; } catch { return false; }
}
function setFlag(key: string) {
  try { sessionStorage.setItem(key, "1"); } catch { /* private browsing */ }
}

const FEATURES = [
  { icon: Send,     label: "Auto-apply to thousands of jobs" },
  { icon: FileText, label: "AI resume tailoring for every role" },
  { icon: BarChart3,label: "ATS scanner with instant fix tips" },
  { icon: Mic,      label: "Voice and avatar interview practice" },
  { icon: Zap,      label: "Recruiter outreach on your behalf" },
  { icon: Trophy,   label: "90-day interview guarantee" },
];

const TESTIMONIAL = {
  initials: "PS",
  name: "Priya S.",
  role: "VP Product",
  quote: "The interviews just started showing up. The prep tools got me the offer.",
};

// ─── Engagement popup (timed / scroll) ───────────────────────────────────────

function EngagementModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="relative flex w-full max-w-3xl overflow-hidden rounded-2xl border border-border shadow-2xl">

        {/* Left: dark panel */}
        <div className="flex w-full flex-col justify-between bg-card p-8 md:w-[45%]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">JobsAI</p>
            <h2 className="mt-3 text-2xl font-bold leading-snug text-foreground">
              Let AI apply while<br />you focus on life.
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Thousands of tailored applications sent every day. Interviews land, we prep you to win.
            </p>

            <ul className="mt-6 space-y-2.5">
              {FEATURES.map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-center gap-2.5 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                  {label}
                </li>
              ))}
            </ul>
          </div>

          {/* Testimonial */}
          <div className="mt-8 rounded-xl border border-border bg-muted/30 p-4">
            <div className="flex items-center gap-1 text-amber-400">
              {Array.from({ length: 5 }).map((_, i) => <Star key={i} className="h-3.5 w-3.5 fill-current" />)}
            </div>
            <p className="mt-2 text-xs text-muted-foreground italic">&ldquo;{TESTIMONIAL.quote}&rdquo;</p>
            <p className="mt-2 text-xs font-semibold text-foreground">{TESTIMONIAL.name} · {TESTIMONIAL.role}</p>
          </div>
        </div>

        {/* Right: gradient CTA panel */}
        <div className="relative hidden flex-col items-center justify-center bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-600 p-10 md:flex md:w-[55%]">
          <button onClick={onClose}
            className="absolute right-4 top-4 rounded-full bg-white/10 p-1.5 text-white/70 transition-colors hover:bg-white/20 hover:text-white">
            <X className="h-4 w-4" />
          </button>

          <div className="text-center text-white">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
              <Zap className="h-8 w-8" />
            </div>
            <h3 className="text-3xl font-bold leading-tight">
              Start landing<br />interviews today.
            </h3>
            <p className="mt-3 text-sm text-white/75">
              Free to start. No credit card required.<br />90-day interview guarantee.
            </p>

            <div className="mt-8 flex flex-col gap-3">
              <Link href="/sign-up" onClick={onClose}
                className="inline-flex items-center justify-center rounded-xl bg-white px-8 py-3 text-sm font-bold text-violet-700 shadow transition-opacity hover:opacity-90">
                Get started free
              </Link>
              <Link href="/sign-in" onClick={onClose}
                className="inline-flex items-center justify-center rounded-xl border border-white/30 px-8 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10">
                Sign in
              </Link>
            </div>

            <p className="mt-6 text-xs text-white/50">
              Join thousands of job seekers landing interviews on autopilot.
            </p>
          </div>
        </div>

        {/* Mobile close */}
        <button onClick={onClose}
          className="absolute right-4 top-4 rounded-full bg-muted p-1.5 text-muted-foreground md:hidden">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Exit-intent popup ────────────────────────────────────────────────────────

function ExitModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="relative flex w-full max-w-3xl overflow-hidden rounded-2xl border border-border shadow-2xl">

        {/* Left: feature grid */}
        <div className="hidden flex-col justify-between bg-[#0f1117] p-8 md:flex md:w-[42%]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">Before you go</p>
            <h3 className="mt-2 text-lg font-bold text-foreground">Here&apos;s what you&apos;d be missing</h3>
            <div className="mt-5 grid grid-cols-2 gap-2">
              {FEATURES.map(({ icon: Icon, label }) => (
                <div key={label} className="flex flex-col gap-1.5 rounded-xl border border-border bg-card p-3">
                  <Icon className="h-4 w-4 text-primary" />
                  <p className="text-xs font-medium leading-tight text-foreground">{label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-border bg-muted/20 p-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-xs font-bold text-white">
                {TESTIMONIAL.initials}
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">{TESTIMONIAL.name}</p>
                <p className="text-[10px] text-muted-foreground">{TESTIMONIAL.role}</p>
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground italic">&ldquo;{TESTIMONIAL.quote}&rdquo;</p>
          </div>
        </div>

        {/* Right: exit copy + CTA */}
        <div className="relative flex w-full flex-col justify-center bg-card p-8 md:w-[58%]">
          <button onClick={onClose}
            className="absolute right-4 top-4 rounded-full bg-muted p-1.5 text-muted-foreground transition-colors hover:text-foreground">
            <X className="h-4 w-4" />
          </button>

          <h2 className="text-3xl font-bold leading-tight text-foreground">
            Are you sure you don&apos;t want AI{" "}
            <span className="text-gradient">applying for you</span>{" "}
            24/7?
          </h2>

          <p className="mt-4 text-sm text-muted-foreground">
            While you sleep, JobsAI sends tailored applications to hundreds of matching roles, reaches recruiters directly, and scores your resume against every job, so interviews land in your inbox.
          </p>

          <p className="mt-4 text-sm font-semibold text-foreground">
            Free to start. 90-day interview guarantee. Cancel anytime.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/sign-up" onClick={onClose}
              className="btn-cta inline-flex flex-1 items-center justify-center rounded-xl px-6 py-3 text-sm font-bold">
              Get started free
            </Link>
            <button onClick={onClose}
              className="inline-flex flex-1 items-center justify-center rounded-xl border border-border px-6 py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
              Maybe later
            </button>
          </div>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            No commitment. No pressure. Just results.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Controller ───────────────────────────────────────────────────────────────

type Modal = "engagement" | "exit" | null;

// The job-seeker acquisition popup must never appear on enterprise (white-labeled),
// admin, careers, or auth pages — only on the public job-seeker marketing site.
const POPUP_EXCLUDED = ["/enterprise", "/e/", "/admin", "/careers", "/sign-in", "/sign-up", "/dashboard", "/onboarding", "/launch"];

export function MarketingPopups() {
  const { isSignedIn, isLoaded } = useUser();
  const pathname = usePathname();
  const blocked = POPUP_EXCLUDED.some((p) => pathname === p || pathname.startsWith(p));
  const [modal, setModal] = useState<Modal>(null);
  const [armed, setArmed] = useState(false);

  const close = useCallback(() => setModal(null), []);

  useEffect(() => {
    if (!isLoaded || isSignedIn || blocked) return;

    // Don't re-show once seen this session
    if (getFlag("popup_engagement") && getFlag("popup_exit")) return;

    // Arm exit-intent listener after 5s (avoids instant trigger on page load)
    const armTimer = setTimeout(() => setArmed(true), 5000);

    // Timed engagement popup: 40 seconds
    let engagementTimer: ReturnType<typeof setTimeout> | null = null;
    if (!getFlag("popup_engagement")) {
      engagementTimer = setTimeout(() => {
        setModal("engagement");
        setFlag("popup_engagement");
      }, 40000);
    }

    // Scroll-based engagement popup: 70% scroll depth
    const onScroll = () => {
      if (getFlag("popup_engagement")) return;
      const pct = window.scrollY / (document.body.scrollHeight - window.innerHeight);
      if (pct > 0.7) {
        if (engagementTimer) clearTimeout(engagementTimer);
        setModal("engagement");
        setFlag("popup_engagement");
        window.removeEventListener("scroll", onScroll);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      clearTimeout(armTimer);
      if (engagementTimer) clearTimeout(engagementTimer);
      window.removeEventListener("scroll", onScroll);
    };
  }, [isLoaded, isSignedIn, blocked]);

  // Exit-intent: mouse leaves viewport through the top
  useEffect(() => {
    if (!armed || isSignedIn || blocked || getFlag("popup_exit")) return;

    const onMouseOut = (e: MouseEvent) => {
      if (e.clientY <= 5 && e.relatedTarget === null) {
        setModal((prev) => prev ?? "exit");
        setFlag("popup_exit");
        document.removeEventListener("mouseout", onMouseOut);
      }
    };
    document.addEventListener("mouseout", onMouseOut);
    return () => document.removeEventListener("mouseout", onMouseOut);
  }, [armed, isSignedIn, blocked]);

  if (!modal || blocked) return null;

  return modal === "engagement"
    ? <EngagementModal onClose={close} />
    : <ExitModal onClose={close} />;
}

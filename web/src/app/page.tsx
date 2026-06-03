import Link from "next/link";
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import {
  Sparkles, ArrowRight, ChevronDown,
  FileText, Send, Search, BarChart3, Mail,
  Mic, Video, MessageSquareText, CheckCircle2,
  Building2, DollarSign, TrendingUp, Briefcase, PlayCircle,
} from "lucide-react";

import { MarketingHeader } from "@/components/marketing/marketing-header";
import { HeroVisual } from "@/components/marketing/hero-visual";
import { PricingSection } from "@/components/marketing/pricing-section";
import { GradientBg } from "@/components/ui/gradient-bg";
import { GlassCard } from "@/components/ui/glass-card";
import { SectionBadge } from "@/components/ui/section-badge";
import { gradientButtonVariants } from "@/components/ui/gradient-button";
import { APP_NAME } from "@/lib/constants";

const TRUST = [
  "Resume-based questions",
  "Voice simulation",
  "AI avatar interviews",
  "Instant feedback",
  "Interview scoring",
];

const LEVELS = [
  {
    level: "Level 1",
    icon: MessageSquareText,
    title: "AI Written Coach",
    body: "Practice behavioral, technical, and leadership questions in writing. Get instant feedback on STAR structure, clarity, and confidence — plus an improved model answer.",
    best: "Mastering your answers & STAR stories",
  },
  {
    level: "Level 2",
    icon: Mic,
    title: "AI Voice Interviewer",
    body: "Have a real spoken interview. The AI asks, follows up, and probes for specifics — then scores your speaking pace, filler words, and confidence.",
    best: "Phone screens & recruiter calls",
  },
  {
    level: "Level 3",
    icon: Video,
    title: "AI Avatar Room",
    body: "Face a realistic video interviewer with eye contact and expressions. Webcam analysis scores your body language and presence before the real thing.",
    best: "High-stakes & executive interviews",
  },
];

const STEPS = [
  { n: "01", icon: FileText, title: "Upload your resume", body: "We parse your skills, experience, and preferences in seconds." },
  { n: "02", icon: Briefcase, title: "Add the job", body: "Paste a job description or import a role — we tailor everything to it." },
  { n: "03", icon: PlayCircle, title: "Choose your level", body: "Written, voice, or avatar — pick how real you want it to feel." },
  { n: "04", icon: TrendingUp, title: "Get feedback & improve", body: "Scored feedback after every session, so each rep is sharper than the last." },
];

const FEATURES = [
  { icon: Search, title: "AI Job Discovery", body: "We scan thousands of boards daily and surface roles that match your profile." },
  { icon: Send, title: "Auto-Apply", body: "Automatic submission to Lever, Ashby, Greenhouse, Workday, and more." },
  { icon: FileText, title: "Resume Tailoring", body: "Every application gets a resume rewritten to match the exact job description." },
  { icon: BarChart3, title: "ATS Scanner", body: "See your ATS score before applying — with actionable fixes to pass screening." },
  { icon: Mail, title: "Cover Letters", body: "Personalised cover letters in your tone, aligned to the company's voice." },
  { icon: Building2, title: "Company Research", body: "Culture, interview style, and likely questions — researched for you." },
  { icon: DollarSign, title: "Salary Intelligence", body: "Range estimates and negotiation tips so you never leave money on the table." },
  { icon: TrendingUp, title: "Interview Scoring", body: "Confidence, communication, and technical scores that improve every rep." },
];

const TESTIMONIALS = [
  { quote: "The voice interviewer caught every time I rambled. By my real interview I sounded twice as sharp.", name: "Marcus T.", role: "Senior Software Engineer", initials: "MT" },
  { quote: "Avatar practice the night before my exec panel was a game-changer. I walked in calm and got the offer.", name: "Priya S.", role: "VP Product", initials: "PS" },
  { quote: "Auto-apply landed me 5 interviews while I practiced. JobsAI does the whole funnel.", name: "Daniel R.", role: "Data Scientist", initials: "DR" },
];

const FAQ = [
  { q: "How is this different from ChatGPT interview practice?", a: "JobsAI builds questions from your actual resume and the target job, then evaluates you across written, voice, and realistic avatar formats — with structured scoring and a model answer every time. It feels like a real interview, not a chat." },
  { q: "Do I need a paid plan to try voice and avatar?", a: "No. The Free plan includes a trial of every level — written, voice, and avatar — so you can experience the full ladder before upgrading." },
  { q: "What are tokens and why do you use them?", a: "Tokens meter the costly features (voice and avatar streaming) fairly. Written practice feels unlimited on paid plans; voice and avatar draw from your monthly token pool, and you can top up anytime if you have a big interview coming." },
  { q: "Does JobsAI also apply to jobs for me?", a: "Yes. Beyond interview practice, JobsAI discovers matching roles, tailors your resume, writes cover letters, and auto-applies on Lever, Ashby, Greenhouse, and more — so you can focus on practicing." },
  { q: "Is my data secure?", a: "All data is encrypted at rest and in transit. We use Supabase (SOC 2 Type II) for storage and never sell your data." },
];

export default async function Home() {
  const user = await currentUser();
  if (user) redirect("/dashboard");

  return (
    <>
      <MarketingHeader />
      <main className="flex flex-1 flex-col">

        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden px-4 pb-24 pt-16 sm:px-6 sm:pt-24">
          <GradientBg variant="animated" />
          <GradientBg variant="grid" className="opacity-60" />

          <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-2">
            <div className="text-center lg:text-left">
              <SectionBadge variant="outline" icon={Sparkles} className="reveal reveal-1">
                The flight simulator for job interviews
              </SectionBadge>

              <h1 className="reveal reveal-2 mt-5 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
                Practice interviews{" "}
                <span className="text-gradient">like it&apos;s the real thing</span>
              </h1>

              <p className="reveal reveal-3 mx-auto mt-6 max-w-xl text-lg text-muted-foreground lg:mx-0">
                Upload your resume and the job, then practice with AI written
                questions, live voice interviews, or a realistic video avatar
                interviewer — and let auto-apply land the interviews for you.
              </p>

              <div className="reveal reveal-4 mt-9 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
                <Link href="/sign-up" className={gradientButtonVariants({ size: "lg" })}>
                  Start free interview practice
                  <ArrowRight className="h-5 w-5" />
                </Link>
                <Link
                  href="#how"
                  className="inline-flex h-12 items-center gap-2 rounded-xl border border-border bg-card/70 px-7 text-base font-semibold text-foreground backdrop-blur transition-colors hover:bg-muted"
                >
                  <PlayCircle className="h-5 w-5 text-primary" />
                  See how it works
                </Link>
              </div>

              <div className="reveal reveal-5 mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 lg:justify-start">
                {TRUST.map((t) => (
                  <span key={t} className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5 text-desyn-success" />
                    {t}
                  </span>
                ))}
              </div>
            </div>

            <div className="reveal reveal-3">
              <HeroVisual />
            </div>
          </div>
        </section>

        {/* ── Three levels ─────────────────────────────────────────────────── */}
        <section id="interview" className="border-t border-border/60 px-4 py-24 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <div className="mb-12 text-center">
              <SectionBadge variant="soft">AI Interview Suite</SectionBadge>
              <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
                Three levels of realism
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
                Progress from typed practice to a face-to-face simulation — so the
                real interview feels like one you&apos;ve already aced.
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-3">
              {LEVELS.map(({ level, icon: Icon, title, body, best }) => (
                <GlassCard key={title} interactive className="flex flex-col p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-brand text-white shadow-glow">
                      <Icon className="h-6 w-6" />
                    </div>
                    <SectionBadge variant="outline">{level}</SectionBadge>
                  </div>
                  <h3 className="mt-5 text-xl font-bold text-foreground">{title}</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
                  <p className="mt-5 border-t border-border pt-4 text-xs">
                    <span className="font-semibold text-foreground">Best for: </span>
                    <span className="text-muted-foreground">{best}</span>
                  </p>
                </GlassCard>
              ))}
            </div>
          </div>
        </section>

        {/* ── How it works ─────────────────────────────────────────────────── */}
        <section id="how" className="relative overflow-hidden border-t border-border/60 px-4 py-24 sm:px-6">
          <GradientBg variant="mesh" className="opacity-70" />
          <div className="mx-auto max-w-6xl">
            <div className="mb-12 text-center">
              <SectionBadge variant="soft">How it works</SectionBadge>
              <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
                Four steps, then you&apos;re interview-ready
              </h2>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map(({ n, icon: Icon, title, body }) => (
                <GlassCard key={n} className="relative p-6">
                  <span className="font-display text-5xl font-bold text-border select-none">{n}</span>
                  <div className="mt-3 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="mt-4 font-semibold text-foreground">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
                </GlassCard>
              ))}
            </div>
          </div>
        </section>

        {/* ── Features ─────────────────────────────────────────────────────── */}
        <section id="features" className="border-t border-border/60 px-4 py-24 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <div className="mb-12 text-center">
              <SectionBadge variant="soft">Everything you need</SectionBadge>
              <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
                Practice <span className="text-gradient">and</span> get hired
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
                The full job search, automated — so the only thing left to do is practice and show up.
              </p>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map(({ icon: Icon, title, body }) => (
                <GlassCard key={title} interactive className="p-5">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground">{title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
                </GlassCard>
              ))}
            </div>
          </div>
        </section>

        {/* ── Testimonials ─────────────────────────────────────────────────── */}
        <section className="border-t border-border/60 px-4 py-24 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <div className="mb-12 text-center">
              <SectionBadge variant="soft">Real results</SectionBadge>
              <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
                Confidence that shows up on the day
              </h2>
            </div>
            <div className="grid gap-5 md:grid-cols-3">
              {TESTIMONIALS.map(({ quote, name, role, initials }) => (
                <GlassCard key={name} className="p-6">
                  <div className="mb-3 flex gap-0.5 text-desyn-warning">
                    {"★★★★★".split("").map((s, i) => <span key={i}>{s}</span>)}
                  </div>
                  <blockquote className="text-sm leading-relaxed text-foreground">
                    &ldquo;{quote}&rdquo;
                  </blockquote>
                  <figcaption className="mt-5 flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-brand text-xs font-bold text-white">
                      {initials}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{name}</p>
                      <p className="text-xs text-muted-foreground">{role}</p>
                    </div>
                  </figcaption>
                </GlassCard>
              ))}
            </div>
          </div>
        </section>

        {/* ── Pricing ──────────────────────────────────────────────────────── */}
        <div className="border-t border-border/60">
          <PricingSection />
        </div>

        {/* ── FAQ ──────────────────────────────────────────────────────────── */}
        <section id="faq" className="border-t border-border/60 px-4 py-24 sm:px-6">
          <div className="mx-auto max-w-2xl">
            <div className="mb-12 text-center">
              <SectionBadge variant="soft">FAQ</SectionBadge>
              <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
                Common questions
              </h2>
            </div>
            <div className="divide-y divide-border">
              {FAQ.map(({ q, a }) => (
                <details key={q} className="group py-5">
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-sm font-medium text-foreground">
                    {q}
                    <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ── Final CTA ─────────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden border-t border-border/60 px-4 py-24 sm:px-6">
          <GradientBg variant="animated" />
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Don&apos;t wait for the real interview{" "}
              <span className="text-gradient">to practice</span>
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Join thousands of job seekers who walk in already knowing they&apos;ve got it.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Link href="/sign-up" className={gradientButtonVariants({ size: "xl" })}>
                Start practicing now
                <ArrowRight className="h-5 w-5" />
              </Link>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Free to start · No card required · 90-day interview guarantee
            </p>
          </div>
        </section>

        {/* ── Footer ───────────────────────────────────────────────────────── */}
        <footer className="border-t border-border bg-card px-4 py-8 sm:px-6">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
            <p className="text-sm font-bold">
              <span className="text-gradient">{APP_NAME}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} {APP_NAME}. All rights reserved.
            </p>
            <div className="flex items-center gap-5 text-xs text-muted-foreground">
              <Link href="/sign-in" className="transition-colors hover:text-foreground">Sign in</Link>
              <Link href="/sign-up" className="transition-colors hover:text-foreground">Get started</Link>
            </div>
          </div>
        </footer>
      </main>
    </>
  );
}

import Link from "next/link";
import {
  ChevronDown,
  FileText, Send, Search, BarChart3, Mail,
  Mic, Video, MessageSquareText,
  Building2, DollarSign, TrendingUp, Briefcase, PlayCircle,
  Star,
} from "lucide-react";

import { MarketingHeader } from "@/components/marketing/marketing-header";
import { HeroOrb } from "@/components/marketing/hero-orb";
import { HeroVisual } from "@/components/marketing/hero-visual";
import { ShowcaseSlides } from "@/components/marketing/showcase-slides";
import { PricingSection } from "@/components/marketing/pricing-section";
import { FeatureDirectory } from "@/components/marketing/feature-directory";
import { FeatureStrip } from "@/components/marketing/feature-strip";
import { TrustedMarquee } from "@/components/marketing/trusted-marquee";
import { SiteFooter } from "@/components/marketing/site-footer";
import { FEATURE_BY_SLUG } from "@/lib/marketing-features";
import { GradientBg } from "@/components/ui/gradient-bg";
import { GlassCard } from "@/components/ui/glass-card";
import { SectionBadge } from "@/components/ui/section-badge";
import { AudienceToggle } from "@/components/marketing/audience-toggle";
import { AIImageSlot } from "@/components/ui/ai-image-slot";
import { publicImageExists } from "@/lib/public-image";
import { gradientButtonVariants } from "@/components/ui/gradient-button";
import { AuthCta } from "@/components/ui/auth-cta";
import { HeroSearchForm } from "@/components/marketing/hero-search-form";
import { APP_NAME } from "@/lib/constants";

const LEVELS = [
  {
    level: "Level 1",
    icon: MessageSquareText,
    title: "AI Written Coach",
    body: "Practice behavioral, technical, and leadership questions in writing. Get instant feedback on STAR structure, clarity, and confidence, plus an improved model answer.",
    best: "Mastering your answers & STAR stories",
  },
  {
    level: "Level 2",
    icon: Mic,
    title: "AI Voice Interviewer",
    body: "Have a real spoken interview. The AI asks, follows up, and probes for specifics, then scores your speaking pace, filler words, and confidence.",
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
  { n: "01", icon: FileText, title: "Upload your resume", body: "We parse your skills, experience, and target roles in seconds, once." },
  { n: "02", icon: Search, title: "We find & match jobs", body: "Our AI scans thousands of boards daily and surfaces the roles you're most likely to land." },
  { n: "03", icon: Send, title: "We auto-apply for you", body: "A tailored resume and cover letter are submitted to each role, and we reach recruiters directly." },
  { n: "04", icon: Briefcase, title: "You land interviews, guaranteed", body: "Interviews start hitting your inbox. We even prep you for each one before you walk in." },
];

const FEATURES = [
  { icon: Search, title: "AI Job Discovery", body: "We scan thousands of boards daily and surface roles that match your profile." },
  { icon: Send, title: "Auto-Apply", body: "Automatic submission to Lever, Ashby, Greenhouse, Workday, and more." },
  { icon: FileText, title: "Resume Tailoring", body: "Every application gets a resume rewritten to match the exact job description." },
  { icon: BarChart3, title: "ATS Scanner", body: "See your ATS score before applying, with actionable fixes to pass screening." },
  { icon: Mail, title: "Cover Letters", body: "Personalised cover letters in your tone, aligned to the company's voice." },
  { icon: Building2, title: "Company Research", body: "Culture, interview style, and likely questions, researched for you." },
  { icon: DollarSign, title: "Salary Intelligence", body: "Range estimates and negotiation tips so you never leave money on the table." },
  { icon: TrendingUp, title: "Interview Prep", body: "Once you land an interview, practice it first, written, voice, or avatar, with scored feedback." },
];

const TESTIMONIALS = [
  { quote: "Six interviews booked in my first week. JobsAI ran every application for me while I focused on prepping. I just showed up and interviewed.", name: "Marcus T.", role: "Senior Software Engineer", initials: "MT" },
  { quote: "I stopped spending nights on applications, the interviews just started showing up. The prep tools got me the offer.", name: "Priya S.", role: "VP Product", initials: "PS" },
  { quote: "Five interviews in two weeks without me lifting a finger on applications. This is the whole job search, automated.", name: "Daniel R.", role: "Data Scientist", initials: "DR" },
];

const FAQ = [
  { q: "What is JobsAI and how does it work?", a: "JobsAI is your AI job-search co-pilot, it takes you from a rough resume to interviews booked. It parses your background, tailors a resume and cover letter to each role, scores them against the ATS, finds matching jobs across the US, Canada, UK, and EU, and can auto-apply for you. When interviews land, it preps you to win them." },
  { q: "How does JobsAI get me interviews faster?", a: "Every application is tailored to the job description, the right keywords to clear Applicant Tracking Systems, and sent at a volume and consistency that's hard to match by hand. More targeted applications, sent faster, means more interviews. We back it with our guarantee: interviews in 90 days or your money back (some conditions apply, see our Terms of Service)." },
  { q: "What's included, what can JobsAI do?", a: "One workflow covers it all: AI Resume Builder, Optimizer & ATS Score, Cover Letter Generator, a live Job Search board, Auto-Apply, Salary Explorer, Resume Translator (68+ languages), and a full interview suite, written coach, voice and avatar mock rounds, and the real-time Interview Buddy." },
  { q: "Do I need an existing resume to start?", a: "No. Upload a PDF or DOCX, import your LinkedIn profile, or start from scratch, JobsAI structures it into an editable profile and builds from there." },
  { q: "Will my resume be ATS-friendly?", a: "Yes. The templates use clean, parseable structure, and tailoring weaves in the right keywords naturally. The ATS Scanner then gives you a 0–100 score with specific fixes before you apply." },
  { q: "Won't AI make my resume sound generic, and can employers tell?", a: "No. Every line is built from your real accomplishments and the specific job, and you stay in full control to edit or regenerate anything. The result reads like strong professional writing, not a template." },
  { q: "Does JobsAI really apply to jobs for me, from inside the app?", a: "Yes. Auto-Apply submits tailored applications directly through employer systems like Lever, Ashby, Greenhouse, and Workday, inside JobsAI, not by bouncing you to external sites. Prefer to stay hands-on? Turn on the Approval Queue and review each one before it's sent." },
  { q: "Is there a free plan, and how does pricing work?", a: "You can start free and explore the core tools and job board. Paid plans unlock unlimited resumes and matches, Auto-Apply, and the full interview suite, billed monthly or yearly, cancel anytime." },
  { q: "What are tokens?", a: "Your plan includes a monthly token allowance that meters the most expensive AI features, like voice and avatar interview prep. Core tools and auto-apply run within your plan; tokens just cover the heavy extras, and you can top up anytime." },
  { q: "Can I cancel or get a refund?", a: "Cancel anytime from your billing settings, it stops future renewals. If something isn't working, contact us first; we review refund requests case by case and often offer a prorated refund or credit." },
  { q: "Does JobsAI prep me for interviews?", a: "Thoroughly. Practice with a written coach, a spoken voice interviewer, and a realistic on-camera avatar, all built from your resume and the exact role, with scored feedback. Interview Buddy can even assist live during the real call." },
  { q: "Is my data safe and private?", a: "Yes. Your data is encrypted in transit and at rest, stored with Supabase (SOC 2 Type II). We never sell your data and only use it to deliver the features you ask for. See our Privacy Policy for details." },
];

export default function Home() {
  return (
    <div className="dark bg-background text-foreground">
      <MarketingHeader />
      <main className="flex flex-1 flex-col">

        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <section id="home" className="relative overflow-hidden px-4 pb-20 pt-14 sm:px-6 sm:pt-20">
          {/* Dark purple ambience */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(70% 55% at 50% 0%, color-mix(in oklch, var(--desyn-purple) 32%, transparent), transparent 70%), radial-gradient(50% 40% at 12% 15%, color-mix(in oklch, var(--desyn-brand) 22%, transparent), transparent 65%), radial-gradient(45% 40% at 90% 20%, color-mix(in oklch, var(--desyn-purple) 18%, transparent), transparent 60%)",
            }}
          />
          <GradientBg variant="grid" className="opacity-30" />

          <div className="relative mx-auto flex max-w-4xl flex-col items-center text-center">
            <AudienceToggle active="seekers" className="reveal mb-6" />
            <span className="reveal reveal-1 inline-flex items-center gap-2 rounded-full border border-[var(--cta)]/40 bg-[var(--cta)]/10 px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.2em] text-[var(--cta)]">
              90-Day Interview Guarantee
            </span>
            <h1 className="reveal reveal-2 mt-5 text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
              Stop applying,<br />
              <span className="text-gradient">start interviewing</span>
            </h1>

            <p className="reveal reveal-3 mt-6 max-w-2xl text-lg text-muted-foreground">
              {APP_NAME} runs your whole job search: tailoring every application, applying
              for you, and reaching recruiters directly. Then it preps you for every interview
              with AI coaching. You stop grinding applications and start landing them,{" "}
              <span className="font-semibold text-foreground">guaranteed in 90 days, or your money back.</span>
            </p>

            {/* Voice orb */}
            <div className="reveal reveal-3 mt-10">
              <HeroOrb />
            </div>

            {/* Job search bar */}
            <HeroSearchForm />

            {/* Social proof */}
            <div className="reveal reveal-5 mt-7 flex items-center gap-3">
              <div className="flex -space-x-2">
                {["AT", "PS", "DR", "MK"].map((i) => (
                  <span key={i} className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-gradient-brand text-[10px] font-bold text-white">
                    {i}
                  </span>
                ))}
              </div>
              <div className="text-left text-sm">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold">4.9</span>
                  <span className="flex">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <Star key={i} className="h-3.5 w-3.5 fill-[var(--cta)] text-[var(--cta)]" />
                    ))}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">Loved by thousands of job seekers</p>
              </div>
            </div>

            {/* Dual CTAs */}
            <div className="reveal reveal-5 mt-7 flex flex-wrap items-center justify-center gap-3">
              <AuthCta href="/sign-up" className="btn-cta inline-flex items-center rounded-full px-7 py-3 text-base">
                Get started
              </AuthCta>
              <a
                href="https://youtu.be/5XXL3VFrRis"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-card/60 px-7 py-3 text-base font-semibold text-foreground backdrop-blur transition-colors hover:bg-white/5"
              >
                <PlayCircle className="h-5 w-5 text-primary" />
                Watch demo
              </a>
            </div>

            {/* Product frame */}
            <div className="reveal reveal-5 mt-14 w-full">
              <div className="mx-auto max-w-4xl overflow-hidden rounded-2xl border border-white/10 bg-card/60 shadow-glow-purple backdrop-blur">
                <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-3">
                  <span className="h-3 w-3 rounded-full bg-red-400/70" />
                  <span className="h-3 w-3 rounded-full bg-yellow-400/70" />
                  <span className="h-3 w-3 rounded-full bg-green-400/70" />
                </div>
                <div className="p-5 sm:p-7">
                  <HeroVisual />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Explore features strip ───────────────────────────────────────── */}
        <FeatureStrip
          heading={<>Everything in the <span className="text-gradient">toolkit</span></>}
          subtext="A quick look at the tools doing the work, explore the full suite below."
          items={[
            "auto-apply", "job-discovery", "resume-tailoring", "ats-scanner",
            "interview-buddy", "voice-interviewer", "salary-intel", "application-tracker",
          ].map((s) => FEATURE_BY_SLUG[s])}
        />

        {/* ── See it in action (slides) ────────────────────────────────────── */}
        <section className="relative overflow-hidden border-t border-border/60 px-4 py-24 sm:px-6">
          <GradientBg variant="mesh" className="opacity-30" />
          <div className="relative mx-auto max-w-6xl">
            <div className="mb-12 text-center">
              <SectionBadge variant="soft">See it in action</SectionBadge>
              <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
                Your job search, <span className="text-gradient">running itself</span>
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
                From applying to interviews booked, here&apos;s what JobsAI does while you get on with your day.
              </p>
            </div>

            {/* Live stats */}
            <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {[
                { value: "5,867,078+", label: "Jobs in our index" },
                { value: "4,231+", label: "Interviews booked" },
                { value: "180k+", label: "Applications sent" },
              ].map((s) => (
                <div key={s.label} className="rounded-2xl border border-white/10 bg-card/40 px-6 py-5 text-center backdrop-blur">
                  <p className="text-3xl font-extrabold tracking-tight text-gradient tabular-nums sm:text-4xl">{s.value}</p>
                  <p className="mt-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Product overview — real JobsAI dashboard screenshot */}
            <div className="mb-10">
              <AIImageSlot
                path="/marketing/product-dashboard.png"
                ready={publicImageExists("/marketing/product-dashboard.png")}
                alt="JobsAI dashboard overview"
                prompt="Dark JobsAI dashboard: auto-apply pipeline, match scores, and an activity feed. Purple/magenta accents, glassy cards."
                ratio="aspect-[1511/1041]"
                fit="cover"
                priority
                className="mx-auto max-w-4xl shadow-glow-purple"
              />
            </div>

            <ShowcaseSlides />
          </div>
        </section>

        {/* ── Three levels ─────────────────────────────────────────────────── */}
        <section id="interview" className="relative overflow-hidden border-t border-border/60 px-4 py-24 sm:px-6">
          <GradientBg variant="mesh" className="opacity-40" />
          <div className="relative mx-auto max-w-6xl">
            <div className="mb-12 text-center">
              <SectionBadge variant="soft">Bonus: once you&apos;re in</SectionBadge>
              <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
                We land the interview. Then we get you ready to win it.
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
                Every interview we land comes with practice built from your resume and the exact
                role, typed, spoken, or face-to-face with a realistic avatar.
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
                Four steps to a calendar full of interviews
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

        {/* ── Trusted by (scrolling brand logos) ───────────────────────────── */}
        <TrustedMarquee />

        {/* ── Features ─────────────────────────────────────────────────────── */}
        <section id="features" className="relative overflow-hidden border-t border-border/60 px-4 py-24 sm:px-6">
          <GradientBg variant="mesh" className="opacity-30" />
          <div className="relative mx-auto max-w-6xl">
            <div className="mb-12 text-center">
              <SectionBadge variant="soft">Everything you need</SectionBadge>
              <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
                Apply less, <span className="text-gradient">interview more</span>
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
                The entire job search, automated end to end, discovery, tailoring, and applying.
                so interviews land while you do nothing.
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
        <section className="relative overflow-hidden border-t border-border/60 px-4 py-24 sm:px-6">
          <GradientBg variant="mesh" className="opacity-30" />
          <div className="relative mx-auto max-w-6xl">
            <div className="mb-12 text-center">
              <SectionBadge variant="soft">Real results</SectionBadge>
              <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
                Interviews booked. Offers signed.
              </h2>
            </div>

            {/* AI image slot, offers signed celebration */}
            <div className="mb-10">
              <AIImageSlot
                path="/marketing/offers-signed.png"
                ready={publicImageExists("/marketing/offers-signed.png")}
                alt="Job seekers who landed offers with JobsAI"
                prompt="Wide editorial mockup: person sleeping peacefully with JobsAI dashboard showing successful applications, interviews booked, offers signed. Blue night theme."
                ratio="aspect-[3/2]"
              />
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
            <div className="mt-8 text-center">
              <Link href="/faq" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
                See the full FAQ
              </Link>
            </div>
          </div>
        </section>

        {/* ── Full feature directory ───────────────────────────────────────── */}
        <FeatureDirectory />

        {/* ── Final CTA ─────────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden border-t border-border/60 px-4 py-24 sm:px-6">
          <GradientBg variant="animated" />
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">
              Stop applying.{" "}
              <span className="text-gradient">Start interviewing.</span>
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Let {APP_NAME} apply to thousands of jobs for you and land the interviews.
              Guaranteed, or your money back. <Link href="/terms" className="text-primary hover:underline">Some conditions apply</Link>.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <AuthCta href="/sign-up" className={gradientButtonVariants({ size: "xl" })}>
                Start auto applying
              </AuthCta>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Free to start · No card required · 90-day interview guarantee
            </p>
          </div>
        </section>

        {/* ── Footer ───────────────────────────────────────────────────────── */}
        <SiteFooter />
      </main>

    </div>
  );
}

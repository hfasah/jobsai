import Link from "next/link";
import type { Metadata } from "next";
import {
  Rocket, Send, FileText, Mic, CreditCard, ShieldCheck, ChevronDown, ArrowRight,
} from "lucide-react";

import { MarketingHeader } from "@/components/marketing/marketing-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { GradientBg } from "@/components/ui/gradient-bg";
import { SectionBadge } from "@/components/ui/section-badge";
import { APP_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: `FAQ · ${APP_NAME}`,
  description: `Answers to common questions about ${APP_NAME} — auto-apply, resumes, interview prep, pricing, and privacy.`,
};

type QA = { q: string; a: string };
type Group = { heading: string; icon: React.ElementType; items: QA[] };

const GROUPS: Group[] = [
  {
    heading: "Getting started",
    icon: Rocket,
    items: [
      { q: "What is JobsAI and how does it work?", a: "JobsAI is your AI job-search co-pilot — it takes you from a rough resume to interviews booked. It parses your background, tailors a resume and cover letter to each role, scores them against the ATS, finds matching jobs across the US, Canada, UK, and EU, and can auto-apply for you. When interviews land, it preps you to win them." },
      { q: "Do I need an existing resume to start?", a: "No. Upload a PDF or DOCX, import your LinkedIn profile, or start from scratch — JobsAI structures everything into an editable profile and builds from there." },
      { q: "How quickly can I start applying?", a: "Minutes. Once your resume is in and you've set a few preferences (titles, locations, salary floor), JobsAI starts surfacing matched roles you can apply to or auto-apply to right away." },
      { q: "Is JobsAI free? Is there a trial?", a: "You can start free and explore the core tools and the job board. Paid plans unlock unlimited resumes and matches, Auto-Apply, and the full interview suite — billed monthly or yearly, cancel anytime." },
    ],
  },
  {
    heading: "Job search & Auto-Apply",
    icon: Send,
    items: [
      { q: "How does JobsAI find jobs?", a: "Our job board pulls live listings across the US, Canada, the UK, and the EU, scored against your profile so the best-fit roles rise to the top. You can search by keyword, location, and country, and filter by job site, type, and remote." },
      { q: "Does JobsAI really apply to jobs for me — from inside the app?", a: "Yes. Auto-Apply submits tailored applications directly through employer systems like Lever, Ashby, Greenhouse, and Workday — inside JobsAI, not by bouncing you to external sites. Each application gets a resume and cover letter matched to that role." },
      { q: "Can I review applications before they're sent?", a: "Absolutely. Turn on the Approval Queue and every auto-prepared application waits for your one-tap approval (or bulk approve). Prefer fully hands-off? Leave it on automatic." },
      { q: "Which job boards and ATS does Auto-Apply support?", a: "Major applicant tracking systems including Lever, Ashby, Greenhouse, Workday, SmartRecruiters, BambooHR, and iCIMS, with more added over time. For sites we can't submit to directly, JobsAI flags the role so you can finish it in a click." },
      { q: "Will recruiters know my application was automated?", a: "No. Each application is submitted like any candidate's — your tailored resume, screening answers, and a personalized cover letter. There's no automation footprint on the recruiter's end." },
      { q: "How many jobs can I apply to?", a: "Paid plans remove the monthly application cap, and fair-use safeguards keep submissions spaced out to protect deliverability and your reputation with employers." },
    ],
  },
  {
    heading: "Resume & documents",
    icon: FileText,
    items: [
      { q: "Will my resume be ATS-friendly?", a: "Yes. The templates use clean, parseable structure, and tailoring weaves in the right keywords naturally. The ATS Scanner gives you a 0–100 score with specific fixes before you apply." },
      { q: "Can JobsAI tailor my resume to a specific job?", a: "That's the core of it. For each role, JobsAI rewrites your summary and bullets to match the job description — truthfully, never inventing experience — and shows you a before/after of what changed." },
      { q: "Won't AI make my resume sound generic?", a: "No. Every line is built from your real accomplishments and the specific job, and you keep full control to edit or regenerate any section. The result reads like strong professional writing, not a template." },
      { q: "Can I edit, choose templates, and export?", a: "Yes — edit all content, pick from recruiter-ready templates (Modern, Minimal, Classic, Executive), and export a polished PDF." },
      { q: "Can I translate my resume?", a: "Yes. The Resume Translator converts your resume into 68+ languages while keeping the formatting intact — useful for applying across the EU and beyond." },
      { q: "Can I create multiple versions?", a: "Yes. Keep multiple resume versions and per-job tailored variants, so you always have the right one for each application." },
    ],
  },
  {
    heading: "Interview prep",
    icon: Mic,
    items: [
      { q: "Does JobsAI prep me for interviews?", a: "Thoroughly. Practice with a written coach, a spoken voice interviewer, and a realistic on-camera avatar — all built from your resume and the exact role, with scored feedback on structure, clarity, and confidence." },
      { q: "What is Interview Buddy?", a: "Interview Buddy is your real-time interview assistant. It's a desktop app that listens to your interviewer and surfaces tailored talking points live during the call — and it stays invisible to Zoom, Meet, and Teams screen sharing. It builds on the prep tools as an added advantage." },
      { q: "Are mock interviews tailored to the role?", a: "Yes. Questions are generated from your resume and the specific job (and the company, when you add it), so you rehearse what you'll actually be asked." },
    ],
  },
  {
    heading: "Pricing & billing",
    icon: CreditCard,
    items: [
      { q: "What plans do you offer?", a: "A free tier to get started, plus paid plans (billed monthly or yearly) that unlock unlimited resumes and matches, Auto-Apply, and the full interview suite. You can upgrade, downgrade, or cancel anytime." },
      { q: "What are tokens?", a: "Your plan includes a monthly token allowance that meters the most expensive AI features — like voice and avatar interview prep. Core tools and auto-apply run within your plan; tokens just cover the heavy extras, and you can top up anytime." },
      { q: "Do I pay separately for each feature?", a: "No. A paid plan includes the resume tools, cover letters, job board, ATS scanner, translator, and interview prep. Only the heaviest AI minutes are metered by tokens." },
      { q: "Can I cancel or get a refund?", a: "Cancel anytime from your billing settings — it stops future renewals. If something isn't working, contact us first; we review refund requests case by case and often offer a prorated refund or credit." },
      { q: "What is the interview guarantee?", a: "On the Career Accelerator plan: actively use JobsAI for 90 days and if you don't land a single interview, we refund your Career Accelerator subscription. It's exclusive to Career Accelerator and some conditions apply (complete your profile, keep auto-apply running, realistic preferences, attend interviews you're offered). See the full terms at /interview-guarantee." },
    ],
  },
  {
    heading: "Account & privacy",
    icon: ShieldCheck,
    items: [
      { q: "Is my data safe and private?", a: "Yes. Your data is encrypted in transit and at rest, stored with Supabase (SOC 2 Type II). We only use it to deliver the features you ask for. See our Privacy Policy for the full picture." },
      { q: "Do you sell my data?", a: "Never. We do not sell or rent your personal data. We share it only with the service providers needed to run JobsAI and with the job platforms you choose to apply to." },
      { q: "How do I delete my account or data?", a: "You can delete your data or your account anytime from your settings, or email support@jobsai.work. We remove it from active systems and purge it from backups within a reasonable period." },
      { q: "Who is JobsAI for?", a: "Every career stage and industry — from students landing a first internship to senior professionals making a strategic move. If you're applying to jobs, JobsAI is built to save you time and get you more interviews." },
    ],
  },
];

export default function FaqPage() {
  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <MarketingHeader />

      <main className="relative overflow-hidden px-4 py-16 sm:px-6">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[380px]"
          style={{ background: "radial-gradient(60% 50% at 50% 0%, color-mix(in oklch, var(--desyn-purple) 26%, transparent), transparent 70%)" }}
        />
        <GradientBg variant="grid" className="opacity-30" />

        <div className="relative mx-auto max-w-3xl">
          <div className="text-center">
            <SectionBadge variant="soft">FAQ</SectionBadge>
            <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-5xl">
              Frequently Asked <span className="text-gradient">Questions</span>
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
              Everything you need to know about applying smarter with {APP_NAME}. Can&apos;t find an answer?
              Email <a href="mailto:support@jobsai.work" className="text-primary hover:underline">support@jobsai.work</a>.
            </p>
          </div>

          <div className="mt-12 space-y-12">
            {GROUPS.map((group) => {
              const Icon = group.icon;
              return (
                <section key={group.heading}>
                  <div className="mb-4 flex items-center gap-2.5">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" />
                    </span>
                    <h2 className="text-lg font-bold tracking-tight">{group.heading}</h2>
                  </div>
                  <div className="space-y-2.5">
                    {group.items.map(({ q, a }) => (
                      <details key={q} className="group rounded-2xl border border-border bg-card/60 px-5 py-4 transition-colors open:bg-card hover:border-primary/40">
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-foreground sm:text-base">
                          <span><span className="text-[var(--cta)]">Q.</span> {q}</span>
                          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                        </summary>
                        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{a}</p>
                      </details>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>

          {/* CTA */}
          <div className="mt-14 rounded-2xl border border-border bg-card p-6 text-center">
            <h2 className="text-xl font-bold tracking-tight">Ready to apply smarter, not harder?</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Start free — {APP_NAME} finds the jobs, tailors your applications, and preps you for the interviews.
            </p>
            <Link href="/sign-up" className="btn-cta mt-5 inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm">
              Start free <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

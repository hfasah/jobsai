import Link from "next/link";
import { Wand2, PenLine, Puzzle, ArrowRight } from "lucide-react";

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

const TOOLS = [
  {
    href: "/dashboard/linkedin/profile",
    icon: Wand2,
    title: "Profile Optimizer",
    body: "Turn your resume into a recruiter-magnet LinkedIn profile — headline, About, experience, and skills, plus a strength score and prioritized fixes.",
  },
  {
    href: "/dashboard/linkedin/posts",
    icon: PenLine,
    title: "Content Studio",
    body: "Write field-relevant posts and articles that build your authority. Generate, edit, schedule, and post to LinkedIn in one click.",
  },
  {
    href: "/dashboard/extension",
    icon: Puzzle,
    title: "Browser Extension",
    body: "Install the JobsAI Chrome extension to save LinkedIn jobs in one click and autofill Easy Apply from your saved profile.",
  },
];

export default function LinkedInHubPage() {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0A66C2]/10 text-[#0A66C2]">
          <LinkedInIcon className="h-6 w-6" />
        </div>
        <div>
          <p className="text-sm font-medium uppercase tracking-wider text-desyn-accent">
            LinkedIn Optimizer
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Grow your presence on LinkedIn</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Optimize your profile so recruiters find you, and publish writeups that establish you as
            an expert in your field — all powered by your real experience.
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {TOOLS.map(({ href, icon: Icon, title, body }) => (
          <Link
            key={href}
            href={href}
            className="group flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-gradient-brand group-hover:text-white">
              <Icon className="h-5 w-5" />
            </span>
            <span className="mt-1 flex items-center gap-1 text-base font-semibold text-foreground">
              {title}
              <ArrowRight className="h-4 w-4 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
            </span>
            <span className="text-sm leading-relaxed text-muted-foreground">{body}</span>
          </Link>
        ))}
      </div>
    </main>
  );
}

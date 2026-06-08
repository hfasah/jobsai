import Link from "next/link";
import Image from "next/image";
import { APP_NAME } from "@/lib/constants";
import { AuthCta } from "@/components/ui/auth-cta";
import { featureHref } from "@/lib/marketing-features";

// This lucide version dropped brand glyphs, so the social icons are inline SVGs.
type IconProps = { className?: string };
const XIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
  </svg>
);
const LinkedInIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286ZM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065Zm1.782 13.019H3.555V9h3.564v11.452ZM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003Z" />
  </svg>
);
const GitHubIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.51 11.51 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.91 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222 0 1.606-.014 2.898-.014 3.293 0 .322.216.694.825.576C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12Z" />
  </svg>
);
const YouTubeIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814ZM9.546 15.568V8.432L15.818 12l-6.272 3.568Z" />
  </svg>
);
const InstagramIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069ZM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0Zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324ZM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881Z" />
  </svg>
);

type FooterLink = { label: string; href: string };
type FooterCol = { heading: string; links: FooterLink[] };

const COLUMNS: FooterCol[] = [
  {
    heading: "Product",
    links: [
      { label: "Auto-Apply Agent", href: featureHref("auto-apply") },
      { label: "AI Job Discovery", href: featureHref("job-discovery") },
      { label: "Resume Tailoring", href: featureHref("resume-tailoring") },
      { label: "ATS Scanner", href: featureHref("ats-scanner") },
      { label: "Cover Letters", href: featureHref("cover-letters") },
      { label: "Application Tracker", href: featureHref("application-tracker") },
    ],
  },
  {
    heading: "Interview",
    links: [
      { label: "Interview Buddy", href: featureHref("interview-buddy") },
      { label: "Written Coach", href: featureHref("written-coach") },
      { label: "Voice Interviewer", href: featureHref("voice-interviewer") },
      { label: "Avatar Room", href: featureHref("avatar-room") },
      { label: "Mock Interview", href: featureHref("mock-interview") },
    ],
  },
  {
    heading: "Resources",
    links: [
      { label: "Salaries", href: "/salaries" },
      { label: "How it works", href: "#how" },
      { label: "All features", href: "#all-features" },
      { label: "Pricing", href: "#pricing" },
      { label: "FAQ", href: "/faq" },
      { label: "Chrome Extension", href: featureHref("browser-extension") },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Blog", href: "/blog" },
      { label: "Affiliates", href: "/affiliate" },
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
      { label: "Refund Policy", href: "/refund-policy" },
      { label: "Contact", href: "/contact" },
    ],
  },
];

const SOCIALS = [
  { label: "X", href: "https://x.com", icon: XIcon },
  { label: "LinkedIn", href: "https://linkedin.com", icon: LinkedInIcon },
  { label: "GitHub", href: "https://github.com", icon: GitHubIcon },
  { label: "YouTube", href: "https://youtube.com", icon: YouTubeIcon },
  { label: "Instagram", href: "https://instagram.com", icon: InstagramIcon },
];

// Faux community avatars (gradient + initials). Swap for AI-generated portraits:
// drop square images in /public/marketing/community/ and replace this band with
// <Image>. Kept as pure CSS for now so nothing 404s.
const AVATARS = ["AT", "PS", "DR", "MK", "JL", "EG", "RN", "SB", "DC", "MS", "KW", "TV"];
const AVATAR_GRADIENTS = [
  "from-violet-500 to-fuchsia-500", "from-fuchsia-500 to-pink-500",
  "from-sky-500 to-indigo-500", "from-emerald-500 to-teal-500",
  "from-amber-500 to-orange-500", "from-rose-500 to-purple-500",
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-card">
      {/* Community + newsletter band */}
      <div className="border-b border-border/60 px-4 py-12 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-7 text-center">
          {/* Avatar collage, replace with AI-generated portraits later */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            {AVATARS.map((a, i) => (
              <span
                key={a}
                className={`flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br ${AVATAR_GRADIENTS[i % AVATAR_GRADIENTS.length]} text-xs font-bold text-white shadow-soft ring-2 ring-card`}
              >
                {a}
              </span>
            ))}
          </div>

          <div>
            <h3 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Join <span className="text-gradient">thousands</span> landing interviews on autopilot
            </h3>
            <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
              Get product updates, hiring trends, and interview tips. No spam, unsubscribe anytime.
            </p>
          </div>

          <form
            action="/sign-up"
            className="flex w-full max-w-md flex-col gap-2 sm:flex-row"
          >
            <input
              name="email"
              type="email"
              required
              placeholder="you@email.com"
              className="h-11 flex-1 rounded-xl border border-border bg-background/60 px-4 text-sm outline-none placeholder:text-muted-foreground focus:border-primary/50"
            />
            <button type="submit" className="btn-cta inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm">
              Subscribe
            </button>
          </form>
        </div>
      </div>

      {/* Link columns */}
      <div className="px-4 py-12 sm:px-6">
        <div className="mx-auto grid max-w-6xl gap-10 sm:grid-cols-2 lg:grid-cols-6">
          {/* Brand */}
          <div className="lg:col-span-2">
            <Link href="/" className="inline-flex items-center gap-3">
              <Image src="/logo.png" alt="JobsAI logo" width={48} height={48} className="rounded-xl" />
              <span className="text-lg font-bold tracking-tight text-gradient">{APP_NAME}</span>
            </Link>
            <p className="mt-3 max-w-xs text-sm text-muted-foreground">
              The AI that applies to thousands of jobs for you, and preps you to win the interviews,
              guaranteed.
            </p>
            <div className="mt-5 flex items-center gap-2">
              {SOCIALS.map(({ label, href, icon: Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.heading}>
              <h4 className="text-sm font-semibold text-foreground">{col.heading}</h4>
              <ul className="mt-3 space-y-2">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link href={l.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mx-auto mt-12 flex max-w-6xl flex-col items-center justify-between gap-3 border-t border-border/60 pt-6 sm:flex-row">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} {APP_NAME}. All rights reserved.
          </p>
          <div className="flex items-center gap-5 text-xs text-muted-foreground">
            <AuthCta href="/sign-in" className="transition-colors hover:text-foreground">Sign in</AuthCta>
            <AuthCta href="/sign-up" className="transition-colors hover:text-foreground">Get started</AuthCta>
            <Link href="/privacy" className="transition-colors hover:text-foreground">Privacy</Link>
            <Link href="/terms" className="transition-colors hover:text-foreground">Terms</Link>
            <Link href="/refund-policy" className="transition-colors hover:text-foreground">Refund Policy</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

import { SignUp } from "@clerk/nextjs";
import Link from "next/link";
import Image from "next/image";
import { Zap, FileText, Mic, BarChart3, Send, Trophy, Users } from "lucide-react";
import { clerkAppearance } from "@/lib/clerk-appearance";

const STATS = [
  { value: "10,000+", label: "Job seekers" },
  { value: "90 days", label: "Interview guarantee" },
  { value: "Free", label: "To get started" },
];

const FEATURES = [
  { icon: Send,      label: "Auto-apply to thousands of jobs" },
  { icon: FileText,  label: "AI resume tailored to every role" },
  { icon: BarChart3, label: "ATS scanner with instant fixes" },
  { icon: Mic,       label: "Voice and avatar mock interviews" },
  { icon: Zap,       label: "Direct recruiter outreach" },
  { icon: Trophy,    label: "90-day interview guarantee" },
];

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">

      {/* Left: form */}
      <div className="flex flex-1 flex-col items-center justify-center bg-background px-6 py-12 lg:max-w-[520px]">
        <div className="mb-8 flex w-full max-w-sm items-center gap-3">
          <Image src="/logo.png" alt="JobsAI" width={40} height={40} className="rounded-xl" />
          <span className="text-xl font-bold text-gradient">JobsAI</span>
        </div>

        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-bold text-foreground">Create your account</h1>
          <p className="mt-1 text-sm text-muted-foreground">Free to start. No credit card required.</p>

          {/* Stats */}
          <div className="mt-5 grid grid-cols-3 gap-3 rounded-xl border border-border bg-card p-4">
            {STATS.map(({ value, label }) => (
              <div key={label} className="text-center">
                <p className="text-sm font-bold text-foreground">{value}</p>
                <p className="text-[10px] text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>

          <div className="mt-6">
            <SignUp appearance={clerkAppearance} />
          </div>
        </div>

        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/sign-in" className="font-medium text-primary hover:underline">
              Sign in
            </Link>
          </p>
          <Link href="/" className="mt-3 inline-block text-sm text-muted-foreground transition-colors hover:text-foreground">
            Back to home
          </Link>
        </div>
      </div>

      {/* Right: gradient feature panel */}
      <div className="relative hidden flex-1 flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-violet-700 via-purple-700 to-indigo-800 p-12 lg:flex">
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute -bottom-32 -left-24 h-[500px] w-[500px] rounded-full bg-white/5" />

        <div className="relative max-w-md text-white">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-semibold">
            <Users className="h-3 w-3" /> Join 10,000+ job seekers
          </div>

          <h2 className="mt-4 text-4xl font-bold leading-tight">
            Start landing<br />interviews today.
          </h2>
          <p className="mt-4 text-lg text-white/75">
            JobsAI handles the applications. You handle the interviews. We help you win those too.
          </p>

          <ul className="mt-8 space-y-3">
            {FEATURES.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-3 text-sm text-white/90">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/15">
                  <Icon className="h-3.5 w-3.5" />
                </div>
                {label}
              </li>
            ))}
          </ul>

          <div className="mt-10 rounded-2xl border border-white/20 bg-white/10 p-5 backdrop-blur">
            <div className="text-sm text-amber-300">★★★★★</div>
            <p className="mt-2 text-sm italic text-white/85">
              "Landed 3 interviews in my first week. The auto-apply and resume tailoring are incredible."
            </p>
            <p className="mt-3 text-xs font-semibold text-white/60">Marcus T. &middot; Senior Engineer</p>
          </div>
        </div>
      </div>
    </div>
  );
}

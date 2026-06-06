import { SignIn } from "@clerk/nextjs";
import Link from "next/link";
import Image from "next/image";
import { CheckCircle2, Zap, FileText, Mic, BarChart3, Send, Trophy } from "lucide-react";
import { clerkAppearance } from "@/lib/clerk-appearance";

const FEATURES = [
  { icon: Send,      label: "Auto-apply to thousands of jobs" },
  { icon: FileText,  label: "AI resume tailored to every role" },
  { icon: BarChart3, label: "ATS scanner with instant fixes" },
  { icon: Mic,       label: "Voice and avatar mock interviews" },
  { icon: Zap,       label: "Direct recruiter outreach" },
  { icon: Trophy,    label: "90-day interview guarantee" },
];

export default function SignInPage() {
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">

      {/* Left: form */}
      <div className="flex flex-1 flex-col items-center justify-center bg-background px-6 py-12 lg:max-w-[520px]">
        <div className="mb-8 flex w-full max-w-sm items-center gap-3">
          <Image src="/logo.png" alt="JobsAI" width={40} height={40} className="rounded-xl" />
          <span className="text-xl font-bold text-gradient">JobsAI</span>
        </div>

        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-bold text-foreground">Welcome back</h1>
          <p className="mt-1 text-sm text-muted-foreground">Sign in to your JobsAI account</p>
          <div className="mt-6">
            <SignIn appearance={clerkAppearance} />
          </div>
        </div>

        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground">
            {"Don't have an account? "}
            <Link href="/sign-up" className="font-medium text-primary hover:underline">
              Get started free
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
          <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
            <Image src="/logo.png" alt="" width={32} height={32} className="rounded-lg" />
          </div>

          <h2 className="text-4xl font-bold leading-tight">
            Let AI apply to jobs<br />while you sleep.
          </h2>
          <p className="mt-4 text-lg text-white/75">
            Thousands of tailored applications sent every day. Interviews land in your inbox.
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
              "I stopped spending nights on applications. The interviews just started showing up."
            </p>
            <p className="mt-3 text-xs font-semibold text-white/60">Priya S. &middot; VP Product</p>
          </div>
        </div>
      </div>
    </div>
  );
}

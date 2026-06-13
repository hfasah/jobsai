import { Play, Check, ArrowRight } from "lucide-react";
import Link from "next/link";
import { PublicEnterpriseHeader } from "@/components/enterprise/public-header";

export const metadata = {
  title: "Book a demo — JobsAI Enterprise",
  description: "See the AI-Powered Talent Acquisition Operating System in action. Book a live walkthrough.",
};

const BOOKING = "https://api.leadconnectorhq.com/widget/booking/5HFMVFvz8AJQ4gjY7B9F";
// Set to a YouTube/Loom embed URL when the product video is ready.
const DEMO_VIDEO_URL = "";

const SEE = [
  "AI sourcing & autonomous outreach",
  "AI voice/avatar screening with scoring",
  "Kanban pipeline & candidate pools",
  "Offer letters with e-signature",
  "Executive analytics & compliance",
  "White-label client portals",
];

export default function EnterpriseDemoPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <PublicEnterpriseHeader />

      <section className="border-b border-border bg-gradient-to-b from-primary/5 to-transparent px-6 py-14 text-center">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">See JobsAI Enterprise in action</h1>
        <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">Watch the walkthrough, or book a live demo with our team — we&apos;ll tailor it to your hiring workflow.</p>
      </section>

      <section className="mx-auto grid max-w-6xl gap-10 px-6 py-14 lg:grid-cols-2">
        {/* Video */}
        <div>
          <h2 className="mb-4 text-xl font-bold">Product walkthrough</h2>
          <div className="aspect-video overflow-hidden rounded-2xl border border-border bg-card">
            {DEMO_VIDEO_URL ? (
              <iframe src={DEMO_VIDEO_URL} title="JobsAI Enterprise demo" className="h-full w-full" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-brand"><Play className="h-6 w-6 text-white" /></div>
                <p className="text-sm text-muted-foreground">Demo video coming soon — book a live walkthrough below.</p>
              </div>
            )}
          </div>
          <ul className="mt-6 grid gap-2 sm:grid-cols-2">
            {SEE.map((s) => <li key={s} className="flex items-start gap-2 text-sm text-muted-foreground"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{s}</li>)}
          </ul>
        </div>

        {/* Booking */}
        <div>
          <h2 className="mb-4 text-xl font-bold">Book a live walkthrough</h2>
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <iframe src={BOOKING} title="Book a demo" className="h-[640px] w-full" />
          </div>
          <p className="mt-3 text-center text-sm text-muted-foreground">
            Prefer to dive in? <Link href="/enterprise-login" className="font-semibold text-primary hover:underline">Start your 14-day free trial <ArrowRight className="inline h-3.5 w-3.5" /></Link>
          </p>
        </div>
      </section>
    </main>
  );
}

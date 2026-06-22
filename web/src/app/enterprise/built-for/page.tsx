import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { PublicEnterpriseHeader } from "@/components/enterprise/public-header";
import { PublicEnterpriseFooter } from "@/components/enterprise/public-footer";
import { PERSONAS } from "@/lib/enterprise-personas";

export const metadata: Metadata = {
  title: "Built for agencies, HR & enterprise hiring teams",
  description:
    "JobsAI Enterprise is built for recruiting agencies, staffing firms, corporate HR, talent acquisition teams, hiring managers, and enterprise organizations.",
};

export default function BuiltForIndex() {
  return (
    <div className="min-h-screen bg-background">
      <PublicEnterpriseHeader />

      <section className="mx-auto max-w-5xl px-6 pt-16 pb-10 text-center">
        <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-primary">Built for your team</p>
        <h1 className="text-3xl font-bold sm:text-4xl">One platform, tuned to how you hire</h1>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
          Recruiters across every industry share the same problems. JobsAI Enterprise solves them — whatever
          your team looks like.
        </p>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-20">
        <div className="grid gap-4 sm:grid-cols-2">
          {PERSONAS.map((p) => (
            <Link
              key={p.slug}
              href={`/enterprise/built-for/${p.slug}`}
              className="group flex flex-col rounded-2xl border border-border bg-card p-6 transition-colors hover:border-primary/40"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">{p.name}</h2>
                <ArrowRight className="h-5 w-5 text-muted-foreground/50 group-hover:text-primary" />
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{p.intro}</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {p.features.slice(0, 3).map((f) => (
                  <span key={f.name} className="rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-xs text-muted-foreground">
                    {f.name}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      </section>

      <PublicEnterpriseFooter />
    </div>
  );
}

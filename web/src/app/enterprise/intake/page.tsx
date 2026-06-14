import type { Metadata } from "next";
import { ClipboardList } from "lucide-react";
import { PublicEnterpriseHeader } from "@/components/enterprise/public-header";
import { PublicEnterpriseFooter } from "@/components/enterprise/public-footer";
import { IntakeForm } from "@/components/enterprise/intake-form";

export const metadata: Metadata = {
  title: "Get started — JobsAI Enterprise",
  description: "Tell us about your team and the tools you need, and we'll set up the right JobsAI Enterprise workspace for you.",
};

export default function EnterpriseIntakePage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <PublicEnterpriseHeader />

      <section className="relative overflow-hidden border-b border-border px-4 py-14 text-center sm:px-6">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-[300px]"
          style={{ background: "radial-gradient(60% 50% at 50% 0%, color-mix(in oklch, var(--primary) 16%, transparent), transparent 70%)" }}
        />
        <div className="relative mx-auto max-w-2xl">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <ClipboardList className="h-3.5 w-3.5" /> Get started
          </span>
          <h1 className="mt-4 text-4xl font-bold tracking-tight">Let&apos;s build your workspace</h1>
          <p className="mx-auto mt-3 max-w-xl text-lg text-muted-foreground">
            A few quick questions about your team and the tools you need. We&apos;ll recommend the right plan and set everything up for you.
          </p>
        </div>
      </section>

      <section className="px-4 py-12 sm:px-6">
        <IntakeForm />
      </section>

      <PublicEnterpriseFooter />
    </main>
  );
}
